import { error } from '@sveltejs/kit';
import { db, tx, isUniqueViolation } from './db.ts';
import { config } from './config.ts';
import { publish, notifyUser } from './events.ts';
import { announceAccessChange, emit } from './ws/hub.ts';
import { IGNORE_TEMPLATES } from '../ignore-templates.ts';
import { PROJECT_RE } from '../util.ts';
import { validateRules } from './vcs/ignore.ts';
import type { Collaboratorrole } from '../types.ts';

export interface ProjectRow {
    id: string;
    owner_id: string;
    name: string;
    description: string;
    visibility: 'public' | 'private';
    default_branch: string;
    ignore_rules: string;
    forked_from: string | null;
    created_at: Date;
    updated_at: Date;
    owner_username: string;
    owner_display: string;
    owner_avatar: string | null;
}

const PROJECT_SELECT = `p.id, p.owner_id, p.name, p.description, p.visibility, p.default_branch, p.ignore_rules, p.forked_from,
    p.created_at, p.updated_at, u.username AS owner_username, u.display_name AS owner_display, u.avatar_url AS owner_avatar`;

export const getProjectByPath = (owner: string, name: string) =>
    db.one<ProjectRow>(
        `SELECT ${PROJECT_SELECT} FROM projects p JOIN users u ON u.id = p.owner_id
          WHERE lower(u.username) = lower($1) AND lower(p.name) = lower($2)`,
        [owner, name]
    );

export const getProjectById = (id: string) =>
    db.one<ProjectRow>(`SELECT ${PROJECT_SELECT} FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = $1`, [id]);

export interface ProjectSummary {
    id: string;
    name: string;
    description: string;
    visibility: 'public' | 'private';
    updated_at: Date;
    is_fork: boolean;
    owner: string;
    owner_display: string;
    owner_avatar: string | null;
    snapshots: number;
}

const SUMMARY_SELECT = `p.id, p.name, p.description, p.visibility, p.updated_at, p.forked_from IS NOT NULL AS is_fork,
    u.username AS owner, u.display_name AS owner_display, u.avatar_url AS owner_avatar,
    (SELECT count(*) FROM snapshots s WHERE s.project_id = p.id)::int AS snapshots`;

const VISIBLE = `(p.visibility = 'public' OR p.owner_id = $1 OR EXISTS (SELECT 1 FROM collaborators c WHERE c.project_id = p.id AND c.user_id = $1))`;

export const projectsOwnedBy = (ownerId: string, viewerId: string | null) =>
    db.q<ProjectSummary>(
        `SELECT ${SUMMARY_SELECT} FROM projects p JOIN users u ON u.id = p.owner_id
          WHERE p.owner_id = $2 AND ${VISIBLE} ORDER BY p.updated_at DESC LIMIT 200`,
        [viewerId, ownerId]
    );

export const collaboratingProjects = (userId: string) =>
    db.q<ProjectSummary & { role: string }>(
        `SELECT ${SUMMARY_SELECT}, c.role FROM collaborators c JOIN projects p ON p.id = c.project_id JOIN users u ON u.id = p.owner_id
          WHERE c.user_id = $1 ORDER BY p.updated_at DESC LIMIT 100`,
        [userId]
    );

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

export async function exploreProjects(q: string, sort: 'updated' | 'new', limit: number, offset: number) {
    const like = `%${escapeLike(q)}%`;
    return db.q<ProjectSummary>(
        `SELECT ${SUMMARY_SELECT} FROM projects p JOIN users u ON u.id = p.owner_id
          WHERE p.visibility = 'public' AND ($1 = '' OR p.name ILIKE $2 OR p.description ILIKE $2 OR u.username ILIKE $2)
          ORDER BY ${sort === 'new' ? 'p.created_at' : 'p.updated_at'} DESC LIMIT $3 OFFSET $4`,
        [q, like, limit, offset]
    );
}

export async function projectStats(projectId: string) {
    return (await db.one<{ snapshots: number; branches: number; tags: number; proposals: number; people: number }>(
        `SELECT (SELECT count(*) FROM snapshots WHERE project_id = $1)::int AS snapshots,
                (SELECT count(*) FROM branches WHERE project_id = $1 AND tracking IS NULL)::int AS branches,
                (SELECT count(*) FROM tags WHERE project_id = $1)::int AS tags,
                (SELECT count(*) FROM proposals WHERE project_id = $1 AND status = 'open')::int AS proposals,
                (SELECT count(*) FROM collaborators WHERE project_id = $1)::int + 1 AS people`,
        [projectId]
    ))!;
}

