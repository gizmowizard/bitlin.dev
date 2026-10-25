import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { collaboratingProjects, feedForUser, projectsOwnedBy } from '#lib/server/projects.ts';

export const load: PageServerLoad = async ({ locals, depends }) => {
    if (!locals.user) redirect(303, '/#signin');
    depends('bitlin:dashboard');
    const [mine, collabs, feed] = await Promise.all([projectsOwnedBy(locals.user.id, locals.user.id), collaboratingProjects(locals.user.id), feedForUser(locals.user.id)]);
    return { mine, collabs, feed };
};
