import dns from 'node:dns/promises';
import net from 'node:net';
import { error } from '@sveltejs/kit';
import { db, tx } from './db.ts';
import { config } from './config.ts';
import { sha256, decrypt } from './crypto.ts';
import { getBlob, putBlobWithHash, blobsExist } from './storage.ts';
import { ancestors, computeSnapshotId, getSnapshot, isAncestor, registerBlobs, type SnapshotRow } from './vcs/snapshots.ts';
import { getBranch, moveBranch } from './vcs/refs.ts';
import { normalizePath } from './vcs/paths.ts';
import { announceBranchMove } from './ops.ts';
import { publish } from './events.ts';
import { validateBranchName } from '../util.ts';
import type { Actor, ProjectRow } from './projects.ts';
import type { Tree } from '../types.ts';

export interface WireSnapshot {
    id: string;
    parents: string[];
    tree: Tree;
    author_name: string;
    message: string;
    ts: number;
}

export const toWire = (r: SnapshotRow): WireSnapshot => ({ id: r.id, parents: r.parents, tree: r.tree, author_name: r.author_name, message: r.message, ts: r.created_at.getTime() });

const HASH = /^[0-9a-f]{64}$/;

// Everything arriving from a remote is untrusted: shape-check, then recompute the content hash.
export function verifyWire(s: any): s is WireSnapshot {
    if (!s || typeof s !== 'object' || !HASH.test(s.id) || !Array.isArray(s.parents) || s.parents.length > 8 || !s.parents.every((p: unknown) => typeof p === 'string' && HASH.test(p))) return false;
    if (typeof s.message !== 'string' || s.message.length > 5000 || typeof s.author_name !== 'string' || s.author_name.length > 100) return false;
    if (!Number.isFinite(s.ts) || s.ts < 0 || s.ts > Date.now() + 86_400_000) return false;
    if (!s.tree || typeof s.tree !== 'object') return false;
    const paths = Object.keys(s.tree);
    if (paths.length > config.limits.maxFiles) return false;
    for (const p of paths) {
        const e = s.tree[p];
        if (normalizePath(p) !== p || !e || typeof e.h !== 'string' || !HASH.test(e.h) || !Number.isInteger(e.s) || e.s < 0 || e.s > config.limits.maxFileBytes) return false;
    }
    return computeSnapshotId({ tree: s.tree, parents: s.parents, message: s.message, authorName: s.author_name, ts: s.ts }) === s.id;
}

