import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getProfileById, updateProfile } from '#lib/server/users.ts';
import { enforce } from '#lib/server/ratelimit.ts';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) redirect(303, '/');
    if (locals.user.onboarded) redirect(303, '/dashboard');
    return { profile: await getProfileById(locals.user.id) };
};

export const actions: Actions = {
    default: async (event) => {
        const user = event.locals.user;
        if (!user) redirect(303, '/');
        await enforce(event, 'settings');
        const f = await event.request.formData();
        const current = await getProfileById(user.id);
        await updateProfile(
            user.id,
            {
                username: String(f.get('username') ?? '').trim().toLowerCase(),
                display_name: String(f.get('display_name') ?? ''),
                bio: current?.bio ?? '',
                timezone: String(f.get('timezone') || 'UTC'),
                region: String(f.get('region') ?? '') || null
            },
            true
        );
        redirect(303, '/dashboard');
    }
};
