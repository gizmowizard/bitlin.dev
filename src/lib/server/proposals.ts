import { error } from '@sveltejs/kit';
import { db } from './db.ts';
import { publish, notifyUser } from './events.ts';
import { emit } from './ws/hub.ts';
import { getBranch } from './vcs/refs.ts';
import { copySnapshots, getSnapshot } from './vcs/snapshots.ts';
import type { Actor, ProjectRow } from './projects.ts';
import type { PublicUser } from '../types.ts';

export interface ProposalRow {
    id: string;
    project_id: string;
    number: number;
    title: string;
    body: string;
    status: 'open' | 'merged' | 'closed';
    source_project_id: string;
    source_branch: string;
    target_branch: string;
    merged_snapshot: string | null;
    created_at: Date;
    updated_at: Date;
    closed_at: Date | null;
    author: PublicUser | null;
    source_owner: string;
    source_name: string;
}

const SELECT = `p.id, p.project_id, p.number, p.title, p.body, p.status, p.source_project_id, p.source_branch, p.target_branch,
    p.merged_snapshot, p.created_at, p.updated_at, p.closed_at,
    CASE WHEN a.id IS NULL THEN NULL ELSE json_build_object('id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url) END AS author,
    so.username AS source_owner, sp.name AS source_name`;
const FROM = `FROM proposals p LEFT JOIN users a ON a.id = p.author_id
    JOIN projects sp ON sp.id = p.source_project_id JOIN users so ON so.id = sp.owner_id`;

export const listProposals = (projectId: string, status: string) =>
    db.q<ProposalRow>(
        `SELECT ${SELECT} ${FROM} WHERE p.project_id = $1 AND ($2 = 'all' OR ($2 = 'open' AND p.status = 'open') OR ($2 = 'closed' AND p.status <> 'open'))
          ORDER BY p.number DESC LIMIT 100`,
        [projectId, status]
    );

export const getProposal = (projectId: string, number: number) =>
    db.one<ProposalRow>(`SELECT ${SELECT} ${FROM} WHERE p.project_id = $1 AND p.number = $2`, [projectId, number]);

export async function createProposal(
    actor: Actor,
    target: ProjectRow,
    input: { title: string; body: string; sourceProjectId: string; sourceBranch: string; targetBranch: string }
) {
    const title = input.title.trim();
    if (!title || title.length > 150) error(400, 'Titles are 1–150 characters.');
    if (input.body.length > 20_000) error(400, 'That description is too long.');
    const [src, dst] = await Promise.all([getBranch(input.sourceProjectId, input.sourceBranch), getBranch(target.id, input.targetBranch)]);
    if (!src?.head) error(400, 'The source branch has no snapshots yet.');
    if (!dst || dst.tracking) error(400, 'Choose one of the project’s own branches as the target.');
    if (input.sourceProjectId === target.id && input.sourceBranch === input.targetBranch) error(400, 'Source and target must differ.');
    const dup = await db.one(
        `SELECT 1 FROM proposals WHERE project_id = $1 AND source_project_id = $2 AND source_branch = $3 AND target_branch = $4 AND status = 'open'`,
        [target.id, input.sourceProjectId, input.sourceBranch, input.targetBranch]
    );
    if (dup) error(409, 'There is already an open proposal for those branches.');

    await copySnapshots(input.sourceProjectId, target.id, src.head);
    const seq = await db.one<{ proposal_seq: number }>('UPDATE projects SET proposal_seq = proposal_seq + 1 WHERE id = $1 RETURNING proposal_seq', [target.id]);
    const row = await db.one<{ number: number }>(
        `INSERT INTO proposals (project_id, number, title, body, author_id, source_project_id, source_branch, target_branch)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING number`,
        [target.id, seq!.proposal_seq, title, input.body, actor.id, input.sourceProjectId, input.sourceBranch, input.targetBranch]
    );
    await publish({ projectId: target.id, actorId: actor.id, type: 'proposal.opened', data: { number: row!.number, title } });
    if (target.owner_id !== actor.id) notifyUser(target.owner_id, 'notice', { text: `*${actor.username} proposed “${title}” on ${target.name}.`, href: `/*${target.owner_username}/${target.name}/proposals/${row!.number}` });
    return row!.number;
}

