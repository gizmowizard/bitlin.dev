import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { db } from '#lib/server/db.ts';
import { snapshotInfos } from '#lib/server/vcs/snapshots.ts';
import { deleteTag, updateTagNotes } from '#lib/server/ops.ts';
import { renderMarkdown } from '#lib/server/markdown.ts';
import { projectHref } from '#lib/util.ts';

export const load: PageServerLoad = async ({ params, parent, depends }) => {
    depends('bitlin:refs');
    const { project } = await parent();
    const tag = await db.one<{ name: string; snapshot_id: string; message: string; notes: string; created_at: Date }>('SELECT name, snapshot_id, message, notes, created_at FROM tags WHERE project_id = $1 AND name = $2', [project.id, params.tag]);
    if (!tag) error(404, 'Tag not found');
    const info = (await snapshotInfos(project.id, [tag.snapshot_id])).get(tag.snapshot_id) ?? null;
    return { tag, info, html: renderMarkdown(tag.notes, { rawBase: `/*${project.owner.username}/${project.name}/raw` }) };
};

export const actions: Actions = {
    update: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'write');
        await enforce(event, 'tag');
        const f = await event.request.formData();
        await updateTagNotes(project.id, user, event.params.tag, String(f.get('message') ?? ''), String(f.get('notes') ?? ''));
        return { ok: true };
    },
    delete: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'write');
        await enforce(event, 'tag');
        await deleteTag(project.id, user, event.params.tag);
        redirect(303, `${projectHref(project.owner_username, project.name)}/tags`);
    }
};
