import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncGuard } from '#lib/server/guard.ts';
import { config } from '#lib/server/config.ts';
import { receiveBlob, syncBlob } from '#lib/server/sync.ts';

export const GET: RequestHandler = async (event) => {
    const { project } = await syncGuard(event, 'read');
    const data = await syncBlob(project.id, event.params.hash);
    return new Response(new Uint8Array(data), { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, max-age=31536000, immutable' } });
};

export const PUT: RequestHandler = async (event) => {
    const { project } = await syncGuard(event, 'write');
    const len = Number(event.request.headers.get('content-length') ?? 0);
    if (len > config.limits.maxFileBytes) error(413, 'File too large');
    await receiveBlob(project, event.params.hash, Buffer.from(await event.request.arrayBuffer()));
    return new Response(null, { status: 204 });
};
