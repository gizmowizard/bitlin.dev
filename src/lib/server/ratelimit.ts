import { error, type RequestEvent } from '@sveltejs/kit';
import { config } from './config.ts';
import { redis } from './redis.ts';

// [max requests, window in seconds]
export const LIMITS = {
    api: [900, 60],
    auth: [30, 600],
    'project.create': [15, 3600],
    fork: [10, 3600],
    snapshot: [40, 60],
    upload: [40, 60],
    stage: [120, 60],
    branch: [40, 60],
    tag: [30, 60],
    merge: [30, 60],
    restore: [30, 60],
    proposal: [30, 300],
    comment: [40, 60],
    remote: [20, 60],
    collab: [30, 60],
    settings: [40, 60],
    markdown: [90, 60],
    download: [30, 60],
    'ws.connect': [60, 60],
    sync: [600, 60]
} as const satisfies Record<string, readonly [number, number]>;

export type LimitAction = keyof typeof LIMITS;

const SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {c, redis.call('PTTL', KEYS[1])}`;

// Fallback so a Redis outage degrades to per-process limiting instead of no limiting.
const local = new Map<string, { n: number; reset: number }>();

export interface LimitResult {
    ok: boolean;
    remaining: number;
    retryAfter: number;
}

export async function limit(action: LimitAction, key: string): Promise<LimitResult> {
    const [max, windowSec] = LIMITS[action];
    const k = `rl:${action}:${key}`;
    let count: number;
    let ttlMs: number;
    try {
        const [c, t] = (await redis().eval(SCRIPT, 1, k, windowSec * 1000)) as [number, number];
        count = c;
        ttlMs = t < 0 ? windowSec * 1000 : t;
    } catch {
        const now = Date.now();
        const entry = local.get(k);
        if (!entry || entry.reset < now) local.set(k, { n: 1, reset: now + windowSec * 1000 });
        else entry.n++;
        const cur = local.get(k)!;
        count = cur.n;
        ttlMs = cur.reset - now;
        if (local.size > 20_000) for (const [lk, v] of local) if (v.reset < now) local.delete(lk);
    }
    return { ok: count <= max, remaining: Math.max(0, max - count), retryAfter: Math.ceil(ttlMs / 1000) };
}

export function clientIp(event: Pick<RequestEvent, 'request' | 'getClientAddress'>, header: string): string {
    const h = event.request.headers.get(header);
    if (h) return h.split(',')[0].trim();
    try {
        return event.getClientAddress();
    } catch {
        return 'unknown';
    }
}

// Throws a 429 error page/JSON; keyed by user when signed in, otherwise by IP.
export async function enforce(event: RequestEvent, action: LimitAction): Promise<void> {
    const key = event.locals.user?.id ?? clientIp(event, config.ipHeader);
    const res = await limit(action, key);
    if (!res.ok) {
        event.setHeaders({ 'retry-after': String(res.retryAfter) });
        error(429, `Too many requests. Try again in ${res.retryAfter}s.`);
    }
}
