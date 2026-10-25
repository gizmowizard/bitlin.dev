import { db, type Db } from '../db.ts';
import { sha256 } from '../crypto.ts';
import type { PublicUser, SnapshotInfo, Tree } from '../../types.ts';

export interface SnapshotRow {
    id: string;
    parents: string[];
    tree: Tree;
    author_id: string | null;
    author_name: string;
    message: string;
    created_at: Date;
}

export interface NewSnapshot {
    tree: Tree;
    parents: string[];
    message: string;
    authorId: string | null;
    authorName: string;
    createdAt?: Date;
}

// The id covers everything that defines a snapshot, so identical history hashes identically everywhere.
export function computeSnapshotId(s: { tree: Tree; parents: string[]; message: string; authorName: string; ts: number }): string {
    const files = Object.keys(s.tree).sort().map((p) => [p, s.tree[p].h, s.tree[p].s]);
    return sha256(JSON.stringify({ v: 1, f: files, p: s.parents, m: s.message, a: s.authorName, t: s.ts }));
}

export async function insertSnapshot(d: Db, projectId: string, s: NewSnapshot): Promise<SnapshotRow> {
    const createdAt = s.createdAt ?? new Date();
    const id = computeSnapshotId({ ...s, ts: createdAt.getTime() });
    await d.q(
        `INSERT INTO snapshots (project_id, id, parents, tree, author_id, author_name, message, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [projectId, id, s.parents, JSON.stringify(s.tree), s.authorId, s.authorName, s.message, createdAt]
    );
    await registerBlobs(d, projectId, s.tree);
    return { id, parents: s.parents, tree: s.tree, author_id: s.authorId, author_name: s.authorName, message: s.message, created_at: createdAt };
}

export async function registerBlobs(d: Db, projectId: string, tree: Tree) {
    const hashes = [...new Set(Object.values(tree).map((e) => e.h))];
    if (!hashes.length) return;
    await d.q('INSERT INTO project_blobs (project_id, hash) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [projectId, hashes]);
}

export const getSnapshot = (projectId: string, id: string, d: Db = db) =>
    d.one<SnapshotRow>('SELECT id, parents, tree, author_id, author_name, message, created_at FROM snapshots WHERE project_id = $1 AND id = $2', [projectId, id]);

export async function findSnapshotByPrefix(projectId: string, prefix: string): Promise<string | null> {
    if (!/^[0-9a-f]{6,64}$/.test(prefix)) return null;
    const rows = await db.q<{ id: string }>('SELECT id FROM snapshots WHERE project_id = $1 AND id LIKE $2 LIMIT 2', [projectId, `${prefix}%`]);
    return rows.length === 1 ? rows[0].id : null;
}

type InfoRow = { id: string; parents: string[]; message: string; created_at: Date; author_name: string; u_id: string | null; u_username: string | null; u_display: string | null; u_avatar: string | null };

function toInfo(r: InfoRow): SnapshotInfo {
    const author: PublicUser | null = r.u_id ? { id: r.u_id, username: r.u_username!, display_name: r.u_display!, avatar_url: r.u_avatar } : null;
    return { id: r.id, parents: r.parents, message: r.message, created_at: r.created_at, author, author_name: r.author_name };
}

const INFO_COLS = `h.id, h.parents, h.message, h.created_at, h.author_name,
    u.id AS u_id, u.username AS u_username, u.display_name AS u_display, u.avatar_url AS u_avatar`;

const WALK = `WITH RECURSIVE h AS (
        SELECT id, parents, message, created_at, author_id, author_name FROM snapshots WHERE project_id = $1 AND id = $2
        UNION
        SELECT s.id, s.parents, s.message, s.created_at, s.author_id, s.author_name
          FROM snapshots s JOIN h ON s.id = ANY(h.parents) WHERE s.project_id = $1
    )`;

export async function history(projectId: string, head: string | null, limit: number, offset = 0): Promise<SnapshotInfo[]> {
    if (!head) return [];
    const rows = await db.q<InfoRow>(
        `${WALK} SELECT ${INFO_COLS} FROM h LEFT JOIN users u ON u.id = h.author_id
          ORDER BY h.created_at DESC, h.id LIMIT $3 OFFSET $4`,
        [projectId, head, limit, offset]
    );
    return rows.map(toInfo);
}

export async function snapshotInfos(projectId: string, ids: string[]): Promise<Map<string, SnapshotInfo>> {
    if (!ids.length) return new Map();
    const rows = await db.q<InfoRow>(
        `SELECT ${INFO_COLS.replace(/h\./g, 's.')} FROM snapshots s LEFT JOIN users u ON u.id = s.author_id
          WHERE s.project_id = $1 AND s.id = ANY($2)`,
        [projectId, ids]
    );
    return new Map(rows.map((r) => [r.id, toInfo(r)]));
}

const ANCESTOR_CAP = 20_000;

export async function ancestors(projectId: string, head: string | null, cap = ANCESTOR_CAP): Promise<Map<string, { parents: string[]; t: number }>> {
    const out = new Map<string, { parents: string[]; t: number }>();
    if (!head) return out;
    const rows = await db.q<{ id: string; parents: string[]; created_at: Date }>(
        `WITH RECURSIVE a AS (
            SELECT id, parents, created_at FROM snapshots WHERE project_id = $1 AND id = $2
            UNION
            SELECT s.id, s.parents, s.created_at FROM snapshots s JOIN a ON s.id = ANY(a.parents) WHERE s.project_id = $1
         ) SELECT * FROM a LIMIT $3`,
        [projectId, head, cap]
    );
    for (const r of rows) out.set(r.id, { parents: r.parents, t: r.created_at.getTime() });
    return out;
}

export async function isAncestor(projectId: string, maybeAncestor: string, of: string): Promise<boolean> {
    if (maybeAncestor === of) return true;
    return (await ancestors(projectId, of)).has(maybeAncestor);
}

// Newest shared ancestor; good enough as the 3-way merge base for our linear-ish histories.
export async function mergeBase(projectId: string, a: string, b: string): Promise<string | null> {
    const [anA, anB] = await Promise.all([ancestors(projectId, a), ancestors(projectId, b)]);
    let best: string | null = null;
    let bestT = -Infinity;
    for (const [id, v] of anB) {
        if (anA.has(id) && v.t >= bestT) {
            best = id;
            bestT = v.t;
        }
    }
    return best;
}

export async function aheadBehind(projectId: string, head: string | null, base: string | null) {
    const [a, b] = await Promise.all([ancestors(projectId, head), ancestors(projectId, base)]);
    let ahead = 0;
    let behind = 0;
    for (const id of a.keys()) if (!b.has(id)) ahead++;
    for (const id of b.keys()) if (!a.has(id)) behind++;
    return { ahead, behind };
}

export async function copySnapshots(from: string, to: string, head: string | null): Promise<void> {
    if (from === to || !head) return;
    const ids = [...(await ancestors(from, head)).keys()];
    if (!ids.length) return;
    await db.q(
        `INSERT INTO snapshots (project_id, id, parents, tree, author_id, author_name, message, created_at)
         SELECT $2, id, parents, tree, author_id, author_name, message, created_at
           FROM snapshots WHERE project_id = $1 AND id = ANY($3) ON CONFLICT DO NOTHING`,
        [from, to, ids]
    );
    await db.q(
        `INSERT INTO project_blobs (project_id, hash)
         SELECT DISTINCT $2, e.value->>'h' FROM snapshots s, jsonb_each(s.tree) e
          WHERE s.project_id = $1 AND s.id = ANY($3) ON CONFLICT DO NOTHING`,
        [from, to, ids]
    );
}
