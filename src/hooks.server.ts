import { error, redirect } from '@sveltejs/kit';
import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit/hooks';
import { config } from '#lib/server/config.ts';
import { ensureBootstrapped } from '#lib/server/bootstrap.ts';
import { installUpgrade } from '#lib/server/ws/upgrade.ts';
import { refreshSession, sessionUser, SESSION_COOKIE } from '#lib/server/auth.ts';
import { clientIp, limit } from '#lib/server/ratelimit.ts';

export const init: ServerInit = async () => {
    installUpgrade();
    await ensureBootstrapped();
};

const ONBOARDING_OK = ['/welcome', '/auth/logout', '/api/markdown', '/tos', '/privacy'];
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const handle: Handle = async ({ event, resolve }) => {
    installUpgrade();
    await ensureBootstrapped();
    const { pathname } = event.url;

    // Cookie-authenticated mutations must come from our own origin (sync API uses bearer tokens instead).
    const origin = event.request.headers.get('origin');
    if (UNSAFE.has(event.request.method) && origin && !pathname.startsWith('/api/sync/') && config.prod && origin !== config.origin) {
        error(403, 'Cross-origin request blocked');
    }

    const token = event.cookies.get(SESSION_COOKIE);
    const session = await sessionUser(token);
    event.locals.user = session?.user ?? null;
    event.locals.sessionHash = session?.hash ?? null;
    if (token && !session) event.cookies.delete(SESSION_COOKIE, { path: '/' });
    if (token && session && Math.random() < 0.05) await refreshSession(event.cookies, token);

    const key = session?.user.id ?? clientIp(event, config.ipHeader);
    const rl = await limit('api', key);
    if (!rl.ok) {
        return new Response('Too many requests. Slow down a little.', { status: 429, headers: { 'retry-after': String(rl.retryAfter) } });
    }

    if (event.locals.user && !event.locals.user.onboarded && !ONBOARDING_OK.includes(pathname) && !pathname.startsWith('/_app') && event.request.method === 'GET' && !pathname.startsWith('/api/')) {
        redirect(303, '/welcome');
    }

    const response = await resolve(event);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (config.prod) response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return response;
};

export const handleError: HandleServerError = ({ error: err, event }) => {
    const status = (err as { status?: number })?.status ?? 500;
    if (status !== 404) console.error(`[error] ${event.request.method} ${event.url.pathname}`, err);
    return { message: status === 404 ? 'Not found' : 'Something went wrong on our side.' };
};