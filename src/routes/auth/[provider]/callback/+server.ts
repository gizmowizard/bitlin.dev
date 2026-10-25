import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { completeAuth } from '#lib/server/oauth.ts';
import { signInWithIdentity } from '#lib/server/users.ts';
import { createSession } from '#lib/server/auth.ts';
import { unsign } from '#lib/server/crypto.ts';
import { enforce } from '#lib/server/ratelimit.ts';

export const GET: RequestHandler = async (event) => {
    await enforce(event, 'auth');
    const { provider } = event.params;
    const raw = event.cookies.get('bitlin_oauth');
    event.cookies.delete('bitlin_oauth', { path: '/auth' });

    const value = raw ? unsign(raw) : null;
    let saved: { state: string; verifier: string; provider: string; link: boolean; next: string | null } | null = null;
    try {
        saved = value ? JSON.parse(Buffer.from(value, 'base64url').toString()) : null;
    } catch {
        saved = null;
    }
    if (event.url.searchParams.get('error')) redirect(303, '/?error=cancelled');
    const code = event.url.searchParams.get('code');
    if (!saved || saved.provider !== provider || saved.state !== event.url.searchParams.get('state') || !code) {
        error(400, 'Your sign-in session expired. Please try again.');
    }

    const profile = await completeAuth(provider, code, saved.verifier);
    const linkTo = saved.link ? (event.locals.user?.id ?? null) : null;
    const { userId, created } = await signInWithIdentity(provider, profile, linkTo);

    if (saved.link) redirect(303, '/settings/accounts');
    await createSession(event.cookies, userId, event.request.headers.get('user-agent'));
    redirect(303, created ? '/welcome' : (saved.next ?? '/dashboard'));
};
