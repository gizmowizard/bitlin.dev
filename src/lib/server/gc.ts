import { db } from './db.ts';
import { deleteBlobs } from './storage.ts';
import { purgeExpiredSessions } from './auth.ts';
import { redis } from './redis.ts';

// Blobs only referenced by abandoned uploads are removed after a grace period.
async function collectBlobs() {
    for (let round = 0; round < 20; round++) {
        const rows = await db.q<{ hash: string }>(
            `SELECT b.hash FROM blobs b
              WHERE b.created_at < now() - interval '2 days'
                AND NOT EXISTS (SELECT 1 FROM project_blobs p WHERE p.hash = b.hash)
                AND NOT EXISTS (SELECT 1 FROM draft_changes d WHERE d.hash = b.hash)
              LIMIT 500`
        );
        if (!rows.length) return;
        const hashes = rows.map((r) => r.hash);
        await deleteBlobs(hashes);
        await db.q('DELETE FROM blobs WHERE hash = ANY($1)', [hashes]);
    }
}

export async function runMaintenance() {
    // Only one instance needs to do the work.
    const got = await redis().set('bitlin:maintenance', '1', 'EX', 3600, 'NX').catch(() => 'OK');
    if (got !== 'OK') return;
    await purgeExpiredSessions();
    await db.q(`DELETE FROM draft_changes WHERE updated_at < now() - interval '60 days'`);
    await collectBlobs();
}
