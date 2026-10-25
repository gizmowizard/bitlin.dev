import { error } from '@sveltejs/kit';
import { db, tx } from './db.ts';
import { publish } from './events.ts';
import { validateBranchName, TAG_RE, shortId } from '../util.ts';
import { getBranch, moveBranch } from './vcs/refs.ts';
import { getSnapshot, insertSnapshot, isAncestor, mergeBase } from './vcs/snapshots.ts';
import { applyResolutions, mergeTrees, type Conflict, type MergeOutcome, type Resolution } from './vcs/merge.ts';
import { findShapeConflict } from './vcs/paths.ts';
import { treesEqual } from './vcs/paths.ts';
import { touchProposalsFor } from './proposals.ts';
import type { Actor } from './projects.ts';
import type { Tree } from '../types.ts';

const firstLine = (s: string) => s.split('\n')[0].slice(0, 120);

export async function createBranch(projectId: string, actor: Actor, name: string, fromSnapshot: string | null) {
    const problem = validateBranchName(name);
    if (problem) error(400, problem);
    if (fromSnapshot && !(await getSnapshot(projectId, fromSnapshot))) error(404, 'Starting point not found');
    const inserted = await db.q('INSERT INTO branches (project_id, name, head) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1', [projectId, name, fromSnapshot]);
    if (!inserted.length) error(409, `A branch named “${name}” already exists.`);
    await publish({ projectId, actorId: actor.id, type: 'branch.created', data: { branch: name, from: fromSnapshot } });
}

export async function deleteBranch(projectId: string, actor: Actor, name: string, defaultBranch: string) {
    if (name === defaultBranch) error(400, 'The default branch can’t be deleted. Pick another default first.');
    const gone = await db.q('DELETE FROM branches WHERE project_id = $1 AND name = $2 RETURNING 1', [projectId, name]);
    if (!gone.length) error(404, 'Branch not found');
    await db.q('DELETE FROM draft_changes WHERE project_id = $1 AND branch = $2', [projectId, name]);
    await db.q(`UPDATE proposals SET status = 'closed', closed_at = now(), updated_at = now() WHERE project_id = $1 AND target_branch = $2 AND status = 'open'`, [projectId, name]);
    await db.q(`UPDATE proposals SET status = 'closed', closed_at = now(), updated_at = now() WHERE source_project_id = $1 AND source_branch = $2 AND status = 'open'`, [projectId, name]);
    await publish({ projectId, actorId: actor.id, type: 'branch.deleted', data: { branch: name } });
}

export async function renameBranch(projectId: string, actor: Actor, from: string, to: string) {
    const problem = validateBranchName(to);
    if (problem) error(400, problem);
    await tx(async (d) => {
        const exists = await d.one('SELECT 1 FROM branches WHERE project_id = $1 AND name = $2', [projectId, to]);
        if (exists) error(409, `A branch named “${to}” already exists.`);
        const res = await d.q('UPDATE branches SET name = $3 WHERE project_id = $1 AND name = $2 RETURNING 1', [projectId, from, to]);
        if (!res.length) error(404, 'Branch not found');
        await d.q('UPDATE projects SET default_branch = $3 WHERE id = $1 AND default_branch = $2', [projectId, from, to]);
        await d.q('UPDATE draft_changes SET branch = $3 WHERE project_id = $1 AND branch = $2', [projectId, from, to]);
        await d.q('UPDATE proposals SET target_branch = $3 WHERE project_id = $1 AND target_branch = $2', [projectId, from, to]);
        await d.q('UPDATE proposals SET source_branch = $3 WHERE source_project_id = $1 AND source_branch = $2', [projectId, from, to]);
    });
    await publish({ projectId, actorId: actor.id, type: 'branch.renamed', data: { from, to } });
}

export async function setDefaultBranch(projectId: string, actor: Actor, name: string) {
    const b = await getBranch(projectId, name);
    if (!b || b.tracking) error(400, 'Pick one of your own branches.');
    await db.q('UPDATE projects SET default_branch = $2, updated_at = now() WHERE id = $1', [projectId, name]);
    await publish({ projectId, actorId: actor.id, type: 'project.updated' });
}

