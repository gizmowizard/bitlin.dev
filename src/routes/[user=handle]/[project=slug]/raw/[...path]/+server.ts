import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { guard } from '#lib/server/guard.ts';
import { resolveRef } from '#lib/server/vcs/refs.ts';
import { headTree } from '#lib/server/vcs/drafts.ts';
import { getBlob } from '#lib/server/storage.ts';
import { decodeText } from '#lib/server/vcs/diff.ts';
import { normalizePath } from '#lib/server/vcs/paths.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { fileExt, IMAGE_TYPES } from '#lib/util.ts';

export const GET: RequestHandler = async (event) => {
    const { project } = await guard(event.params, event.locals.user, 'read');
    await enforce(event, 'download');
    const path = normalizePath(event.params.path);
    if (!path) error(404, 'Not found');
    const ref = await resolveRef(project.id, event.url.searchParams.get('ref'), project.default_branch);
    const entry = ref ? (await headTree(project.id, ref.snapshot))[path] : undefined;
    if (!entry) error(404, 'File not found');

    const buf = await getBlob(entry.h);
    const image = IMAGE_TYPES[fileExt(path)];
    const isText = !image && decodeText(buf) !== null;
    const name = path.split('/').pop()!.replace(/[^\w.\- ]/g, '_');
    const download = event.url.searchParams.has('download');

    // User files must never execute: serve as inert text/images inside a sandbox.
    return new Response(new Uint8Array(buf), {
        headers: {
            'Content-Type': image ?? (isText ? 'text/plain; charset=utf-8' : 'application/octet-stream'),
            'Content-Disposition': `${download || (!image && !isText) ? 'attachment' : 'inline'}; filename="${name}"`,
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': project.visibility === 'public' ? 'public, max-age=60' : 'private, max-age=60',
            ETag: `"${entry.h}"`
        }
    });
};
