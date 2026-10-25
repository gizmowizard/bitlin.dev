import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '#lib/server/db.ts';
import { createApiToken } from '#lib/server/auth.ts';
import { enforce } from '#lib/server/ratelimit.ts';

export const load: PageServerLoad = async ({ locals, depends }) => {
    depends('bitlin:tokens');
    return {
        tokens: await db.q<{ id: string; name: string; prefix: string; can_write: boolean; last_used_at: Date | null; created_at: Date }>(
            'SELECT id, name, prefix, can_write, last_used_at, created_at FROM api_tokens WHERE user_id = $1 ORDER BY created_at DESC',
            [locals.user!.id]
        )
    };
};

export const actions: Actions = {
    create: async (event) => {
        await enforce(event, 'settings');
        const f = await event.request.formData();
        const name = String(f.get('name') ?? '').trim();
        if (!name || name.length > 60) return fail(400, { message: 'Give the token a name (up to 60 characters).' });
        const count = await db.one<{ n: number }>('SELECT count(*)::int AS n FROM api_tokens WHERE user_id = $1', [event.locals.user!.id]);
        if ((count?.n ?? 0) >= 25) return fail(400, { message: 'You have too many tokens. Revoke some first.' });
        return { token: await createApiToken(event.locals.user!.id, name, f.get('write') === 'on') };
    },
    revoke: async (event) => {
        await enforce(event, 'settings');
        const id = String((await event.request.formData()).get('id'));
        await db.q('DELETE FROM api_tokens WHERE id = $1 AND user_id = $2', [id, event.locals.user!.id]);
        return { revoked: true };
    }
};