async function insertWire(d: typeof db, projectId: string, s: WireSnapshot) {
    await d.q(
        `INSERT INTO snapshots (project_id, id, parents, tree, author_id, author_name, message, created_at)
         VALUES ($1, $2, $3, $4::jsonb, NULL, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [projectId, s.id, s.parents, JSON.stringify(s.tree), s.author_name, s.message, new Date(s.ts)]
    );
    await registerBlobs(d, projectId, s.tree);
}

/* ---------- server side of the protocol ---------- */

export async function syncRefs(project: ProjectRow) {
    const branches = await db.q<{ name: string; head: string | null }>('SELECT name, head FROM branches WHERE project_id = $1 AND tracking IS NULL', [project.id]);
    const tags = await db.q<{ name: string; snapshot_id: string; message: string }>('SELECT name, snapshot_id, message FROM tags WHERE project_id = $1', [project.id]);
    return {
        default: project.default_branch,
        branches: Object.fromEntries(branches.map((b) => [b.name, b.head])),
        tags: Object.fromEntries(tags.map((t) => [t.name, { id: t.snapshot_id, message: t.message }])),
        ignore: project.ignore_rules
    };
}

const PAGE = 400;

export async function syncSnapshots(projectId: string, want: string, have: string[]) {
    if (!HASH.test(want)) error(400, 'Bad snapshot id');
    const [wanted, owned] = await Promise.all([ancestors(projectId, want), Promise.all(have.filter((h) => HASH.test(h)).slice(0, 20).map((h) => ancestors(projectId, h)))]);
    const skip = new Set(owned.flatMap((m) => [...m.keys()]));
    const ids = [...wanted.entries()].filter(([id]) => !skip.has(id)).sort((a, b) => a[1].t - b[1].t).map(([id]) => id);
    const page = ids.slice(0, PAGE);
    const rows = await db.q<SnapshotRow>(
        'SELECT id, parents, tree, author_id, author_name, message, created_at FROM snapshots WHERE project_id = $1 AND id = ANY($2)',
        [projectId, page]
    );
    const order = new Map(page.map((id, i) => [id, i]));
    rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    return { snapshots: rows.map(toWire), more: ids.length > PAGE };
}

export async function syncBlob(projectId: string, hash: string): Promise<Buffer> {
    if (!HASH.test(hash)) error(400, 'Bad hash');
    const ok = await db.one('SELECT 1 FROM project_blobs WHERE project_id = $1 AND hash = $2', [projectId, hash]);
    if (!ok) error(404, 'Blob not found');
    return getBlob(hash);
}

export interface PushBody {
    branch: string;
    old: string | null;
    new: string;
    force?: boolean;
    snapshots: WireSnapshot[];
}

export async function receivePush(project: ProjectRow, actor: Actor, canForce: boolean, body: PushBody, commit: boolean) {
    const problem = validateBranchName(String(body?.branch ?? ''));
    if (problem) error(400, problem);
    if (!HASH.test(String(body.new)) || !Array.isArray(body.snapshots) || body.snapshots.length > 2000) error(400, 'Malformed push');
    if (body.old !== null && !HASH.test(String(body.old))) error(400, 'Malformed push');
    if (!body.snapshots.every(verifyWire)) error(400, 'Push contained an invalid or tampered snapshot');

    const batch = new Set(body.snapshots.map((s) => s.id));
    const external = [...new Set(body.snapshots.flatMap((s) => s.parents).filter((p) => !batch.has(p)))];
    if (external.length) {
        const have = await db.q<{ id: string }>('SELECT id FROM snapshots WHERE project_id = $1 AND id = ANY($2)', [project.id, external]);
        if (have.length !== external.length) error(400, 'Push is missing parent snapshots; send more history.');
    }
    if (!batch.has(body.new) && !(await getSnapshot(project.id, body.new))) error(400, 'The pushed head is unknown.');

    const hashes = [...new Set(body.snapshots.flatMap((s) => Object.values(s.tree).map((e) => e.h)))];
    const present = await blobsExist(hashes);
    const missing = hashes.filter((h) => !present.has(h));
    if (!commit) return { missing };
    if (missing.length) return { missing, retry: true };

    await tx(async (d) => {
        for (const s of body.snapshots) await insertWire(d as typeof db, project.id, s);
        let b = await getBranch(project.id, body.branch, d);
        if (b?.tracking) error(400, 'That branch is a remote-tracking branch.');
        if (!b) {
            if (body.old) error(409, 'The remote branch no longer exists.');
            await d.q('INSERT INTO branches (project_id, name, head) VALUES ($1, $2, NULL)', [project.id, body.branch]);
            b = { name: body.branch, head: null, tracking: null, updated_at: new Date() };
        }
        if ((b.head ?? null) !== (body.old ?? null) && !body.force) error(409, 'The remote branch moved. Pull first, then push again.');
        if (b.head && !(await isAncestor(project.id, b.head, body.new))) {
            if (!body.force) error(409, 'Not a fast-forward. Pull and merge first, or force push.');
            if (!canForce) error(403, 'Force pushing needs admin access.');
        }
        if (!(await moveBranch(d, project.id, body.branch, b.head, body.new))) error(409, 'The remote branch moved while pushing.');
        await d.q('UPDATE projects SET updated_at = now() WHERE id = $1', [project.id]);
    });
    await publish({ projectId: project.id, actorId: actor.id, type: 'snapshot.created', data: { branch: body.branch, snapshot: body.new, message: 'Pushed from a remote', files: undefined } });
    await announceBranchMove(project.id, body.branch);
    return { missing: [], ok: true };
}

export async function receiveBlob(project: ProjectRow, hash: string, data: Buffer) {
    if (!HASH.test(hash)) error(400, 'Bad hash');
    if (data.length > config.limits.maxFileBytes) error(413, 'File too large');
    if (sha256(data) !== hash) error(400, 'Hash mismatch');
    await putBlobWithHash(hash, data);
}

/* ---------- client side: talking to other Bitlin servers ---------- */

export function parseRemoteUrl(raw: string) {
    let u: URL;
    try {
        u = new URL(raw.trim());
    } catch {
        error(400, 'That is not a valid URL.');
    }
    if (!/^https?:$/.test(u.protocol)) error(400, 'Remote URLs must start with http:// or https://');
    const m = u.pathname.match(/^\/\*?([A-Za-z0-9_-]+)\/([A-Za-z0-9._-]+)\/?$/);
    if (!m) error(400, 'Use a project address like https://bitlin.dev/*user/project');
    return { base: `${u.origin}/api/sync/${m[1].toLowerCase()}/${m[2]}`, canonical: `${u.origin}/*${m[1].toLowerCase()}/${m[2]}`, host: u.hostname };
}

function isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    const l = ip.toLowerCase();
    if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7));
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb');
}

// Blocks server-side request forgery against internal services (best effort; DNS can still rebind).
async function assertPublicHost(host: string) {
    if (config.allowPrivateRemotes) return;
    const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
    if (!ips.length) error(400, `Could not resolve ${host}.`);
    if (ips.some(isPrivateIp)) error(400, 'Remotes on private or internal addresses are not allowed.');
}

interface RemoteRow {
    name: string;
    url: string;
    token_enc: string | null;
}

async function rfetch(remote: RemoteRow, path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
    const { base, host } = parseRemoteUrl(remote.url);
    await assertPublicHost(host);
    const headers = new Headers(init.headers);
    const token = remote.token_enc ? decrypt(remote.token_enc) : null;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('User-Agent', 'bitlin-sync');
    headers.set('Accept', 'application/json, application/octet-stream');
    const res = await fetch(`${base}${path}`, { ...init, headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) }).catch((e) => error(502, `Could not reach the remote (${(e as Error).message}).`));
    if (res.status >= 300 && res.status < 400) error(502, 'The remote redirected the request; use its final address.');
    if (res.status === 401 || res.status === 403) error(403, 'The remote refused access. Check the access token.');
    if (res.status === 404) error(404, 'The remote project was not found (or needs a token).');
    if (!res.ok) {
        const msg = await res.json().then((j: any) => j?.message, () => null);
        error(res.status === 409 ? 409 : 502, msg ?? `The remote answered ${res.status}.`);
    }
    return res;
}

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
    const queue = [...items];
    await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
        for (let t = queue.shift(); t !== undefined; t = queue.shift()) await fn(t);
    }));
}

export async function fetchRemote(project: ProjectRow, remote: RemoteRow, actor: Actor) {
    const refs = (await (await rfetch(remote, '/refs')).json()) as { branches: Record<string, string | null> };
    const entries = Object.entries(refs.branches ?? {}).filter(([n, h]) => h && HASH.test(h) && !validateBranchName(n)).slice(0, 50) as [string, string][];

    const known = await db.q<{ name: string; head: string | null }>('SELECT name, head FROM branches WHERE project_id = $1', [project.id]);
    const haves = new Set(known.map((k) => k.head).filter(Boolean) as string[]);
    const newHashes = new Set<string>();
    let added = 0;
    const MAX_SNAPSHOTS = 10_000;

    for (const [, head] of entries) {
        if (await getSnapshot(project.id, head)) continue;
        for (let guard = 0; guard < 40; guard++) {
            const q = new URLSearchParams({ want: head, have: [...haves].slice(-20).join(',') });
            const page = (await (await rfetch(remote, `/snapshots?${q}`, {}, 60_000)).json()) as { snapshots: unknown[]; more: boolean };
            const valid = page.snapshots.filter(verifyWire);
            if (valid.length !== page.snapshots.length) error(502, 'The remote sent a snapshot that failed verification.');
            await tx(async (d) => {
                for (const s of valid) await insertWire(d as typeof db, project.id, s);
            });
            for (const s of valid) for (const e of Object.values(s.tree)) newHashes.add(e.h);
            added += valid.length;
            if (added > MAX_SNAPSHOTS) error(413, 'That remote has more history than one fetch can import.');
            if (!page.more || !valid.length) break;
            for (const s of valid.slice(-10)) haves.add(s.id);
        }
        haves.add(head);
    }

    const present = await blobsExist([...newHashes]);
    const todo = [...newHashes].filter((h) => !present.has(h));
    let bytes = 0;
    await pool(todo, 5, async (hash) => {
        const res = await rfetch(remote, `/blob/${hash}`, {}, 120_000);
        const buf = Buffer.from(await res.arrayBuffer());
        bytes += buf.length;
        if (bytes > 1024 ** 3) error(413, 'That fetch is larger than 1 GB.');
        if (sha256(buf) !== hash) error(502, 'The remote sent a corrupted file.');
        await putBlobWithHash(hash, buf);
    });

    await tx(async (d) => {
        for (const [name, head] of entries) {
            await d.q(
                `INSERT INTO branches (project_id, name, head, tracking) VALUES ($1, $2, $3, $4)
                 ON CONFLICT (project_id, name) DO UPDATE SET head = EXCLUDED.head, updated_at = now() WHERE branches.tracking = EXCLUDED.tracking`,
                [project.id, `${remote.name}/${name}`, head, remote.name]
            );
        }
        await d.q('DELETE FROM branches WHERE project_id = $1 AND tracking = $2 AND NOT (name = ANY($3))', [project.id, remote.name, entries.map(([n]) => `${remote.name}/${n}`)]);
        await d.q('UPDATE remotes SET last_fetched_at = now() WHERE project_id = $1 AND name = $2', [project.id, remote.name]);
    });
    await publish({ projectId: project.id, actorId: actor.id, type: 'remote.pulled', data: { remote: remote.name, snapshots: added, branches: entries.length } });
    return { snapshots: added, blobs: todo.length, branches: entries.length };
}

export async function pushToRemote(project: ProjectRow, remote: RemoteRow, actor: Actor, localBranch: string, remoteBranch: string, force: boolean) {
    const local = await getBranch(project.id, localBranch);
    if (!local?.head) error(400, 'That branch has no snapshots to push.');
    const nameProblem = validateBranchName(remoteBranch);
    if (nameProblem) error(400, nameProblem);

    const refs = (await (await rfetch(remote, '/refs')).json()) as { branches: Record<string, string | null> };
    const remoteHead = refs.branches?.[remoteBranch] ?? null;
    const mine = await ancestors(project.id, local.head);
    let theirs = new Set<string>();
    if (remoteHead) {
        const known = await ancestors(project.id, remoteHead);
        if (!known.size && !force) error(409, 'The remote has changes you have not fetched. Fetch, merge, then push.');
        if (known.size && !mine.has(remoteHead) && !force) error(409, 'The remote has changes you do not have. Fetch and merge first, or force push.');
        theirs = new Set(known.keys());
    }
    const send = [...mine.keys()].filter((id) => !theirs.has(id));
    if (send.length > 2000) error(413, 'Too much new history for one push (limit 2000 snapshots).');
    const rows = await db.q<SnapshotRow>('SELECT id, parents, tree, author_id, author_name, message, created_at FROM snapshots WHERE project_id = $1 AND id = ANY($2) ORDER BY created_at', [project.id, send]);
    const body: PushBody = { branch: remoteBranch, old: remoteHead, new: local.head, force, snapshots: rows.map(toWire) };
    const json = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json' };

    const begin = (await (await rfetch(remote, '/push/begin', { method: 'POST', headers, body: json }, 60_000)).json()) as { missing: string[] };
    await pool(begin.missing, 4, async (hash) => {
        const data = await getBlob(hash);
        await rfetch(remote, `/blob/${hash}`, { method: 'PUT', body: new Uint8Array(data), headers: { 'Content-Type': 'application/octet-stream' } }, 120_000);
    });
    await rfetch(remote, '/push/commit', { method: 'POST', headers, body: json }, 60_000);

    await db.q(
        `INSERT INTO branches (project_id, name, head, tracking) VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, name) DO UPDATE SET head = EXCLUDED.head, updated_at = now() WHERE branches.tracking = EXCLUDED.tracking`,
        [project.id, `${remote.name}/${remoteBranch}`, local.head, remote.name]
    );
    await publish({ projectId: project.id, actorId: actor.id, type: 'remote.pushed', data: { remote: remote.name, branch: remoteBranch, snapshots: rows.length } });
    return { snapshots: rows.length, blobs: begin.missing.length };
}
