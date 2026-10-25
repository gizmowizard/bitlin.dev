import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { getBranch } from '#lib/server/vcs/refs.ts';
import { ancestors, getSnapshot, mergeBase, snapshotInfos } from '#lib/server/vcs/snapshots.ts';
import { buildFileDiffs, diffTrees } from '#lib/server/vcs/diff.ts';
import { executeMerge, planMerge } from '#lib/server/ops.ts';
import { addComment, deleteComment, getProposal, listComments, markMerged, setProposalStatus, sourceHead } from '#lib/server/proposals.ts';
import { parseResolutions } from '#lib/server/merge-form.ts';
import { renderMarkdown } from '#lib/server/markdown.ts';
import { can } from '#lib/access.ts';

export const load: PageServerLoad = async ({ params, parent, depends }) => {
    depends('bitlin:proposals');
    const { project } = await parent();
    const pr = await getProposal(project.id, Number(params.number));
    if (!pr) error(404, 'Proposal not found');
    const raw = `/*${project.owner.username}/${project.name}/raw`;
    const comments = (await listComments(pr.id)).map((c) => ({ ...c, html: renderMarkdown(c.body) }));

    const srcHead = await sourceHead(project as any, pr);
    const target = await getBranch(project.id, pr.target_branch);
    let diffs: Awaited<ReturnType<typeof buildFileDiffs>> = [];
    let plan: { kind: string; conflicts: any[]; autoMerged: number } | null = null;
    let commits: Awaited<ReturnType<typeof snapshotInfos>> extends Map<string, infer V> ? V[] : never = [];
    if (srcHead && target) {
        const base = target.head ? await mergeBase(project.id, target.head, srcHead) : null;
        const [bt, st] = await Promise.all([base ? getSnapshot(project.id, base) : null, getSnapshot(project.id, srcHead)]);
        diffs = await buildFileDiffs(diffTrees(bt?.tree ?? null, st?.tree ?? {}));
        if (pr.status === 'open') {
            const pl = await planMerge(project.id, target.head, srcHead, { ours: pr.target_branch, theirs: pr.source_branch });
            plan = { kind: pl.kind, conflicts: pl.kind === 'merge' ? pl.outcome.conflicts : [], autoMerged: pl.kind === 'merge' ? pl.outcome.autoMerged.length : 0 };
        }
        const [a, b] = await Promise.all([ancestors(project.id, srcHead, 3000), ancestors(project.id, target.head, 3000)]);
        const ids = [...a.entries()].filter(([id]) => !b.has(id)).sort((x, y) => y[1].t - x[1].t).slice(0, 20).map(([id]) => id);
        const infos = await snapshotInfos(project.id, ids);
        commits = ids.map((id) => infos.get(id)!).filter(Boolean);
    }
    return { pr: { ...pr, html: renderMarkdown(pr.body, { rawBase: raw }) }, comments, diffs, plan, commits, sourceMissing: !srcHead };
};

async function ctx(event: Parameters<Actions[string]>[0], need: 'read' | 'write') {
    const g = await guard(event.params, event.locals.user, need);
    const pr = await getProposal(g.project.id, Number(event.params.number));
    if (!pr) error(404, 'Proposal not found');
    return { ...g, pr };
}

export const actions: Actions = {
    comment: async (event) => {
        const { project, user, pr } = await ctx(event, 'read');
        await enforce(event, 'comment');
        await addComment(project.id, pr, user, String((await event.request.formData()).get('body') ?? ''));
        return { ok: true };
    },
    deleteComment: async (event) => {
        const { project, user, pr, role } = await ctx(event, 'read');
        await enforce(event, 'comment');
        await deleteComment(project.id, pr, String((await event.request.formData()).get('id')), user.id, can(role, 'admin'));
        return { ok: true };
    },
    close: async (event) => {
        const { project, user, pr, role } = await ctx(event, 'read');
        if (pr.author?.id !== user.id && !can(role, 'write')) error(403, 'Only the author or a collaborator can close this.');
        await enforce(event, 'comment');
        await setProposalStatus(project.id, pr, user, 'closed');
        return { ok: true };
    },
    reopen: async (event) => {
        const { project, user, pr, role } = await ctx(event, 'read');
        if (pr.author?.id !== user.id && !can(role, 'write')) error(403, 'Only the author or a collaborator can reopen this.');
        await enforce(event, 'comment');
        await setProposalStatus(project.id, pr, user, 'open');
        return { ok: true };
    },
    merge: async (event) => {
        const { project, user, pr } = await ctx(event, 'write');
        await enforce(event, 'merge');
        if (pr.status !== 'open') return fail(400, { message: 'This proposal is not open.' });
        const head = await sourceHead(project, pr);
        if (!head) return fail(400, { message: 'The source branch no longer exists.' });
        const f = await event.request.formData();
        const res = await executeMerge({
            projectId: project.id,
            actor: user,
            into: pr.target_branch,
            fromHead: head,
            fromLabel: `${pr.source_branch} (#${pr.number})`,
            message: String(f.get('message') ?? '') || `Merge proposal #${pr.number}: ${pr.title}`,
            resolutions: parseResolutions(f),
            noFastForward: f.get('noff') === 'on'
        });
        if (res.status === 'conflicts') return fail(409, { message: `${res.conflicts.length} conflict(s) still need a decision.` });
        await markMerged(project.id, pr, user, res.snapshot);
        return { ok: true };
    }
};
