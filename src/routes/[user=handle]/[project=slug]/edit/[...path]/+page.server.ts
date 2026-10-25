import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { db } from '#lib/server/db.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { headTree, stageDelete, stageFiles } from '#lib/server/vcs/drafts.ts';
import { normalizePath } from '#lib/server/vcs/paths.ts';
import { decodeText } from '#lib/server/vcs/diff.ts';
import { resolveRef } from '#lib/server/vcs/refs.ts';
import { getBlob } from '#lib/server/storage.ts';
import { notifyUser } from '#lib/server/events.ts';
import { can } from '#lib/access.ts';
import { projectHref, withRef } from '#lib/util.ts';

const MAX_EDIT = 512 * 1024;

export const load: PageServerLoad = async ({ params, parent, locals }) => {
    const { project, ref, role } = await parent();
    if (!locals.user) redirect(303, '/#signin');
    if (!can(role, 'write')) error(403, 'You need write access to edit files.');
    if (!ref.branch) error(400, 'Switch to one of your branches to edit files.');
    const raw = params.path ?? '';
    const isNew = raw === '' || raw.endsWith('/');
    const path = isNew ? raw.replace(/\/$/, '') : normalizePath(raw);
    if (path === null) error(404, 'Not found');

    if (isNew) return { isNew: true as const, path: path ? `${path}/` : '', content: '' };
    const tree = await headTree(project.id, ref.snapshot);
    const staged = await db.one<{ op: string; hash: string | null }>('SELECT op, hash FROM draft_changes WHERE project_id = $1 AND user_id = $2 AND branch = $3 AND path = $4', [project.id, locals.user.id, ref.branch, path]);
    const hash = staged?.op === 'put' ? staged.hash : tree[path]?.h;
    if (!hash) error(404, 'That file does not exist on this branch.');
    const buf = await getBlob(hash);
    const text = buf.length <= MAX_EDIT ? decodeText(buf) : null;
    if (text === null) error(415, 'Only text files up to 512 KB can be edited in the browser.');
    return { isNew: false as const, path, content: text, stagedAlready: !!staged };
};

export const actions: Actions = {
    default: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'write');
        await enforce(event, 'stage');
        const ref = await resolveRef(project.id, event.url.searchParams.get('ref'), project.default_branch);
        if (!ref?.branch) error(400, 'Switch to a branch to edit files.');
        const f = await event.request.formData();
        const target = normalizePath(String(f.get('path') ?? ''));
        if (!target) return fail(400, { message: 'Enter a valid file path.' });
        const original = String(f.get('original') ?? '');
        const content = String(f.get('content') ?? '');
        if (Buffer.byteLength(content) > MAX_EDIT) return fail(400, { message: 'That file is too large to save from the editor.' });

        const head = await headTree(project.id, ref.snapshot);
        if (!original && head[target]) return fail(409, { message: `“${target}” already exists. Edit it instead.` });
        const r = await stageFiles(project.id, user.id, ref.branch, head, project.ignore_rules, [{ path: target, data: Buffer.from(content, 'utf8') }]);
        if (r.ignored.length) return fail(400, { message: 'That path matches an ignore rule, so Bitlin won’t track it.' });
        if (original && original !== target) await stageDelete(project.id, user.id, ref.branch, head, original);
        notifyUser(user.id, 'draft.updated', { project: project.id, branch: ref.branch });
        redirect(303, `${projectHref(project.owner_username, project.name)}/changes${withRef('', ref.branch, project.default_branch)}`);
    }
};
