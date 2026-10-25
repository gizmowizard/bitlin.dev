import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProfile } from '#lib/server/users.ts';
import { projectsOwnedBy } from '#lib/server/projects.ts';
import { renderMarkdown } from '#lib/server/markdown.ts';
import { plainText } from '#lib/util.ts';

export const load: PageServerLoad = async ({ params, locals, depends }) => {
    depends('bitlin:profile');
    const profile = await getProfile(params.user.slice(1));
    if (!profile) error(404, 'No such user');
    if (profile.username !== params.user.slice(1)) redirect(301, `/*${profile.username}`);
    const projects = await projectsOwnedBy(profile.id, locals.user?.id ?? null);
    return {
        profile: { ...profile, bio_html: renderMarkdown(profile.bio), bio_text: plainText(profile.bio) },
        projects,
        isSelf: locals.user?.id === profile.id
    };
};
