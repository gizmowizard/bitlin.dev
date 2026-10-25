import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession } from '#lib/server/auth.ts';
import { closeSessionSockets } from '#lib/server/ws/hub.ts';

export const POST: RequestHandler = async ({ cookies }) => {
    const hash = await destroySession(cookies);
    if (hash) closeSessionSockets(hash);
    redirect(303, '/');
};
