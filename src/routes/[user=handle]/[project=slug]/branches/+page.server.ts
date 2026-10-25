import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { aheadBehind, snapshotInfos } from '#lib/server/vcs/snapshots.ts';
import { resolveRef } from '#lib/server/vcs/refs.ts';
import { createBranch, deleteBranch, renameBranch, setDefaultBranch } from '#lib/server/ops.ts';
import { projectHref } from '#lib/util.ts';

export const load: PageServerLoad = async ({ parent, depends }) => {
    depends('bitlin:refs');
    const { project, branches } = await parent();
    const defHead = branches.find((b) => b.name === project.default_branch)?.head ?? null;
    const infos = await snapshotInfos(project.id, branches.map((b) => b.head).filter(Boolean) as string[]);
    const rows = await Promise.all(
        branches.slice(0, 60).map(async (b) => ({
            ...b,
            info: (b.head && infos.get(b.head)) || null,
            ...(b.name === project.default_branch ? { ahead: 0, behind: 0 } : await aheadBehind(project.id, b.head, defHead))
        }))
    );
    return { rows };
};

export const actions: Actions = {
    create: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'write');
        await enforce(event, 'branch');
        const f = await event.request.formData();
        const name = String(f.get('name') ?? '').trim();
        const from = await resolveRef(project.id, String(f.get('from') ?? '') || null, project.default_branch);
        await createBranch(project.id, user, name, from?.snapshot ?? null);
        redirect(303, `${projectHref(project.owner_username, project.name)}/files/?ref=${encodeURIComponent(name)}`);
    },
    delete: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'write');
        await enforce(event, 'branch');
        await deleteBranch(project.id, user, String((await event.request.formData()).get('name')), project.default_branch);
        return { ok: true };
    },
    rename: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'admin');
        await enforce(event, 'branch');
        const f = await event.request.formData();
        await renameBranch(project.id, user, String(f.get('from')), String(f.get('to') ?? '').trim());
        return { ok: true };
    },
    makeDefault: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'admin');
        await enforce(event, 'branch');
        await setDefaultBranch(project.id, user, String((await event.request.formData()).get('name')));
        return { ok: true };
    }
};
