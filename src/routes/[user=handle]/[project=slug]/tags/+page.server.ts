import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { db } from '#lib/server/db.ts';
import { snapshotInfos } from '#lib/server/vcs/snapshots.ts';
import { createTag } from '#lib/server/ops.ts';
import { resolveRef } from '#lib/server/vcs/refs.ts';
import { projectHref } from '#lib/util.ts';

export const load: PageServerLoad = async ({ parent, depends }) => {
    depends('bitlin:refs');
    const { project } = await parent();
    const tags = await db.q<{ name: string; snapshot_id: string; message: string; created_at: Date }>('SELECT name, snapshot_id, message, created_at FROM tags WHERE project_id = $1 ORDER BY created_at DESC LIMIT 200', [project.id]);
    const infos = await snapshotInfos(project.id, tags.map((t) => t.snapshot_id));
    return { tags: tags.map((t) => ({ ...t, info: infos.get(t.snapshot_id) ?? null })) };
};

export const actions: Actions = {
    create: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'write');
        await enforce(event, 'tag');
        const f = await event.request.formData();
        const ref = await resolveRef(project.id, String(f.get('ref') ?? '') || null, project.default_branch);
        const name = String(f.get('name') ?? '').trim();
        if (!ref?.snapshot) throw (await import('@sveltejs/kit')).error(400, 'Choose something with at least one snapshot to tag.');
        await createTag(project.id, user, name, ref.snapshot, String(f.get('message') ?? ''), String(f.get('notes') ?? ''));
        redirect(303, `${projectHref(project.owner_username, project.name)}/tags/${name}`);
    }
};
