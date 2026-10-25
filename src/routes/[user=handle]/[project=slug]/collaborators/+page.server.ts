import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { addCollaborator, listCollaborators, removeCollaborator } from '#lib/server/projects.ts';

export const load: PageServerLoad = async ({ parent, depends }) => {
    depends('bitlin:people');
    const { project } = await parent();
    return { people: await listCollaborators(project.id) };
};

export const actions: Actions = {
    add: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'admin');
        await enforce(event, 'collab');
        const f = await event.request.formData();
        await addCollaborator(project, user, String(f.get('username') ?? ''), String(f.get('role') ?? 'write'));
        return { ok: true };
    },
    remove: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'admin');
        await enforce(event, 'collab');
        await removeCollaborator(project.id, user.id, String((await event.request.formData()).get('id')));
        return { ok: true };
    },
    leave: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'read');
        await enforce(event, 'collab');
        if (project.owner_id === user.id) error(400, 'Owners cannot leave their own project.');
        await removeCollaborator(project.id, user.id, user.id);
        redirect(303, '/dashboard');
    }
};
