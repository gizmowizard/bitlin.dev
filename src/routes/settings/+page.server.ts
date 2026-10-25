import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getProfileById, updateProfile } from '#lib/server/users.ts';
import { enforce } from '#lib/server/ratelimit.ts';

export const load: PageServerLoad = async ({ locals }) => ({ profile: (await getProfileById(locals.user!.id))! });

export const actions: Actions = {
    default: async (event) => {
        await enforce(event, 'settings');
        const f = await event.request.formData();
        await updateProfile(event.locals.user!.id, {
            username: String(f.get('username') ?? '').trim().toLowerCase(),
            display_name: String(f.get('display_name') ?? ''),
            bio: String(f.get('bio') ?? '').replace(/\r\n/g, '\n'),
            timezone: String(f.get('timezone') || 'UTC'),
            region: String(f.get('region') ?? '') || null
        });
        return { saved: true };
    }
};
