import { error } from '@sveltejs/kit';
import { db } from './db.ts';
import type { Role } from '../types.ts';

import { can } from '../access.ts';
export { can };

export async function roleFor(projectId: string, userId: string | null): Promise<Role> {
    const row = await db.one<{ visibility: string; owner_id: string; role: string | null }>(
        `SELECT p.visibility, p.owner_id, c.role
           FROM projects p
           LEFT JOIN collaborators c ON c.project_id = p.id AND c.user_id = $2
          WHERE p.id = $1`,
        [projectId, userId]
    );
    if (!row) return 'none';
    if (userId && row.owner_id === userId) return 'owner';
    if (row.role) return row.role as Role;
    return row.visibility === 'public' ? 'read' : 'none';
}

export async function requireRole(projectId: string, userId: string | null, need: Exclude<Role, 'none'>): Promise<Role> {
    const role = await roleFor(projectId, userId);
    if (!can(role, need)) {
        // Hide private projects from people without any access.
        if (role === 'none') error(404, 'Project not found');
        if (!userId) error(401, 'Sign in to do that');
        error(403, 'You do not have permission to do that');
    }
    return role;
}
