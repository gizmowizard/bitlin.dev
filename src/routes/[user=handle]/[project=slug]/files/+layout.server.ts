import type { LayoutServerLoad } from './$types';
import { headTree } from '#lib/server/vcs/drafts.ts';

// Lives above the [...path] route so navigating between files doesn't refetch the whole tree.
export const load: LayoutServerLoad = async ({ parent, depends }) => {
    depends('bitlin:refs');
    const { project, ref } = await parent();
    const tree = await headTree(project.id, ref.snapshot);
    return { paths: Object.keys(tree).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) };
};
