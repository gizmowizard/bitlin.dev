import { error } from '@sveltejs/kit';
import { zipSync } from 'fflate';
import type { RequestHandler } from './$types';
import { guard } from '#lib/server/guard.ts';
import { resolveRef } from '#lib/server/vcs/refs.ts';
import { headTree } from '#lib/server/vcs/drafts.ts';
import { getBlob } from '#lib/server/storage.ts';
import { enforce } from '#lib/server/ratelimit.ts';

const MAX_ZIP = 150 * 1024 * 1024;

export const GET: RequestHandler = async (event) => {
    const { project } = await guard(event.params, event.locals.user, 'read');
    await enforce(event, 'download');
    const ref = await resolveRef(project.id, event.url.searchParams.get('ref'), project.default_branch);
    if (!ref?.snapshot) error(404, 'Nothing to download yet.');
    const tree = await headTree(project.id, ref.snapshot);
    const total = Object.values(tree).reduce((n, e) => n + e.s, 0);
    if (total > MAX_ZIP) error(413, 'This version is too large to download as one ZIP.');

    const files: Record<string, Uint8Array> = {};
    const root = `${project.name}-${ref.name.replace(/[^\w.-]+/g, '_')}`;
    for (const [path, e] of Object.entries(tree)) files[`${root}/${path}`] = new Uint8Array(await getBlob(e.h));
    return new Response(new Uint8Array(zipSync(files, { level: 6 })), {
        headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${root}.zip"`, 'Cache-Control': 'private, no-store' }
    });
};
