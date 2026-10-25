import { Client } from 'minio';
import { config } from './config.ts';
import { db } from './db.ts';
import { sha256 } from './crypto.ts';

const CLIENT = Symbol.for('bitlin.s3');
const CACHE = Symbol.for('bitlin.blobcache');

function s3(): Client {
    const c = config.s3;
    return ((globalThis as any)[CLIENT] ??= new Client({
        endPoint: c.endPoint,
        port: c.port,
        useSSL: c.useSSL,
        accessKey: c.accessKey,
        secretKey: c.secretKey
    }));
}

const keyFor = (hash: string) => `blobs/${hash.slice(0, 2)}/${hash}`;

export async function ensureBucket() {
    const { bucket } = config.s3;
    if (!(await s3().bucketExists(bucket))) await s3().makeBucket(bucket);
}

// Blobs are immutable and content-addressed, so a small in-process cache is always safe.
const cache: Map<string, Buffer> = ((globalThis as any)[CACHE] ??= new Map());
const CACHE_MAX_ENTRY = 512 * 1024;
const CACHE_MAX_COUNT = 300;

export async function putBlob(data: Buffer): Promise<{ hash: string; size: number }> {
    const hash = sha256(data);
    await putBlobWithHash(hash, data);
    return { hash, size: data.length };
}

// Callers that already verified the hash (e.g. push uploads) skip rehashing.
export async function putBlobWithHash(hash: string, data: Buffer): Promise<void> {
    const known = await db.one('SELECT 1 FROM blobs WHERE hash = $1', [hash]);
    if (known) return;
    await s3().putObject(config.s3.bucket, keyFor(hash), data, data.length, {
        'Content-Type': 'application/octet-stream'
    });
    await db.q('INSERT INTO blobs (hash, size) VALUES ($1, $2) ON CONFLICT DO NOTHING', [hash, data.length]);
}

export async function getBlob(hash: string): Promise<Buffer> {
    const hit = cache.get(hash);
    if (hit) return hit;
    const stream = await s3().getObject(config.s3.bucket, keyFor(hash));
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const buf = Buffer.concat(chunks);
    if (buf.length <= CACHE_MAX_ENTRY) {
        if (cache.size >= CACHE_MAX_COUNT) cache.delete(cache.keys().next().value!);
        cache.set(hash, buf);
    }
    return buf;
}

export async function deleteBlobs(hashes: string[]) {
    if (!hashes.length) return;
    await s3().removeObjects(config.s3.bucket, hashes.map(keyFor));
    for (const h of hashes) cache.delete(h);
}

export async function blobsExist(hashes: string[]): Promise<Set<string>> {
    if (!hashes.length) return new Set();
    const rows = await db.q<{ hash: string }>('SELECT hash FROM blobs WHERE hash = ANY($1)', [hashes]);
    return new Set(rows.map((r) => r.hash));
}
