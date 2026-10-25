import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveRef } from '#lib/server/vcs/refs.ts';
import { aheadBehind, ancestors, snapshotInfos } from '#lib/server/vcs/snapshots.ts';
import { headTree } from '#lib/server/vcs/drafts.ts';
import { buildFileDiffs, diffTrees } from '#lib/server/vcs/diff.ts';
import { planMerge } from '#lib/server/ops.ts';

export const load: PageServerLoad = async ({ parent, url, depends }) => {
    depends('bitlin:refs');
    const { project, ref } = await parent();
    const baseName = url.searchParams.get('base') || project.default_branch;
    const headName = url.searchParams.get('head') || ref.name;
    const [base, head] = await Promise.all([resolveRef(project.id, baseName, project.default_branch), resolveRef(project.id, headName, project.default_branch)]);
    if (!base) error(404, `“${baseName}” was not found.`);
    if (!head) error(404, `“${headName}” was not found.`);

    const [bt, ht] = await Promise.all([headTree(project.id, base.snapshot), headTree(project.id, head.snapshot)]);
    const diffs = await buildFileDiffs(diffTrees(bt, ht));
    const counts = await aheadBehind(project.id, head.snapshot, base.snapshot);

    // Snapshots that exist on head but not on base.
    const [aHead, aBase] = await Promise.all([ancestors(project.id, head.snapshot, 3000), ancestors(project.id, base.snapshot, 3000)]);
    const ids = [...aHead.entries()].filter(([id]) => !aBase.has(id)).sort((x, y) => y[1].t - x[1].t).slice(0, 15).map(([id]) => id);
    const infos = await snapshotInfos(project.id, ids);
    const commits = ids.map((id) => infos.get(id)!).filter(Boolean);

    let plan: { kind: string; conflicts: number } | null = null;
    if (head.snapshot && base.snapshot && base.branch) {
        const pl = await planMerge(project.id, base.snapshot, head.snapshot, { ours: base.name, theirs: head.name });
        plan = { kind: pl.kind, conflicts: pl.kind === 'merge' ? pl.outcome.conflicts.length : 0 };
    }
    return { base, head, diffs, counts, commits, plan };
};
