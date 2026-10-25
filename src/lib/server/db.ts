import pg from 'pg';
import { config } from './config.ts';

const POOL = Symbol.for('bitlin.pg');

// int8 (counts, sizes) fit comfortably in a JS number for our purposes.
pg.types.setTypeParser(20, (v) => Number(v));

function pool(): pg.Pool {
    const g = globalThis as any;
    return (g[POOL] ??= new pg.Pool({
        connectionString: config.databaseUrl,
        max: 20,
        idleTimeoutMillis: 30_000
    }).on('error', (e) => console.error('[pg] idle client error', e.message)));
}

export interface Db {
    q<T = any>(text: string, params?: unknown[]): Promise<T[]>;
    one<T = any>(text: string, params?: unknown[]): Promise<T | null>;
}

function wrap(run: (text: string, params?: unknown[]) => Promise<pg.QueryResult>): Db {
    return {
        async q(text, params) {
            return (await run(text, params)).rows;
        },
        async one(text, params) {
            return (await run(text, params)).rows[0] ?? null;
        }
    };
}

export const db: Db = wrap((t, p) => pool().query(t, p as any[]));

export async function tx<T>(fn: (d: Db) => Promise<T>): Promise<T> {
    const client = await pool().connect();
    try {
        await client.query('BEGIN');
        const out = await fn(wrap((t, p) => client.query(t, p as any[])));
        await client.query('COMMIT');
        return out;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

// Single dedicated connection (needed for session-level advisory locks).
export async function withClient<T>(fn: (d: Db) => Promise<T>): Promise<T> {
    const client = await pool().connect();
    try {
        return await fn(wrap((t, p) => client.query(t, p as any[])));
    } finally {
        client.release();
    }
}

export async function closeDb() {
    const g = globalThis as any;
    await g[POOL]?.end().catch(() => {});
    g[POOL] = undefined;
}

export function isUniqueViolation(err: unknown): boolean {
    return (err as { code?: string })?.code === '23505';
}
