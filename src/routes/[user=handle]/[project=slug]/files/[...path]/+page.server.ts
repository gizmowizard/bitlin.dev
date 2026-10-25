import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { headTree } from '#lib/server/vcs/drafts.ts';
import { dirExists, listDir, normalizePath } from '#lib/server/vcs/paths.ts';
import { getBlob } from '#lib/server/storage.ts';
import { decodeText } from '#lib/server/vcs/diff.ts';
import { renderMarkdown } from '#lib/server/markdown.ts';
import { fileExt, IMAGE_TYPES } from '#lib/util.ts';

const MAX_TEXT = 512 * 1024;
const MAX_LINES = 6000;

export const load: PageServerLoad = async ({ params, parent }) => {
    const { project, ref } = await parent();
    const raw = params.path ?? '';
    const path = raw ? normalizePath(raw) : '';
    if (path === null) error(404, 'Not found');
    const tree = await headTree(project.id, ref.snapshot);
    const entry = path ? tree[path] : undefined;

    if (!entry) {
        if (!dirExists(tree, path) || (!ref.snapshot && path)) error(404, `“${path}” doesn't exist at ${ref.name}.`);
        return { kind: 'dir' as const, path, entries: listDir(tree, path) };
    }

    const ext = fileExt(path);
    const info = { kind: 'file' as const, path, size: entry.s, hash: entry.h };
    if (IMAGE_TYPES[ext]) return { ...info, type: 'image' as const };
    if (entry.s > MAX_TEXT) return { ...info, type: 'large' as const };
    const text = decodeText(await getBlob(entry.h));
    if (text === null) return { ...info, type: 'binary' as const };

    const lines = text.split('\n');
    if (lines.at(-1) === '') lines.pop();
    const isMd = ext === 'md' || ext === 'markdown';
    return {
        ...info,
        type: 'text' as const,
        lines: lines.slice(0, MAX_LINES),
        truncated: lines.length > MAX_LINES,
        lineCount: lines.length,
        html: isMd ? renderMarkdown(text, { rawBase: `/*${project.owner.username}/${project.name}/raw` }) : null
    };
};
