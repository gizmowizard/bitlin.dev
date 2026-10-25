import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { config } from '../config.ts';
import { db } from '../db.ts';
import { roleFor, can } from '../access.ts';
import { limit } from '../ratelimit.ts';
import { sessionUser, SESSION_COOKIE } from '../auth.ts';
import { ensureBootstrapped } from '../bootstrap.ts';
import { addClient, deliverLocal, emit, hub, presenceFor, removeClient, send, setRevalidator, subscribe, unsubscribe, type Client } from './hub.ts';

const WSS = Symbol.for('bitlin.wss');
const UPGRADE = Symbol.for('bitlin.ws.upgrade');
const g = globalThis as any;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PROJECT_TOPIC = new RegExp(`^project:(${UUID})$`);
const USER_TOPIC = new RegExp(`^user:(${UUID})$`);
const MAX_TOPICS = 24;
const MAX_MSGS_PER_10S = 60;

function wss(): WebSocketServer {
    return (g[WSS] ??= new WebSocketServer({ noServer: true, maxPayload: 8 * 1024, perMessageDeflate: false }));
}

function parseCookie(header: string | undefined, name: string): string | undefined {
    for (const part of (header ?? '').split(';')) {
        const i = part.indexOf('=');
        if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
    }
}

function reject(socket: Duplex, status: string) {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
}

export async function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    socket.on('error', () => {});
    await ensureBootstrapped();

    const origin = req.headers.origin;
    if (origin && origin !== config.origin && config.prod) return reject(socket, '403 Forbidden');

    const ipHeader = req.headers[config.ipHeader];
    const ip = (Array.isArray(ipHeader) ? ipHeader[0] : ipHeader)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (!(await limit('ws.connect', ip)).ok) return reject(socket, '429 Too Many Requests');

    const session = await sessionUser(parseCookie(req.headers.cookie, SESSION_COOKIE)).catch(() => null);

    wss().handleUpgrade(req, socket, head, (ws) => {
        const client: Client = {
            id: randomUUID(),
            ws,
            user: session ? { id: session.user.id, username: session.user.username, display_name: session.user.display_name, avatar_url: session.user.avatar_url } : null,
            sessionHash: session?.hash ?? null,
            topics: new Set(),
            alive: true,
            ip,
            window: { start: Date.now(), count: 0 },
            typingAt: new Map()
        };
        addClient(client);
        send(client, { t: 'hello', user: client.user?.id ?? null });
        ws.on('pong', () => (client.alive = true));
        ws.on('message', (raw) => void onMessage(client, raw.toString()).catch((e) => console.error('[ws] message error', e)));
        ws.on('close', () => removeClient(client));
        ws.on('error', () => ws.terminate());
    });
}

async function canSubscribe(c: Client, topic: string): Promise<boolean> {
    if (topic === 'explore') return true;
    const u = topic.match(USER_TOPIC);
    if (u) return c.user?.id === u[1];
    const p = topic.match(PROJECT_TOPIC);
    if (p) return can(await roleFor(p[1], c.user?.id ?? null), 'read');
    return false;
}

setRevalidator((c, topic) => canSubscribe(c, topic));

async function onMessage(c: Client, raw: string) {
    const now = Date.now();
    if (now - c.window.start > 10_000) c.window = { start: now, count: 0 };
    if (++c.window.count > MAX_MSGS_PER_10S) return c.ws.close(4429, 'rate limited');

    let msg: { t?: string; topic?: string; ctx?: string };
    try {
        msg = JSON.parse(raw);
    } catch {
        return;
    }
    const topic = typeof msg.topic === 'string' ? msg.topic : '';

    switch (msg.t) {
        case 'ping':
            return send(c, { t: 'pong' });
        case 'sub': {
            if (c.topics.size >= MAX_TOPICS) return send(c, { t: 'err', topic, code: 'too_many' });
            if (!(await canSubscribe(c, topic))) return send(c, { t: 'err', topic, code: 'denied' });
            subscribe(c, topic);
            send(c, { t: 'subbed', topic });
            if (topic.startsWith('project:')) send(c, { t: 'ev', topic, type: 'presence', data: presenceFor(topic), ts: Date.now() });
            return;
        }
        case 'unsub':
            if (!topic.startsWith('user:')) unsubscribe(c, topic);
            return;
        case 'typing': {
            if (!c.user || !c.topics.has(topic) || typeof msg.ctx !== 'string' || msg.ctx.length > 80) return;
            const key = `${topic}|${msg.ctx}`;
            if (now - (c.typingAt.get(key) ?? 0) < 1500) return;
            c.typingAt.set(key, now);
            if (c.typingAt.size > 50) c.typingAt.clear();
            emit(topic, 'typing', { ctx: msg.ctx, user: c.user });
            return;
        }
    }
}

export function installUpgrade() {
    g[UPGRADE] = handleUpgrade;
}

// Exposed so tests and the dev server can reach the exact same state.
export const _internal = { hub, deliverLocal, db };
