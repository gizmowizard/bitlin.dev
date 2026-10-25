import Redis from 'ioredis';
import { config } from './config.ts';

const MAIN = Symbol.for('bitlin.redis');
const SUB = Symbol.for('bitlin.redis.sub');

function make(name: string): Redis {
    const r = new Redis(config.redisUrl, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
        commandTimeout: 1500,
        retryStrategy: (n) => Math.min(n * 200, 3000)
    });
    let lastLog = 0;
    r.on('error', (e) => {
        // Reconnect storms would otherwise flood the log.
        if (Date.now() - lastLog > 10_000) {
            lastLog = Date.now();
            console.error(`[redis:${name}] ${e.message}`);
        }
    });
    return r;
}

export function redis(): Redis {
    return ((globalThis as any)[MAIN] ??= make('main'));
}

// Pub/sub needs its own connection because a subscribed client can't run other commands.
export function redisSub(): Redis {
    const g = globalThis as any;
    return (g[SUB] ??= new Redis(config.redisUrl, {
        retryStrategy: (n) => Math.min(n * 200, 3000)
    }).on('error', () => {}));
}

export async function closeRedis() {
    const g = globalThis as any;
    for (const k of [MAIN, SUB]) {
        await g[k]?.quit().catch(() => {});
        g[k] = undefined;
    }
}
