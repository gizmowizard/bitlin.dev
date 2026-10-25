import { error } from '@sveltejs/kit';
import { getProjectByPath, type ProjectRow } from './projects.ts';
import { requireRole } from './access.ts';
import type { Role, SessionUser } from '../types.ts';

// Shared by actions and +server endpoints, which (unlike loads) can't read layout data.
export async function guard(params: { user: string; project: string }, user: SessionUser | null, need: Exclude<Role, 'none'>): Promise<{ project: ProjectRow; role: Role; user: SessionUser }> {
    const project = await getProjectByPath(params.user.slice(1), params.project);
    if (!project) error(404, 'Project not found');
    const role = await requireRole(project.id, user?.id ?? null, need);
    return { project, role, user: user as SessionUser };
}

import type { RequestEvent } from '@sveltejs/kit';
import { authenticateBearer } from './auth.ts';
import { roleFor, can } from './access.ts';
import { clientIp, limit } from './ratelimit.ts';
import { config } from './config.ts';

// Remote sync authenticates with bearer tokens; public projects stay readable without one.
export async function syncGuard(event: RequestEvent<{ owner: string; project: string }>, need: 'read' | 'write') {
    const rl = await limit('sync', clientIp(event, config.ipHeader));
    if (!rl.ok) error(429, `Too many requests. Retry in ${rl.retryAfter}s.`);
    const project = await getProjectByPath(event.params.owner, event.params.project);
    if (!project) error(404, 'Project not found');
    const bearer = await authenticateBearer(event.request.headers.get('authorization'));
    if (need === 'write' && bearer && !bearer.canWrite) error(403, 'This token is read-only.');
    const role = await roleFor(project.id, bearer?.user.id ?? null);
    if (!can(role, need)) error(bearer ? 403 : 404, bearer ? 'No permission' : 'Project not found');
    return { project, role, user: bearer?.user ?? null };
}
