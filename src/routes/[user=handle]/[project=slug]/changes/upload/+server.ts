import { error, json } from '@sveltejs/kit';
import { unzipSync } from 'fflate';
import type { RequestHandler } from './$types';
import { guard } from '#lib/server/guard.ts';
import { config } from '#lib/server/config.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { headTree, stageFiles, type StageInput } from '#lib/server/vcs/drafts.ts';
import { resolveRef } from '#lib/server/vcs/refs.ts';
import { notifyUser } from '#lib/server/events.ts';

function readZip(data: Uint8Array): StageInput[] {
    let total = 0;
    let count = 0;
    let entries: Record<string, Uint8Array>;
    try {
        // The filter runs on headers before inflating, which is what defuses zip bombs.
        entries = unzipSync(data, {
            filter: (f) => {
                if (f.name.endsWith('/')) return false;
                total += f.originalSize;
                if (++count > config.limits.maxFiles * 2 || total > config.limits.maxUnzipBytes) throw new Error('too big');
                return true;
            }
        });
    } catch (e) {
        error(413, (e as Error).message === 'too big' ? 'That ZIP expands to more than the allowed size.' : 'That ZIP could not be read.');
    }
    const names = Object.keys(entries).filter((n) => !n.startsWith('__MACOSX/'));
    // GitHub-style archives wrap everything in one folder; unwrap it.
    const roots = new Set(names.map((n) => n.split('/')[0]));
    const strip = roots.size === 1 && names.every((n) => n.includes('/')) ? `${[...roots][0]}/` : '';
    return names.map((n) => ({ path: n.slice(strip.length), data: Buffer.from(entries[n]) }));
}

export const POST: RequestHandler = async (event) => {
    const { project, user } = await guard(event.params, event.locals.user, 'write');
    await enforce(event, 'upload');
    const ref = await resolveRef(project.id, event.url.searchParams.get('ref'), project.default_branch);
    if (!ref?.branch) error(400, 'Switch to a branch to upload files.');

    const len = Number(event.request.headers.get('content-length') ?? 0);
    if (len > config.limits.maxUploadBytes) error(413, 'That upload is too large. Try fewer files at a time.');

    const form = await event.request.formData().catch(() => error(400, 'Malformed upload'));
    const dir = String(form.get('dir') ?? '').replace(/^\/+|\/+$/g, '');
    const inputs: StageInput[] = [];
    let pendingPath: string | null = null;
    for (const [key, value] of form.entries()) {
        if (key === 'path' && typeof value === 'string') pendingPath = value;
        else if (key === 'file' && typeof value !== 'string') {
            const buf = Buffer.from(await value.arrayBuffer());
            const name = pendingPath ?? value.name;
            pendingPath = null;
            if (/\.zip$/i.test(name) && form.get('unzip') === '1') inputs.push(...readZip(buf).map((z) => ({ ...z, path: dir ? `${dir}/${z.path}` : z.path })));
            else inputs.push({ path: dir ? `${dir}/${name}` : name, data: buf });
        }
    }
    if (!inputs.length) error(400, 'No files were received.');

    const head = await headTree(project.id, ref.snapshot);
    const r = await stageFiles(project.id, user.id, ref.branch, head, project.ignore_rules, inputs);
    notifyUser(user.id, 'draft.updated', { project: project.id, branch: ref.branch });
    return json({ staged: r.staged, unchanged: r.unchanged, ignored: r.ignored.length, tooLarge: r.tooLarge, invalid: r.invalid.length });
};
