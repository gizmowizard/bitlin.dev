import type { LiveEvent, PublicUser } from './types.ts';

type Handler = (type: string, data: Record<string, any>) => void;
export interface Presence {
    users: PublicUser[];
    more: number;
    anon: number;
    total: number;
}

class WsClient {
    status = $state<'connecting' | 'open' | 'closed'>('closed');
    presence = $state<Record<string, Presence>>({});
    typers = $state<Record<string, PublicUser[]>>({});

    #socket: WebSocket | null = null;
    #handlers = new Map<string, Set<Handler>>();
    #attempt = 0;
    #timer: ReturnType<typeof setTimeout> | undefined;
    #ping: ReturnType<typeof setInterval> | undefined;
    #typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    #wanted = false;

    connect() {
        if (typeof window === 'undefined' || this.#wanted) return;
        this.#wanted = true;
        this.#open();
    }

    #open() {
        this.status = 'connecting';
        const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
        const ws = new WebSocket(url);
        this.#socket = ws;
        ws.onopen = () => {
            const reconnected = this.#attempt > 0;
            this.#attempt = 0;
            this.status = 'open';
            for (const topic of this.#handlers.keys()) this.#send({ t: 'sub', topic });
            // Anything that happened while we were offline is unknown, so ask pages to refresh.
            if (reconnected) for (const set of this.#handlers.values()) for (const h of set) h('resync', {});
            clearInterval(this.#ping);
            this.#ping = setInterval(() => this.#send({ t: 'ping' }), 25_000);
        };
        ws.onmessage = (m) => {
            let msg: any;
            try {
                msg = JSON.parse(m.data);
            } catch {
                return;
            }
            if (msg.t === 'ev') this.#dispatch(msg as LiveEvent);
        };
        ws.onclose = (e) => {
            clearInterval(this.#ping);
            this.status = 'closed';
            this.#socket = null;
            if (!this.#wanted || e.code === 4401) return;
            const delay = Math.min(15_000, 500 * 2 ** this.#attempt++) * (0.7 + Math.random() * 0.6);
            this.#timer = setTimeout(() => this.#open(), delay);
        };
        ws.onerror = () => ws.close();
    }

    #send(payload: object) {
        if (this.#socket?.readyState === WebSocket.OPEN) this.#socket.send(JSON.stringify(payload));
    }

    #dispatch(ev: LiveEvent) {
        if (ev.type === 'presence') this.presence[ev.topic] = ev.data as Presence;
        else if (ev.type === 'typing') this.#onTyping(ev);
        for (const h of this.#handlers.get(ev.topic) ?? []) h(ev.type, ev.data);
    }

    #onTyping(ev: LiveEvent) {
        const key = `${ev.topic}|${ev.data.ctx}`;
        const user = ev.data.user as PublicUser;
        const list = (this.typers[key] ?? []).filter((u) => u.id !== user.id);
        this.typers[key] = [...list, user];
        const tk = `${key}|${user.id}`;
        clearTimeout(this.#typingTimers.get(tk));
        this.#typingTimers.set(
            tk,
            setTimeout(() => (this.typers[key] = (this.typers[key] ?? []).filter((u) => u.id !== user.id)), 4000)
        );
    }

    /** Subscribe a handler to a topic; returns an unsubscribe function. */
    on(topic: string, handler: Handler): () => void {
        this.connect();
        let set = this.#handlers.get(topic);
        if (!set) {
            this.#handlers.set(topic, (set = new Set()));
            this.#send({ t: 'sub', topic });
        }
        set.add(handler);
        return () => {
            set.delete(handler);
            if (!set.size) {
                this.#handlers.delete(topic);
                delete this.presence[topic];
                this.#send({ t: 'unsub', topic });
            }
        };
    }

    typing(topic: string, ctx: string) {
        this.#send({ t: 'typing', topic, ctx });
    }
}

export const ws = new WsClient();