export interface CommentRow {
    id: string;
    body: string;
    created_at: Date;
    author: PublicUser | null;
}

export const listComments = (proposalId: string) =>
    db.q<CommentRow>(
        `SELECT c.id, c.body, c.created_at,
                CASE WHEN a.id IS NULL THEN NULL ELSE json_build_object('id', a.id, 'username', a.username, 'display_name', a.display_name, 'avatar_url', a.avatar_url) END AS author
           FROM proposal_comments c LEFT JOIN users a ON a.id = c.author_id WHERE c.proposal_id = $1 ORDER BY c.created_at LIMIT 500`,
        [proposalId]
    );

export async function addComment(projectId: string, proposal: ProposalRow, actor: Actor, body: string) {
    const text = body.trim();
    if (!text || text.length > 10_000) error(400, 'Comments are 1–10,000 characters.');
    const row = await db.one<{ id: string }>('INSERT INTO proposal_comments (proposal_id, author_id, body) VALUES ($1, $2, $3) RETURNING id', [proposal.id, actor.id, text]);
    await db.q('UPDATE proposals SET updated_at = now() WHERE id = $1', [proposal.id]);
    await publish({ projectId, actorId: actor.id, type: 'proposal.comment', data: { number: proposal.number, comment: row!.id } });
}

export async function deleteComment(projectId: string, proposal: ProposalRow, commentId: string, actorId: string, isAdmin: boolean) {
    const res = await db.q('DELETE FROM proposal_comments WHERE id = $1 AND proposal_id = $2 AND (author_id = $3 OR $4) RETURNING 1', [commentId, proposal.id, actorId, isAdmin]);
    if (!res.length) error(403, 'You can only delete your own comments.');
    await publish({ projectId, actorId, type: 'proposal.comment', data: { number: proposal.number } });
}

export async function setProposalStatus(projectId: string, proposal: ProposalRow, actor: Actor, status: 'open' | 'closed') {
    if (proposal.status === 'merged') error(400, 'Merged proposals can’t be changed.');
    await db.q(
        `UPDATE proposals SET status = $2, updated_at = now(), closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE NULL END,
                closed_by = CASE WHEN $2 = 'closed' THEN $3::uuid ELSE NULL END WHERE id = $1`,
        [proposal.id, status, actor.id]
    );
    await publish({ projectId, actorId: actor.id, type: status === 'closed' ? 'proposal.closed' : 'proposal.reopened', data: { number: proposal.number, title: proposal.title } });
}

export async function markMerged(projectId: string, proposal: ProposalRow, actor: Actor, snapshot: string) {
    await db.q(`UPDATE proposals SET status = 'merged', merged_snapshot = $2, closed_at = now(), updated_at = now(), closed_by = $3 WHERE id = $1`, [proposal.id, snapshot, actor.id]);
    await publish({ projectId, actorId: actor.id, type: 'proposal.merged', data: { number: proposal.number, title: proposal.title } });
}

// Cross-fork proposals carry their history into the target on demand.
export async function sourceHead(target: ProjectRow, p: ProposalRow): Promise<string | null> {
    const b = await getBranch(p.source_project_id, p.source_branch);
    if (!b?.head) return null;
    if (p.source_project_id !== target.id && !(await getSnapshot(target.id, b.head))) await copySnapshots(p.source_project_id, target.id, b.head);
    return b.head;
}

// Tells open pages that a proposal's diff or mergeability may have changed.
export async function touchProposalsFor(projectId: string, branch: string) {
    const rows = await db.q<{ number: number; project_id: string; source_project_id: string }>(
        `SELECT number, project_id, source_project_id FROM proposals
          WHERE status = 'open' AND ((source_project_id = $1 AND source_branch = $2) OR (project_id = $1 AND target_branch = $2))`,
        [projectId, branch]
    );
    for (const r of rows) {
        emit(`project:${r.project_id}`, 'proposal.updated', { number: r.number });
        if (r.source_project_id !== r.project_id) emit(`project:${r.source_project_id}`, 'proposal.updated', { number: r.number });
    }
}
