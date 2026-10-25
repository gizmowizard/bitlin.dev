import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { annotateDraft, commitDraft, discardDraft, headTree, listDraft, stageDelete } from '#lib/server/vcs/drafts.ts';
import { buildFileDiffs, type FileChange } from '#lib/server/vcs/diff.ts';
import { resolveRef } from '#lib/server/vcs/refs.ts';
import { announceSnapshot } from '#lib/server/ops.ts';
import { notifyUser } from '#lib/server/events.ts';
import { can } from '#lib/access.ts';
import { projectHref, withRef } from '#lib/util.ts';

export const load: PageServerLoad = async ({ parent, locals, depends }) => {
    depends('bitlin:changes', 'bitlin:refs');
    const { project, ref, role } = await parent();
    if (!locals.user) redirect(303, '/#signin');
    if (!can(role, 'write')) error(403, 'You need write access to stage changes.');
    if (!ref.branch) return { readOnly: true as const, changes: [], diffs: [], head: ref.snapshot };

    const head = await headTree(project.id, ref.snapshot);
    const changes = annotateDraft(await listDraft(project.id, locals.user.id, ref.branch), head);
    const fc: FileChange[] = changes.map((c) => ({
        path: c.path,
        status: c.status,
        old: head[c.path],
        new: c.op === 'put' ? { h: c.hash!, s: c.size! } : undefined
    }));
    return { readOnly: false as const, changes, diffs: await buildFileDiffs(fc), head: ref.snapshot };
};

async function context(event: Parameters<Actions[string]>[0]) {
    const g = await guard(event.params, event.locals.user, 'write');
    const ref = await resolveRef(g.project.id, event.url.searchParams.get('ref'), g.project.default_branch);
    if (!ref?.branch) error(400, 'Switch to a branch to change files.');
    return { ...g, branch: ref.branch };
}

export const actions: Actions = {
    commit: async (event) => {
        const { project, user, branch } = await context(event);
        await enforce(event, 'snapshot');
        const f = await event.request.formData();
        const message = String(f.get('message') ?? '').trim();
        if (!message) return fail(400, { message: 'Write a short note describing this snapshot.' });
        if (message.length > 5000) return fail(400, { message: 'That note is too long.' });
        const res = await commitDraft({ projectId: project.id, userId: user.id, authorName: user.username, branch, message, force: f.get('force') === 'on' });
        await announceSnapshot(project.id, user, branch, res.snapshot.id, message, res.files);
        notifyUser(user.id, 'draft.updated', { project: project.id, branch });
        redirect(303, `${projectHref(project.owner_username, project.name)}/snapshots/${res.snapshot.id}${withRef('', branch, project.default_branch)}`);
    },
    discard: async (event) => {
        const { project, user, branch } = await context(event);
        await enforce(event, 'stage');
        const path = String((await event.request.formData()).get('path') ?? '');
        await discardDraft(project.id, user.id, branch, path || undefined);
        notifyUser(user.id, 'draft.updated', { project: project.id, branch });
        return { ok: true };
    },
    stageDelete: async (event) => {
        const { project, user, branch } = await context(event);
        await enforce(event, 'stage');
        const path = String((await event.request.formData()).get('path') ?? '');
        const ref = await resolveRef(project.id, branch, project.default_branch);
        const n = await stageDelete(project.id, user.id, branch, await headTree(project.id, ref?.snapshot ?? null), path);
        if (!n) return fail(404, { message: 'Nothing to delete at that path.' });
        notifyUser(user.id, 'draft.updated', { project: project.id, branch });
        redirect(303, `${projectHref(project.owner_username, project.name)}/changes${withRef('', branch, project.default_branch)}`);
    }
};
