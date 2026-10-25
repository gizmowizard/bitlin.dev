import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncGuard } from '#lib/server/guard.ts';
import { can } from '#lib/access.ts';
import { receivePush } from '#lib/server/sync.ts';

export const POST: RequestHandler = async (event) => {
    const { project, user, role } = await syncGuard(event, 'write');
    const phase = event.params.phase;
    if (phase !== 'begin' && phase !== 'commit') error(404, 'Unknown push phase');
    const body = await event.request.json().catch(() => error(400, 'Malformed JSON'));
    const res = await receivePush(project, user!, can(role, 'admin'), body, phase === 'commit');
    return json(res);
};
