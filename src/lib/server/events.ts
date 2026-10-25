import { db } from './db.ts';
import { emit } from './ws/hub.ts';

// Event types that also appear in the activity feeds.
const LOGGED = new Set([
    'snapshot.created', 'branch.created', 'branch.deleted', 'tag.created', 'proposal.opened', 'proposal.merged',
    'proposal.closed', 'collab.added', 'project.created', 'project.forked', 'remote.pulled', 'remote.pushed', 'restore'
]);

export interface PublishOptions {
    projectId: string;
    actorId?: string | null;
    type: string;
    data?: Record<string, unknown>;
}

const names = new Map<string, { name: string; at: number }>();
async function usernameOf(id: string | null): Promise<string | null> {
    if (!id) return null;
    const hit = names.get(id);
    if (hit && Date.now() - hit.at < 60_000) return hit.name;
    const row = await db.one<{ username: string }>('SELECT username FROM users WHERE id = $1', [id]).catch(() => null);
    if (row) names.set(id, { name: row.username, at: Date.now() });
    if (names.size > 500) names.clear();
    return row?.username ?? null;
}

export async function publish({ projectId, actorId = null, type, data = {} }: PublishOptions) {
    let activityId: number | null = null;
    if (LOGGED.has(type)) {
        const row = await db
            .one<{ id: number }>('INSERT INTO activity (project_id, actor_id, type, data) VALUES ($1, $2, $3, $4::jsonb) RETURNING id', [projectId, actorId, type, JSON.stringify(data)])
            .catch(() => null);
        activityId = row?.id ?? null;
    }
    emit(`project:${projectId}`, type, { ...data, actor: actorId, actor_name: await usernameOf(actorId), activity: activityId });
}

export const notifyUser = (userId: string, type: string, data: Record<string, unknown> = {}) => emit(`user:${userId}`, type, data);