export async function createTag(projectId: string, actor: Actor, name: string, snapshotId: string, message: string, notes: string) {
    if (!TAG_RE.test(name)) error(400, 'Tag names use letters, numbers, “.”, “-”, “_” and “+” (up to 64 characters).');
    if (notes.length > 20_000) error(400, 'Release notes are too long.');
    if (!(await getSnapshot(projectId, snapshotId))) error(404, 'Snapshot not found');
    const inserted = await db.q(
        'INSERT INTO tags (project_id, name, snapshot_id, message, notes, author_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING 1',
        [projectId, name, snapshotId, message.trim().slice(0, 200), notes, actor.id]
    );
    if (!inserted.length) error(409, `The tag “${name}” already exists.`);
    await db.q('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId]);
    await publish({ projectId, actorId: actor.id, type: 'tag.created', data: { tag: name, snapshot: snapshotId } });
}

export async function updateTagNotes(projectId: string, actor: Actor, name: string, message: string, notes: string) {
    if (notes.length > 20_000) error(400, 'Release notes are too long.');
    const res = await db.q('UPDATE tags SET message = $3, notes = $4 WHERE project_id = $1 AND name = $2 RETURNING 1', [projectId, name, message.trim().slice(0, 200), notes]);
    if (!res.length) error(404, 'Tag not found');
    await publish({ projectId, actorId: actor.id, type: 'tag.updated', data: { tag: name } });
}

export async function deleteTag(projectId: string, actor: Actor, name: string) {
    const res = await db.q('DELETE FROM tags WHERE project_id = $1 AND name = $2 RETURNING 1', [projectId, name]);
    if (!res.length) error(404, 'Tag not found');
    await publish({ projectId, actorId: actor.id, type: 'tag.deleted', data: { tag: name } });
}

// Restoring writes a NEW snapshot that matches the old one, so nothing is lost from history.
export async function restoreSnapshot(projectId: string, actor: Actor, branch: string, snapshotId: string, paths: string[] = []) {
    const result = await tx(async (d) => {
        const b = await getBranch(projectId, branch, d);
        if (!b) error(404, 'Branch not found');
        if (b.tracking) error(400, 'Remote-tracking branches are read-only.');
        const target = await getSnapshot(projectId, snapshotId, d);
        if (!target) error(404, 'Snapshot not found');
        const current: Tree = b.head ? ((await getSnapshot(projectId, b.head, d))?.tree ?? {}) : {};

        let tree: Tree;
        if (paths.length) {
            tree = { ...current };
            for (const p of paths) {
                const inScope = (f: string) => f === p || f.startsWith(`${p}/`);
                for (const f of Object.keys(tree)) if (inScope(f)) delete tree[f];
                for (const [f, e] of Object.entries(target.tree)) if (inScope(f)) tree[f] = e;
            }
        } else tree = { ...target.tree };

        if (treesEqual(tree, current)) error(400, 'This branch already matches that snapshot.');
        if (findShapeConflict(tree)) error(400, 'Restoring those files would clash with existing folders.');
        const label = paths.length ? `Restore ${paths.length === 1 ? paths[0] : `${paths.length} paths`} from ${shortId(snapshotId)}` : `Restore ${shortId(snapshotId)}`;
        const snap = await insertSnapshot(d, projectId, {
            tree,
            parents: b.head ? [b.head] : [],
            message: `${label}: ${firstLine(target.message)}`,
            authorId: actor.id,
            authorName: actor.username
        });
        if (!(await moveBranch(d, projectId, branch, b.head, snap.id))) error(409, 'The branch moved while restoring. Try again.');
        await d.q('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId]);
        return snap;
    });
    await publish({ projectId, actorId: actor.id, type: 'restore', data: { branch, snapshot: result.id, from: snapshotId, message: result.message } });
    await announceBranchMove(projectId, branch);
    return result;
}

export async function announceBranchMove(projectId: string, branch: string) {
    await publish({ projectId, type: 'branch.updated', data: { branch } });
    await touchProposalsFor(projectId, branch);
}

export async function announceSnapshot(projectId: string, actor: Actor, branch: string, snapshotId: string, message: string, files?: number) {
    await publish({ projectId, actorId: actor.id, type: 'snapshot.created', data: { branch, snapshot: snapshotId, message: firstLine(message), files } });
    await announceBranchMove(projectId, branch);
}

export type MergePlan =
    | { kind: 'up-to-date' }
    | { kind: 'fast-forward' }
    | { kind: 'merge'; outcome: MergeOutcome; base: string | null };

const treeOf = async (projectId: string, id: string | null, d = db): Promise<Tree> => (id ? ((await getSnapshot(projectId, id, d))?.tree ?? {}) : {});

export async function planMerge(projectId: string, intoHead: string | null, fromHead: string, labels: { ours: string; theirs: string }): Promise<MergePlan> {
    if (intoHead === fromHead) return { kind: 'up-to-date' };
    if (!intoHead) return { kind: 'fast-forward' };
    if (await isAncestor(projectId, fromHead, intoHead)) return { kind: 'up-to-date' };
    if (await isAncestor(projectId, intoHead, fromHead)) return { kind: 'fast-forward' };
    const base = await mergeBase(projectId, intoHead, fromHead);
    const [b, o, t] = await Promise.all([treeOf(projectId, base), treeOf(projectId, intoHead), treeOf(projectId, fromHead)]);
    return { kind: 'merge', base, outcome: await mergeTrees(b, o, t, labels) };
}

export type MergeResult =
    | { status: 'merged'; mode: 'fast-forward' | 'merge'; snapshot: string }
    | { status: 'conflicts'; conflicts: Conflict[] };

export async function executeMerge(opts: {
    projectId: string;
    actor: Actor;
    into: string;
    fromHead: string;
    fromLabel: string;
    message?: string;
    resolutions?: Record<string, Resolution>;
    noFastForward?: boolean;
}): Promise<MergeResult> {
    const { projectId, actor, into, fromHead } = opts;
    const b = await getBranch(projectId, into);
    if (!b) error(404, `Branch “${into}” not found`);
    if (b.tracking) error(400, 'Remote-tracking branches are read-only.');
    const plan = await planMerge(projectId, b.head, fromHead, { ours: into, theirs: opts.fromLabel });
    if (plan.kind === 'up-to-date') error(400, 'Already up to date: there is nothing to merge.');

    let result: MergeResult;
    if (plan.kind === 'fast-forward' && !(opts.noFastForward && b.head)) {
        const ok = await tx((d) => moveBranch(d, projectId, into, b.head, fromHead));
        if (!ok) error(409, 'The branch moved while merging. Try again.');
        result = { status: 'merged', mode: 'fast-forward', snapshot: fromHead };
    } else {
        const base = plan.kind === 'merge' ? plan.base : b.head ? await mergeBase(projectId, b.head, fromHead) : null;
        const [bt, ot, tt] = await Promise.all([treeOf(projectId, base), treeOf(projectId, b.head), treeOf(projectId, fromHead)]);
        const outcome = plan.kind === 'merge' ? plan.outcome : await mergeTrees(bt, ot, tt, { ours: into, theirs: opts.fromLabel });
        const { tree, unresolved } = await applyResolutions(outcome.tree, outcome.conflicts, opts.resolutions ?? {});
        if (unresolved.length) return { status: 'conflicts', conflicts: unresolved };
        if (findShapeConflict(tree)) error(400, 'The merged result has a file where a folder is expected. Resolve those paths manually.');
        const message = opts.message?.trim() || `Merge ${opts.fromLabel} into ${into}`;
        const snap = await tx(async (d) => {
            const s = await insertSnapshot(d, projectId, { tree, parents: b.head ? [b.head, fromHead] : [fromHead], message, authorId: actor.id, authorName: actor.username });
            if (!(await moveBranch(d, projectId, into, b.head, s.id))) error(409, 'The branch moved while merging. Try again.');
            await d.q('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId]);
            return s;
        });
        result = { status: 'merged', mode: 'merge', snapshot: snap.id };
    }
    await announceSnapshot(projectId, actor, into, result.snapshot, result.status === 'merged' && result.mode === 'merge' ? (opts.message?.trim() || `Merge ${opts.fromLabel} into ${into}`) : `Fast-forward to ${shortId(fromHead)}`);
    return result;
}