export function validateProjectName(name: string): string | null {
    if (!PROJECT_RE.test(name)) return 'Project names use letters, numbers, “.”, “-” and “_” (up to 64 characters).';
    if (/\.(git|lock)$/i.test(name)) return 'That project name is not allowed.';
    return null;
}

export interface Actor {
    id: string;
    username: string;
}

export async function createProject(actor: Actor, input: { name: string; description: string; visibility: string; templates: string[] }) {
    const problem = validateProjectName(input.name);
    if (problem) error(400, problem);
    if (input.description.length > 300) error(400, 'Descriptions are limited to 300 characters.');
    const visibility = input.visibility === 'private' ? 'private' : 'public';
    const rules = input.templates.map((t) => IGNORE_TEMPLATES[t]).filter(Boolean).join('\n');

    const count = await db.one<{ n: number }>('SELECT count(*)::int AS n FROM projects WHERE owner_id = $1', [actor.id]);
    if ((count?.n ?? 0) >= config.limits.maxProjectsPerUser) error(400, 'You have reached the project limit.');

    try {
        const project = await tx(async (d) => {
            const row = await d.one<{ id: string }>(
                `INSERT INTO projects (owner_id, name, description, visibility, ignore_rules) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [actor.id, input.name, input.description.trim(), visibility, rules]
            );
            await d.q(`INSERT INTO branches (project_id, name) VALUES ($1, 'main')`, [row!.id]);
            return row!;
        });
        await publish({ projectId: project.id, actorId: actor.id, type: 'project.created', data: { name: input.name } });
        if (visibility === 'public') emit('explore', 'project.changed', { id: project.id });
        return { id: project.id, name: input.name };
    } catch (err) {
        if (isUniqueViolation(err)) error(409, `You already have a project named “${input.name}”.`);
        throw err;
    }
}

export async function forkProject(actor: Actor, src: ProjectRow, wantedName?: string) {
    const base = wantedName || src.name;
    const problem = validateProjectName(base);
    if (problem) error(400, problem);
    const count = await db.one<{ n: number }>('SELECT count(*)::int AS n FROM projects WHERE owner_id = $1', [actor.id]);
    if ((count?.n ?? 0) >= config.limits.maxProjectsPerUser) error(400, 'You have reached the project limit.');

    for (let i = 0; i < 10; i++) {
        const name = i === 0 ? base : `${base.slice(0, 60)}-${i + 1}`;
        try {
            const id = await tx(async (d) => {
                const row = await d.one<{ id: string }>(
                    `INSERT INTO projects (owner_id, name, description, visibility, default_branch, ignore_rules, forked_from)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                    [actor.id, name, src.description, src.visibility, src.default_branch, src.ignore_rules, src.id]
                );
                const id = row!.id;
                await d.q(
                    `INSERT INTO snapshots (project_id, id, parents, tree, author_id, author_name, message, created_at)
                     SELECT $2, id, parents, tree, author_id, author_name, message, created_at FROM snapshots WHERE project_id = $1`,
                    [src.id, id]
                );
                await d.q('INSERT INTO project_blobs (project_id, hash) SELECT $2, hash FROM project_blobs WHERE project_id = $1', [src.id, id]);
                await d.q(`INSERT INTO branches (project_id, name, head) SELECT $2, name, head FROM branches WHERE project_id = $1 AND tracking IS NULL`, [src.id, id]);
                await d.q('INSERT INTO tags (project_id, name, snapshot_id, message, notes, author_id, created_at) SELECT $2, name, snapshot_id, message, notes, author_id, created_at FROM tags WHERE project_id = $1', [src.id, id]);
                return id;
            });
            await publish({ projectId: id, actorId: actor.id, type: 'project.forked', data: { from: `${src.owner_username}/${src.name}` } });
            await publish({ projectId: src.id, actorId: actor.id, type: 'project.forked', data: { by: actor.username } });
            if (src.visibility === 'public') emit('explore', 'project.changed', { id });
            return { id, name };
        } catch (err) {
            if (!isUniqueViolation(err)) throw err;
        }
    }
    error(409, 'Could not find a free name for the fork. Pick one explicitly.');
}

