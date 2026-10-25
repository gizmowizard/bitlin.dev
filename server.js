// Production entry. SvelteKit's bundle owns ALL application state (including the
// WebSocket hub); this file only forwards HTTP upgrades into that same bundle via
// a globalThis hook, so there is never a second copy of the connection maps.
import http from 'node:http';
import { handler } from './build/handler.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const UPGRADE = Symbol.for('bitlin.ws.upgrade');
const SHUTDOWN = Symbol.for('bitlin.shutdown');

const server = http.createServer(handler);

server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://x');
    const upgrade = globalThis[UPGRADE];
    if (pathname !== '/ws' || typeof upgrade !== 'function') {
        socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
        return socket.destroy();
    }
    Promise.resolve(upgrade(req, socket, head)).catch((err) => {
        console.error('[ws] upgrade failed', err);
        socket.destroy();
    });
});

server.listen(port, host, () => console.log(`bitlin listening on ${host}:${port}`));

let closing = false;
async function shutdown(signal) {
    if (closing) return;
    closing = true;
    console.log(`${signal} received, shutting down`);
    try {
        await globalThis[SHUTDOWN]?.();
    } catch {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
