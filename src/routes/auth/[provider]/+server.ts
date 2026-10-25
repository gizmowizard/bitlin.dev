import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { beginAuth, PROVIDER_IDS } from '#lib/server/oauth.ts';
import { sign } from '#lib/server/crypto.ts';
import { config } from '#lib/server/config.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { safeNext } from '#lib/util.ts';

export const GET: RequestHandler = async (event) => {
    const { provider } = event.params;
    if (!PROVIDER_IDS.includes(provider)) error(404, 'Unknown sign-in provider');
    await enforce(event, 'auth');
    const link = event.url.searchParams.get('link') === '1';
    if (link && !event.locals.user) redirect(303, '/#signin');

    const { url, state, verifier } = beginAuth(provider);
    const payload = JSON.stringify({ state, verifier, provider, link, next: safeNext(event.url.searchParams.get('next')) });
    event.cookies.set('bitlin_oauth', sign(Buffer.from(payload).toString('base64url')), {
        path: '/auth',
        httpOnly: true,
        sameSite: 'lax',
        secure: config.prod,
        maxAge: 600
    });

    //inspect uri because something is trggering svelte's inbuilt errors
    console.log('[oauth] URL:', url);
    redirect(302, url);
};
