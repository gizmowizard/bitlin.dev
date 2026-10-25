import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { resolveRef } from '#lib/server/vcs/refs.ts';
import { executeMerge, planMerge } from '#lib/server/ops.ts';
import { parseResolutions } from '#lib/server/merge-form.ts';
import { can } from '#lib/access.ts';
import { projectHref, withRef } from '#lib/util.ts';

export const load: PageServerLoad = async ({ parent, url, locals }) => {
    const { project, role } = await parent();
    if (!locals.user) redirect(303, '/#signin');
    if (!can(role, 'write')) error(403, 'You need write access to merge.');
    const intoName = url.searchParams.get('into') || project.default_branch;
    const fromName = url.searchParams.get('from');
    if (!fromName) error(400, 'Choose what to merge from.');
    const [into, from] = await Promise.all([resolveRef(project.id, intoName, project.default_branch), resolveRef(project.id, fromName, project.default_branch)]);
    if (!into?.branch) error(400, 'The target must be one of the project’s own branches.');
    if (!from?.snapshot) error(400, 'There is nothing to merge from that ref.');
    const plan = await planMerge(project.id, into.snapshot, from.snapshot, { ours: into.name, theirs: from.name });
    return {
        into: into.name,
        from: from.name,
        kind: plan.kind,
        conflicts: plan.kind === 'merge' ? plan.outcome.conflicts : [],
        autoMerged: plan.kind === 'merge' ? plan.outcome.autoMerged : [],
        changed: plan.kind === 'merge' ? plan.outcome.changed : 0
    };
};

export const actions: Actions = {
    merge: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'write');
        await enforce(event, 'merge');
        const f = await event.request.formData();
        const into = String(f.get('into') ?? '');
        const from = await resolveRef(project.id, String(f.get('from') ?? ''), project.default_branch);
        if (!from?.snapshot) return fail(400, { message: 'Nothing to merge from that ref.' });
        const res = await executeMerge({
            projectId: project.id,
            actor: user,
            into,
            fromHead: from.snapshot,
            fromLabel: from.name,
            message: String(f.get('message') ?? ''),
            resolutions: parseResolutions(f),
            noFastForward: f.get('noff') === 'on'
        });
        if (res.status === 'conflicts') return fail(409, { message: `${res.conflicts.length} conflict(s) still need a decision.` });
        redirect(303, `${projectHref(project.owner_username, project.name)}/snapshots${withRef('', into, project.default_branch)}`);
    }
};
