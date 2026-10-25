import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createProject } from '#lib/server/projects.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { IGNORE_TEMPLATES } from '#lib/ignore-templates.ts';
import { projectHref } from '#lib/util.ts';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) redirect(303, '/#signin');
    return { templates: Object.keys(IGNORE_TEMPLATES) };
};

export const actions: Actions = {
    default: async (event) => {
        const user = event.locals.user;
        if (!user) redirect(303, '/#signin');
        await enforce(event, 'project.create');
        const f = await event.request.formData();
        const p = await createProject(user, {
            name: String(f.get('name') ?? '').trim(),
            description: String(f.get('description') ?? ''),
            visibility: String(f.get('visibility') ?? 'public'),
            templates: f.getAll('templates').map(String)
        });
        redirect(303, projectHref(user.username, p.name));
    }
};
