import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncGuard } from '#lib/server/guard.ts';
import { syncRefs } from '#lib/server/sync.ts';

export const GET: RequestHandler = async (event) => {
    const { project } = await syncGuard(event, 'read');
    return json(await syncRefs(project));
};
