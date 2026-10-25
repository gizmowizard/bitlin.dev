import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { findSnapshotByPrefix, getSnapshot, snapshotInfos } from '#lib/server/vcs/snapshots.ts';
import { buildFileDiffs, diffTrees } from '#lib/server/vcs/diff.ts';
import { createBranch, createTag, restoreSnapshot } from '#lib/server/ops.ts';
import { db } from '#lib/server/db.ts';
import { projectHref, withRef } from '#lib/util.ts';

export const load: PageServerLoad = async ({ params, parent, url, depends }) => {
    depends('bitlin:refs');
    const { project } = await parent();
    const id = await findSnapshotByPrefix(project.id, params.id);
    if (!id) error(404, 'Snapshot not found');
    const snap = (await getSnapshot(project.id, id))!;
    const baseId = url.searchParams.get('base') ? await findSnapshotByPrefix(project.id, url.searchParams.get('base')!) : (snap.parents[0] ?? null);
    const baseSnap = baseId ? await getSnapshot(project.id, baseId) : null;

    const infos = await snapshotInfos(project.id, [id, ...snap.parents]);
    const [tags, heads] = await Promise.all([
        db.q<{ name: string }>('SELECT name FROM tags WHERE project_id = $1 AND snapshot_id = $2', [project.id, id]),
        db.q<{ name: string }>('SELECT name FROM branches WHERE project_id = $1 AND head = $2 AND tracking IS NULL', [project.id, id])
    ]);
    const changes = diffTrees(baseSnap?.tree ?? null, snap.tree);
    return {
        snapshot: infos.get(id)!,
        parents: snap.parents.map((p) => infos.get(p)).filter(Boolean) as NonNullable<ReturnType<typeof infos.get>>[],
        baseId,
        fileCount: Object.keys(snap.tree).length,
        diffs: await buildFileDiffs(changes),
        tags: tags.map((t) => t.name),
        heads: heads.map((h) => h.name)
    };
};

async function ctx(event: Parameters<Actions[string]>[0]) {
    const g = await guard(event.params, event.locals.user, 'write');
    const id = await findSnapshotByPrefix(g.project.id, event.params.id);
    if (!id) error(404, 'Snapshot not found');
    return { ...g, id, base: projectHref(g.project.owner_username, g.project.name) };
}

export const actions: Actions = {
    restore: async (event) => {
        const { project, user, id, base } = await ctx(event);
        await enforce(event, 'restore');
        const f = await event.request.formData();
        const branch = String(f.get('branch') ?? project.default_branch);
        const paths = f.getAll('paths').map(String).flatMap((s) => s.split('\n')).map((s) => s.trim()).filter(Boolean);
        await restoreSnapshot(project.id, user, branch, id, paths);
        redirect(303, `${base}/snapshots${withRef('', branch, project.default_branch)}`);
    },
    branch: async (event) => {
        const { project, user, id, base } = await ctx(event);
        await enforce(event, 'branch');
        const name = String((await event.request.formData()).get('name') ?? '').trim();
        await createBranch(project.id, user, name, id);
        redirect(303, `${base}/files/?ref=${encodeURIComponent(name)}`);
    },
    tag: async (event) => {
        const { project, user, id, base } = await ctx(event);
        await enforce(event, 'tag');
        const f = await event.request.formData();
        const name = String(f.get('name') ?? '').trim();
        await createTag(project.id, user, name, id, String(f.get('message') ?? ''), String(f.get('notes') ?? ''));
        redirect(303, `${base}/tags/${name}`);
    }
};