export async function updateProjectSettings(projectId: string, actorId: string, input: { description: string; visibility: string }) {
    if (input.description.length > 300) error(400, 'Descriptions are limited to 300 characters.');
    const visibility = input.visibility === 'private' ? 'private' : 'public';
    const before = await db.one<{ visibility: string }>('SELECT visibility FROM projects WHERE id = $1', [projectId]);
    await db.q('UPDATE projects SET description = $2, visibility = $3, updated_at = now() WHERE id = $1', [projectId, input.description.trim(), visibility]);
    await publish({ projectId, actorId, type: 'project.updated' });
    if (before?.visibility !== visibility) {
        announceAccessChange(projectId);
        emit('explore', 'project.changed', { id: projectId });
    }
}

export async function renameProject(projectId: string, actorId: string, name: string) {
    const problem = validateProjectName(name);
    if (problem) error(400, problem);
    try {
        await db.q('UPDATE projects SET name = $2, updated_at = now() WHERE id = $1', [projectId, name]);
    } catch (err) {
        if (isUniqueViolation(err)) error(409, `You already have a project named “${name}”.`);
        throw err;
    }
    await publish({ projectId, actorId, type: 'project.renamed', data: { name } });
}

export async function updateIgnoreRules(projectId: string, actorId: string, rules: string) {
    const problem = validateRules(rules);
    if (problem) error(400, problem);
    await db.q('UPDATE projects SET ignore_rules = $2, updated_at = now() WHERE id = $1', [projectId, rules.replace(/\r\n/g, '\n')]);
    await publish({ projectId, actorId, type: 'ignore.updated' });
}

export async function deleteProject(projectId: string) {
    await db.q('DELETE FROM projects WHERE id = $1', [projectId]);
    emit(`project:${projectId}`, 'project.deleted', {});
    announceAccessChange(projectId);
    emit('explore', 'project.changed', { id: projectId });
}

export interface Collaborator {
    user_id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    role: Collaboratorrole;
    created_at: Date;
}

export const listCollaborators = (projectId: string) =>
    db.q<Collaborator>(
        `SELECT c.user_id, u.username, u.display_name, u.avatar_url, c.role, c.created_at
           FROM collaborators c JOIN users u ON u.id = c.user_id WHERE c.project_id = $1 ORDER BY c.created_at`,
        [projectId]
    );

const ROLES = new Set(['read', 'write', 'admin']);

export async function addCollaborator(project: ProjectRow, actor: Actor, username: string, role: string) {
    if (!ROLES.has(role)) error(400, 'Pick a valid role.');
    const target = await db.one<{ id: string; username: string }>('SELECT id, username FROM users WHERE lower(username) = lower($1)', [username.replace(/^\*/, '').trim()]);
    if (!target) error(404, `No user named *${username.replace(/^\*/, '')}.`);
    if (target.id === project.owner_id) error(400, 'The owner already has full access.');
    await db.q(
        `INSERT INTO collaborators (project_id, user_id, role, invited_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [project.id, target.id, role, actor.id]
    );
    await publish({ projectId: project.id, actorId: actor.id, type: 'collab.added', data: { username: target.username, role } });
    notifyUser(target.id, 'notice', { text: `You were added to *${project.owner_username}/${project.name} as ${role}.`, href: `/*${project.owner_username}/${project.name}` });
    announceAccessChange(project.id);
}

export async function removeCollaborator(projectId: string, actorId: string, userId: string) {
    await db.q('DELETE FROM collaborators WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
    await publish({ projectId, actorId, type: 'collab.removed', data: { user: userId } });
    announceAccessChange(projectId);
}

export interface ActivityItem {
    id: number;
    type: string;
    data: Record<string, any>;
    created_at: Date;
    actor: { username: string; display_name: string; avatar_url: string | null } | null;
    project?: { owner: string; name: string };
}

export const projectActivity = (projectId: string, limit = 20) =>
    db.q<ActivityItem>(
        `SELECT a.id, a.type, a.data, a.created_at,
                CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url) END AS actor
           FROM activity a LEFT JOIN users u ON u.id = a.actor_id WHERE a.project_id = $1 ORDER BY a.id DESC LIMIT $2`,
        [projectId, limit]
    );

export const feedForUser = (userId: string, limit = 30) =>
    db.q<ActivityItem>(
        `SELECT a.id, a.type, a.data, a.created_at,
                CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url) END AS actor,
                json_build_object('owner', o.username, 'name', p.name) AS project
           FROM activity a
           JOIN projects p ON p.id = a.project_id
           JOIN users o ON o.id = p.owner_id
           LEFT JOIN users u ON u.id = a.actor_id
          WHERE (p.owner_id = $1 OR EXISTS (SELECT 1 FROM collaborators c WHERE c.project_id = p.id AND c.user_id = $1))
          ORDER BY a.id DESC LIMIT $2`,
        [userId, limit]
    );
