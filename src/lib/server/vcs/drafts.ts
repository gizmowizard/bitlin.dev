import { error } from '@sveltejs/kit';
import { db, tx, type Db } from '../db.ts';
import { config } from '../config.ts';
import { putBlob } from '../storage.ts';
import { findShapeConflict, normalizePath } from './paths.ts';
import { makeMatcher } from './ignore.ts';
import { getBranch, moveBranch } from './refs.ts';
import { getSnapshot, insertSnapshot } from './snapshots.ts';
import type { Tree } from '../../types.ts';

export interface DraftChange {
    path: string;
    op: 'put' | 'delete';
    hash: string | null;
    size: number | null;
    base_hash: string | null;
    updated_at: Date;
}

export interface DraftChangeView extends DraftChange {
    status: 'added' | 'modified' | 'removed';
    stale: boolean; // the branch moved under this change
}

export const listDraft = (projectId: string, userId: string, branch: string, d: Db = db) =>
    d.q<DraftChange>(
        'SELECT path, op, hash, size, base_hash, updated_at FROM draft_changes WHERE project_id = $1 AND user_id = $2 AND branch = $3 ORDER BY path',
        [projectId, userId, branch]
    );

export async function headTree(projectId: string, head: string | null, d: Db = db): Promise<Tree> {
    if (!head) return {};
    return (await getSnapshot(projectId, head, d))?.tree ?? {};
}

export function annotateDraft(changes: DraftChange[], head: Tree): DraftChangeView[] {
    return changes.map((c) => {
        const cur = head[c.path];
        return {
            ...c,
            status: c.op === 'delete' ? 'removed' : cur ? 'modified' : 'added',
            stale: (cur?.h ?? null) !== c.base_hash
        };
    });
}

export interface StageInput {
    path: string;
    data: Buffer;
}

// Stages file contents; returns how many were skipped (ignored, oversized, or identical to head).
export async function stageFiles(projectId: string, userId: string, branch: string, head: Tree, ignoreRules: string, files: StageInput[]) {
    const isIgnored = makeMatcher(ignoreRules);
    const result = { staged: 0, ignored: [] as string[], tooLarge: [] as string[], invalid: [] as string[], unchanged: 0 };
    const known = Object.keys(head).length;
    const pending = await db.one<{ n: number }>('SELECT count(*)::int AS n FROM draft_changes WHERE project_id = $1 AND user_id = $2 AND branch = $3', [projectId, userId, branch]);
    if (known + (pending?.n ?? 0) + files.length > config.limits.maxFiles * 2) error(413, 'Too many files in one workspace.');

    for (const f of files) {
        const path = normalizePath(f.path);
        if (!path) {
            result.invalid.push(f.path);
            continue;
        }
        if (isIgnored(path)) {
            result.ignored.push(path);
            continue;
        }
        if (f.data.length > config.limits.maxFileBytes) {
            result.tooLarge.push(path);
            continue;
        }
        const { hash, size } = await putBlob(f.data);
        const cur = head[path];
        if (cur?.h === hash) {
            await db.q('DELETE FROM draft_changes WHERE project_id = $1 AND user_id = $2 AND branch = $3 AND path = $4', [projectId, userId, branch, path]);
            result.unchanged++;
            continue;
        }
        await db.q(
            `INSERT INTO draft_changes (project_id, user_id, branch, path, op, hash, size, base_hash)
             VALUES ($1, $2, $3, $4, 'put', $5, $6, $7)
             ON CONFLICT (project_id, user_id, branch, path)
             DO UPDATE SET op = 'put', hash = $5, size = $6, updated_at = now()`,
            [projectId, userId, branch, path, hash, size, cur?.h ?? null]
        );
        result.staged++;
    }
    return result;
}

// Deleting a directory stages a delete for everything under it.
export async function stageDelete(projectId: string, userId: string, branch: string, head: Tree, target: string): Promise<number> {
    const path = normalizePath(target);
    if (!path) error(400, 'Invalid path');
    const victims = Object.keys(head).filter((p) => p === path || p.startsWith(`${path}/`));
    // Also drop staged additions beneath the path.
    await db.q('DELETE FROM draft_changes WHERE project_id = $1 AND user_id = $2 AND branch = $3 AND op = $4 AND (path = $5 OR path LIKE $6)', [projectId, userId, branch, 'put', path, `${path.replace(/[\\%_]/g, '\\$&')}/%`]);
    if (!victims.length) return 0;
    await db.q(
        `INSERT INTO draft_changes (project_id, user_id, branch, path, op, base_hash)
         SELECT $1, $2, $3, p, 'delete', h FROM unnest($4::text[], $5::text[]) AS t(p, h)
         ON CONFLICT (project_id, user_id, branch, path) DO UPDATE SET op = 'delete', hash = NULL, size = NULL, updated_at = now()`,
        [projectId, userId, branch, victims, victims.map((p) => head[p].h)]
    );
    return victims.length;
}

export async function discardDraft(projectId: string, userId: string, branch: string, path?: string) {
    if (path) await db.q('DELETE FROM draft_changes WHERE project_id = $1 AND user_id = $2 AND branch = $3 AND path = $4', [projectId, userId, branch, path]);
    else await db.q('DELETE FROM draft_changes WHERE project_id = $1 AND user_id = $2 AND branch = $3', [projectId, userId, branch]);
}

export function applyDraft(head: Tree, changes: DraftChange[]): Tree {
    const tree: Tree = { ...head };
    for (const c of changes) {
        if (c.op === 'delete') delete tree[c.path];
        else tree[c.path] = { h: c.hash!, s: c.size! };
    }
    return tree;
}

export async function commitDraft(opts: { projectId: string; userId: string; authorName: string; branch: string; message: string; force: boolean }) {
    const { projectId, userId, branch } = opts;
    return tx(async (d) => {
        const b = await getBranch(projectId, branch, d);
        if (!b) error(404, 'Branch not found');
        if (b.tracking) error(400, 'Remote-tracking branches are read-only.');
        const changes = await listDraft(projectId, userId, branch, d);
        if (!changes.length) error(400, 'There are no changes to save.');
        const head = await headTree(projectId, b.head, d);
        if (!opts.force && annotateDraft(changes, head).some((c) => c.stale)) {
            error(409, 'The branch changed since you staged some files. Review them, or save anyway to overwrite.');
        }
        const tree = applyDraft(head, changes);
        if (Object.keys(tree).length > config.limits.maxFiles) error(413, `Snapshots are limited to ${config.limits.maxFiles} files.`);
        const clash = findShapeConflict(tree);
        if (clash) error(400, `“${clash}” can't be both a file and a folder.`);
        const snap = await insertSnapshot(d, projectId, {
            tree,
            parents: b.head ? [b.head] : [],
            message: opts.message,
            authorId: userId,
            authorName: opts.authorName
        });
        if (!(await moveBranch(d, projectId, branch, b.head, snap.id))) error(409, 'The branch moved while saving. Please try again.');
        await d.q('DELETE FROM draft_changes WHERE project_id = $1 AND user_id = $2 AND branch = $3', [projectId, userId, branch]);
        await d.q('UPDATE projects SET updated_at = now() WHERE id = $1', [projectId]);
        return { snapshot: snap, previous: b.head, files: changes.length };
    });
}
