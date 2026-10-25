import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncGuard } from '#lib/server/guard.ts';
import { syncSnapshots } from '#lib/server/sync.ts';

export const GET: RequestHandler = async (event) => {
    const { project } = await syncGuard(event, 'read');
    const have = (event.url.searchParams.get('have') ?? '').split(',').filter(Boolean);
    return json(await syncSnapshots(project.id, event.url.searchParams.get('want') ?? '', have));
};
