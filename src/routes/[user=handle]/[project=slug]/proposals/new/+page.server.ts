import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { db } from '#lib/server/db.ts';
import { roleFor } from '#lib/server/access.ts';
import { can } from '#lib/access.ts';
import { listBranches } from '#lib/server/vcs/refs.ts';
import { createProposal } from '#lib/server/proposals.ts';
import { projectHref } from '#lib/util.ts';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
    const { project, branches } = await parent();
    if (!locals.user) redirect(303, '/#signin');
    const forks = await db.q<{ id: string; name: string }>('SELECT id, name FROM projects WHERE owner_id = $1 AND forked_from = $2', [locals.user.id, project.id]);
    const sources = [{ id: project.id, label: 'This project', branches: branches.filter((b) => !b.tracking && b.head).map((b) => b.name) }];
    for (const f of forks) sources.push({ id: f.id, label: `Your fork (${f.name})`, branches: (await listBranches(f.id)).filter((b) => !b.tracking && b.head).map((b) => b.name) });
    return {
        sources,
        targets: branches.filter((b) => !b.tracking).map((b) => b.name),
        head: url.searchParams.get('head'),
        base: url.searchParams.get('base') || project.default_branch
    };
};

export const actions: Actions = {
    default: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'read');
        await enforce(event, 'proposal');
        const f = await event.request.formData();
        const sourceProjectId = String(f.get('source') ?? '');
        if (sourceProjectId !== project.id) {
            // Cross-project proposals are limited to your own forks of this project.
            const fork = await db.one('SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2 AND forked_from = $3', [sourceProjectId, user.id, project.id]);
            if (!fork || !can(await roleFor(sourceProjectId, user.id), 'read')) error(403, 'Pick this project or one of your forks as the source.');
        }
        const number = await createProposal(user, project, {
            title: String(f.get('title') ?? ''),
            body: String(f.get('body') ?? ''),
            sourceProjectId,
            sourceBranch: String(f.get('head') ?? ''),
            targetBranch: String(f.get('base') ?? '')
        });
        redirect(303, `${projectHref(project.owner_username, project.name)}/proposals/${number}`);
    }
};
