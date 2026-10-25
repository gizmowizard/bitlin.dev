import { withClient } from './db.ts';

const files = import.meta.glob('./migrations/*.sql', {
    query: '?raw',
    import: 'default',
    eager: true
}) as Record<string, string>;

const LOCK_ID = 727274;

export async function migrate() {
    const names = Object.keys(files).sort();
    // The advisory lock keeps concurrent app instances from racing each other.
    await withClient(async (db) => {
    await db.q('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    try {
        await db.q('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
        const done = new Set((await db.q<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name));
        for (const name of names) {
            if (done.has(name)) continue;
            console.log(`[db] applying ${name}`);
            await db.q('BEGIN');
            try {
                await db.q(files[name]);
                await db.q('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
                await db.q('COMMIT');
            } catch (err) {
                await db.q('ROLLBACK');
                throw err;
            }
        }
    } finally {
        await db.q('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
    }
    });
}
