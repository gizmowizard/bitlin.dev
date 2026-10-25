import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteAccount, listIdentities, unlinkIdentity } from '#lib/server/users.ts';
import { enabledProviders } from '#lib/server/oauth.ts';
import { destroySession } from '#lib/server/auth.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => ({
    identities: await listIdentities(locals.user!.id),
    providers: enabledProviders()
});

export const actions: Actions = {
    unlink: async (event) => {
        await enforce(event, 'settings');
        const provider = String((await event.request.formData()).get('provider'));
        await unlinkIdentity(event.locals.user!.id, provider);
        return { ok: true };
    },
    delete: async (event) => {
        await enforce(event, 'settings');
        const f = await event.request.formData();
        if (String(f.get('confirm')) !== event.locals.user!.username) return fail(400, { message: 'Type your username to confirm.' });
        await deleteAccount(event.locals.user!.id);
        await destroySession(event.cookies);
        redirect(303, '/');
    }
};
