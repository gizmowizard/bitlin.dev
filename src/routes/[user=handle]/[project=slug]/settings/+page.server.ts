import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { deleteProject, forkProject, renameProject, updateProjectSettings } from '#lib/server/projects.ts';
import { projectHref } from '#lib/util.ts';
import { can } from '#lib/access.ts';

export const load: PageServerLoad = async ({ parent }) => {
    const { role } = await parent();
    if (!can(role, 'admin')) error(403, 'Only admins can change project settings.');
    return {};
};

export const actions: Actions = {
    save: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'admin');
        await enforce(event, 'settings');
        const f = await event.request.formData();
        await updateProjectSettings(project.id, user.id, { description: String(f.get('description') ?? ''), visibility: String(f.get('visibility') ?? 'public') });
        return { ok: true };
    },
    rename: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'owner');
        await enforce(event, 'settings');
        const name = String((await event.request.formData()).get('name') ?? '').trim();
        await renameProject(project.id, user.id, name);
        redirect(303, `${projectHref(project.owner_username, name)}/settings`);
    },
    delete: async (event) => {
        const { project } = await guard(event.params, event.locals.user, 'owner');
        await enforce(event, 'settings');
        if (String((await event.request.formData()).get('confirm')) !== project.name) return fail(400, { message: 'Type the project name to confirm.' });
        await deleteProject(project.id);
        redirect(303, '/dashboard');
    },
    // Lives here so the header's Fork button has an action to post to; any signed-in reader may fork.
    fork: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'read');
        await enforce(event, 'fork');
        const fork = await forkProject(user, project);
        redirect(303, projectHref(user.username, fork.name));
    }
};
