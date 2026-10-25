import { migrate } from './migrate.ts';
import { ensureBucket } from './storage.ts';
import { startFanout, shutdownHub } from './ws/hub.ts';
import { closeDb } from './db.ts';
import { closeRedis, redis } from './redis.ts';
import { runMaintenance } from './gc.ts';

const BOOT = Symbol.for('bitlin.boot');
const SHUTDOWN = Symbol.for('bitlin.shutdown');
const g = globalThis as any;

async function retry<T>(label: string, fn: () => Promise<T>, tries = 30): Promise<T> {
    for (let i = 1; ; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i >= tries) throw err;
            console.warn(`[boot] ${label} not ready (${(err as Error).message}); retrying`);
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
}

// Idempotent: hooks, the WS upgrade path, and dev tooling can all call this safely.
export function ensureBootstrapped(): Promise<void> {
    return (g[BOOT] ??= (async () => {
        await retry('postgres', migrate);
        await retry('object storage', ensureBucket);
        startFanout();
        void redis().ping().catch(() => console.warn('[boot] redis unreachable; limits fall back to in-memory'));
        const timer = setInterval(() => void runMaintenance().catch((e) => console.error('[gc]', e)), 6 * 3600_000);
        timer.unref?.();
        g[SHUTDOWN] = async () => {
            clearInterval(timer);
            shutdownHub();
            await closeRedis();
            await closeDb();
        };
        console.log('[boot] bitlin ready');
    })().catch((err) => {
        g[BOOT] = undefined;
        throw err;
    }));
}
