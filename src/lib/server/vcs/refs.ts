import { db, type Db } from '../db.ts';
import { findSnapshotByPrefix } from './snapshots.ts';
import type { BranchInfo, ResolvedRef } from '../../types.ts';

export const listBranches = (projectId: string, d: Db = db) =>
    d.q<BranchInfo>('SELECT name, head, tracking, updated_at FROM branches WHERE project_id = $1 ORDER BY name', [projectId]);

export const getBranch = (projectId: string, name: string, d: Db = db) =>
    d.one<BranchInfo>('SELECT name, head, tracking, updated_at FROM branches WHERE project_id = $1 AND name = $2', [projectId, name]);

export async function resolveRef(projectId: string, ref: string | null, defaultBranch: string): Promise<ResolvedRef | null> {
    const name = ref || defaultBranch;
    const branch = await getBranch(projectId, name);
    if (branch) return { name, kind: 'branch', snapshot: branch.head, branch: branch.tracking ? null : name };
    const tag = await db.one<{ snapshot_id: string }>('SELECT snapshot_id FROM tags WHERE project_id = $1 AND name = $2', [projectId, name]);
    if (tag) return { name, kind: 'tag', snapshot: tag.snapshot_id, branch: null };
    const snap = await findSnapshotByPrefix(projectId, name);
    if (snap) return { name: snap.slice(0, 8), kind: 'snapshot', snapshot: snap, branch: null };
    return null;
}

// Compare-and-swap so two people saving at once can't silently overwrite each other.
export async function moveBranch(d: Db, projectId: string, name: string, oldHead: string | null, newHead: string): Promise<boolean> {
    const rows = await d.q(
        `UPDATE branches SET head = $4, updated_at = now()
          WHERE project_id = $1 AND name = $2 AND head IS NOT DISTINCT FROM $3 RETURNING 1`,
        [projectId, name, oldHead, newHead]
    );
    return rows.length === 1;
}
