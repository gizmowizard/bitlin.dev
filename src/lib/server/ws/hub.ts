import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { redis, redisSub } from '../redis.ts';
import type { PublicUser } from '../../types.ts';

// ALL connection state lives on globalThis. SvelteKit's bundle and Vite's dev module graph can
// each evaluate this file separately; without a shared object, events emitted from routes would
// reach a different (empty) copy than the one holding the sockets.
export interface Client {
    id: string;
    ws: WebSocket;
    user: PublicUser | null;
    sessionHash: string | null;
    topics: Set<string>;
    alive: boolean;
    ip: string;
    window: { start: number; count: number };
    typingAt: Map<string, number>;
}

interface HubState {
    instance: string;
    clients: Map<string, Client>;
    topics: Map<string, Set<Client>>;
    fanoutStarted: boolean;
    heartbeat?: ReturnType<typeof setInterval>;
}

const KEY = Symbol.for('bitlin.hub');
const g = globalThis as any;
export const hub: HubState = (g[KEY] ??= {
    instance: randomUUID(),
    clients: new Map(),
    topics: new Map(),
    fanoutStarted: false
});

const CHANNEL = 'bitlin:events';

export function send(c: Client, payload: unknown) {
    if (c.ws.readyState === 1) c.ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

export function addClient(c: Client) {
    hub.clients.set(c.id, c);
    if (c.user) subscribe(c, `user:${c.user.id}`);
}

export function removeClient(c: Client) {
    hub.clients.delete(c.id);
    for (const t of [...c.topics]) unsubscribe(c, t);
}

export function subscribe(c: Client, topic: string) {
    if (c.topics.has(topic)) return;
    c.topics.add(topic);
    let set = hub.topics.get(topic);
    if (!set) hub.topics.set(topic, (set = new Set()));
    set.add(c);
    if (topic.startsWith('project:')) broadcastPresence(topic);
}

export function unsubscribe(c: Client, topic: string) {
    if (!c.topics.delete(topic)) return;
    const set = hub.topics.get(topic);
    set?.delete(c);
    if (set && set.size === 0) hub.topics.delete(topic);
    else if (topic.startsWith('project:')) broadcastPresence(topic);
}

export function presenceFor(topic: string) {
    const users = new Map<string, PublicUser>();
    let anon = 0;
    for (const c of hub.topics.get(topic) ?? []) {
        if (c.user) users.set(c.user.id, c.user);
        else anon++;
    }
    const list = [...users.values()];
    return { users: list.slice(0, 12), more: Math.max(0, list.length - 12), anon, total: list.length + anon };
}

// Presence is tracked per process; single-node deployments (the documented setup) see everyone.
export function broadcastPresence(topic: string) {
    deliverLocal(topic, 'presence', presenceFor(topic));
}

export function deliverLocal(topic: string, type: string, data: Record<string, unknown>) {
    const set = hub.topics.get(topic);
    if (!set?.size) return;
    const msg = JSON.stringify({ t: 'ev', topic, type, data, ts: Date.now() });
    for (const c of set) send(c, msg);
}

// Delivers to this process immediately and to sibling instances through Redis.
export function emit(topic: string, type: string, data: Record<string, unknown> = {}) {
    deliverLocal(topic, type, data);
    redis()
        .publish(CHANNEL, JSON.stringify({ o: hub.instance, topic, type, data }))
        .catch(() => {});
}

export function startFanout() {
    if (hub.fanoutStarted) return;
    hub.fanoutStarted = true;
    const sub = redisSub();
    sub.subscribe(CHANNEL).catch((e) => console.error('[ws] redis subscribe failed', e.message));
    sub.on('message', (_ch, raw) => {
        try {
            const m = JSON.parse(raw);
            if (m.o === hub.instance) return;
            if (m.type === '__revalidate') void revalidateTopic(m.topic);
            else deliverLocal(m.topic, m.type, m.data);
        } catch {
            /* ignore malformed messages */
        }
    });
    hub.heartbeat = setInterval(() => {
        for (const c of hub.clients.values()) {
            if (!c.alive) {
                c.ws.terminate();
                continue;
            }
            c.alive = false;
            c.ws.ping();
        }
    }, 30_000);
    hub.heartbeat.unref?.();
}

type Revalidator = (c: Client, topic: string) => Promise<boolean>;
let revalidator: Revalidator | null = null;
export const setRevalidator = (fn: Revalidator) => (revalidator = fn);

// After access changes (visibility, collaborators), drop subscribers who can no longer read.
export async function revalidateTopic(topic: string) {
    if (!revalidator) return;
    for (const c of [...(hub.topics.get(topic) ?? [])]) {
        if (!(await revalidator(c, topic))) {
            unsubscribe(c, topic);
            send(c, { t: 'unsubbed', topic, reason: 'access' });
        }
    }
}

export function announceAccessChange(projectId: string) {
    const topic = `project:${projectId}`;
    void revalidateTopic(topic);
    redis().publish(CHANNEL, JSON.stringify({ o: hub.instance, topic, type: '__revalidate', data: {} })).catch(() => {});
}

export function closeSessionSockets(sessionHash: string) {
    for (const c of hub.clients.values()) if (c.sessionHash === sessionHash) c.ws.close(4401, 'signed out');
}

export function shutdownHub() {
    clearInterval(hub.heartbeat);
    for (const c of hub.clients.values()) c.ws.close(1001, 'server restarting');
}
