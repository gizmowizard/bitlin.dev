import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getProjectByPath, projectStats } from '#lib/server/projects.ts';
import { can, roleFor } from '#lib/server/access.ts';
import { listBranches, resolveRef } from '#lib/server/vcs/refs.ts';
import { ancestors } from '#lib/server/vcs/snapshots.ts';
import { listDraft } from '#lib/server/vcs/drafts.ts';

export const load: LayoutServerLoad = async ({ params, locals, url, depends }) => {
    depends('bitlin:project', 'bitlin:refs');
    const project = await getProjectByPath(params.user.slice(1), params.project);
    if (!project) error(404, 'Project not found');
    const role = await roleFor(project.id, locals.user?.id ?? null);
    if (!can(role, 'read')) error(404, 'Project not found');

    // Canonical casing keeps one URL per project.
    if (project.owner_username !== params.user.slice(1) || project.name !== params.project) {
        redirect(301, `/*${project.owner_username}/${project.name}${url.pathname.split('/').slice(3).map((s) => `/${s}`).join('')}${url.search}`);
    }

    const [branches, stats] = await Promise.all([listBranches(project.id), projectStats(project.id)]);
    const refName = url.searchParams.get('ref');
    const ref = await resolveRef(project.id, refName, project.default_branch);
    if (!ref && refName) error(404, `“${refName}” is not a branch, tag or snapshot in this project.`);

    // Count of staged changes shown on the Changes tab.
    let pendingChanges = 0;
    if (locals.user && ref?.branch && can(role, 'write')) pendingChanges = (await listDraft(project.id, locals.user.id, ref.branch)).length;

    return {
        project: {
            id: project.id,
            name: project.name,
            description: project.description,
            visibility: project.visibility,
            default_branch: project.default_branch,
            created_at: project.created_at,
            updated_at: project.updated_at,
            forked: project.forked_from !== null,
            owner: { id: project.owner_id, username: project.owner_username, display_name: project.owner_display, avatar_url: project.owner_avatar }
        },
        role,
        branches,
        stats,
        ref: ref ?? { name: project.default_branch, kind: 'branch' as const, snapshot: null, branch: project.default_branch },
        pendingChanges,
        historyDepth: ref?.snapshot ? (await ancestors(project.id, ref.snapshot, 5000)).size : 0
    };
};
