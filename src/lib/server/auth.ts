import type { Cookies } from '@sveltejs/kit';
import { config } from './config.ts';
import { db } from './db.ts';
import { randomToken, sha256 } from './crypto.ts';
import type { SessionUser } from '../types.ts';

export const SESSION_COOKIE = 'bitlin_session';
const SESSION_DAYS = 30;

const USER_SELECT = 'u.id, u.username, u.display_name, u.avatar_url, u.onboarded, u.timezone, u.region';

export async function createSession(cookies: Cookies, userId: string, userAgent: string | null) {
    const token = randomToken();
    await db.q(
        `INSERT INTO sessions (token_hash, user_id, user_agent, expires_at)
         VALUES ($1, $2, $3, now() + make_interval(days => $4))`,
        [sha256(token), userId, userAgent?.slice(0, 300) ?? null, SESSION_DAYS]
    );
    setSessionCookie(cookies, token);
}

function setSessionCookie(cookies: Cookies, token: string) {
    cookies.set(SESSION_COOKIE, token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: config.prod,
        maxAge: SESSION_DAYS * 86400
    });
}

export async function sessionUser(token: string | undefined): Promise<{ user: SessionUser; hash: string } | null> {
    if (!token) return null;
    const hash = sha256(token);
    const user = await db.one<SessionUser>(
        `SELECT ${USER_SELECT} FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [hash]
    );
    return user ? { user, hash } : null;
}

// Sessions slide forward, but only write when a meaningful chunk of the lifetime has passed.
export async function refreshSession(cookies: Cookies, token: string) {
    const res = await db.q(
        `UPDATE sessions SET expires_at = now() + make_interval(days => $2)
          WHERE token_hash = $1 AND expires_at < now() + make_interval(days => $3) RETURNING 1`,
        [sha256(token), SESSION_DAYS, SESSION_DAYS - 7]
    );
    if (res.length) setSessionCookie(cookies, token);
}

export async function destroySession(cookies: Cookies) {
    const token = cookies.get(SESSION_COOKIE);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    if (!token) return null;
    const hash = sha256(token);
    await db.q('DELETE FROM sessions WHERE token_hash = $1', [hash]);
    return hash;
}

export async function purgeExpiredSessions() {
    await db.q('DELETE FROM sessions WHERE expires_at < now()');
}

// Personal access tokens authenticate remote sync calls (no cookies involved).
export async function createApiToken(userId: string, name: string, canWrite: boolean) {
    const token = `bit_${randomToken(30)}`;
    await db.q(
        `INSERT INTO api_tokens (user_id, name, token_hash, prefix, can_write) VALUES ($1, $2, $3, $4, $5)`,
        [userId, name, sha256(token), token.slice(0, 10), canWrite]
    );
    return token;
}

export async function authenticateBearer(header: string | null): Promise<{ user: SessionUser; canWrite: boolean } | null> {
    const m = header?.match(/^Bearer\s+(bit_[A-Za-z0-9_-]+)$/);
    if (!m) return null;
    const row = await db.one<SessionUser & { can_write: boolean; token_id: string }>(
        `SELECT ${USER_SELECT}, t.can_write, t.id AS token_id
           FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1`,
        [sha256(m[1])]
    );
    if (!row) return null;
    db.q('UPDATE api_tokens SET last_used_at = now() WHERE id = $1', [row.token_id]).catch(() => {});
    const { can_write, token_id, ...user } = row;
    return { user, canWrite: can_write };
}
