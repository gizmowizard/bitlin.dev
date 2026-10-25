import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { getProjectById, updateIgnoreRules } from '#lib/server/projects.ts';
import { headTree } from '#lib/server/vcs/drafts.ts';
import { makeMatcher } from '#lib/ignore.ts';

export const load: PageServerLoad = async ({ parent, depends }) => {
    depends('bitlin:project');
    const { project, ref } = await parent();
    const row = (await getProjectById(project.id))!;
    const tree = await headTree(project.id, ref.snapshot);
    const matches = makeMatcher(row.ignore_rules);
    return { rules: row.ignore_rules, trackedButIgnored: Object.keys(tree).filter(matches).slice(0, 50) };
};

export const actions: Actions = {
    save: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'write');
        await enforce(event, 'settings');
        await updateIgnoreRules(project.id, user.id, String((await event.request.formData()).get('rules') ?? ''));
        return { ok: true };
    }
};
