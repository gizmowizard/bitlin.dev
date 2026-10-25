import { error } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { config } from './config.ts';
import { randomToken } from './crypto.ts';
import type { OAuthProfile } from './users.ts';

interface Provider {
    label: string;
    authUrl: string;
    tokenUrl: string;
    scope: string;
    pkce: boolean;
    profile(token: string): Promise<OAuthProfile>;
}

const TIMEOUT = 10_000;

async function getJson(url: string, token: string, extra: Record<string, string> = {}) {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'bitlin', ...extra },
        signal: AbortSignal.timeout(TIMEOUT)
    });
    if (!res.ok) error(502, 'The sign-in provider rejected the request.');
    return res.json() as Promise<Record<string, any>>;
}

const PROVIDERS: Record<string, Provider> = {
    github: {
        label: 'GitHub',
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: 'read:user',
        pkce: false,
        async profile(token) {
            const u = await getJson('https://api.github.com/user', token, { Accept: 'application/vnd.github+json' });
            return { id: String(u.id), login: String(u.login), name: u.name ?? u.login, avatar: u.avatar_url ?? null };
        }
    },
    google: {
        label: 'Google',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'openid profile',
        pkce: true,
        async profile(token) {
            const u = await getJson('https://openidconnect.googleapis.com/v1/userinfo', token);
            const name = String(u.name ?? u.given_name ?? 'user');
            return { id: String(u.sub), login: name.replace(/\s+/g, '').toLowerCase(), name, avatar: u.picture ?? null };
        }
    },
    discord: {
        label: 'Discord',
        authUrl: 'https://discord.com/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        scope: 'identify',
        pkce: true,
        async profile(token) {
            const u = await getJson('https://discord.com/api/users/@me', token);
            const avatar = u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256` : null;
            return { id: String(u.id), login: String(u.username), name: u.global_name ?? u.username, avatar };
        }
    }
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

export function enabledProviders() {
    return PROVIDER_IDS.filter((id) => config.oauth(id)).map((id) => ({ id, label: PROVIDERS[id].label }));
}

export function providerLabel(id: string) {
    return PROVIDERS[id]?.label ?? id;
}

const redirectUri = (id: string) => `${config.origin}/auth/${id}/callback`;

export function beginAuth(id: string) {
    const p = PROVIDERS[id];
    const creds = config.oauth(id);
    if (!p || !creds) error(404, 'That sign-in method is not available.');
    const state = randomToken(18);
    const verifier = randomToken(32);
    const url = new URL(p.authUrl);
    url.searchParams.set('client_id', creds.id);
    url.searchParams.set('redirect_uri', redirectUri(id));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', p.scope);
    url.searchParams.set('state', state);
    if (p.pkce) {
        url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
        url.searchParams.set('code_challenge_method', 'S256');
    }
    return { url: url.toString(), state, verifier };
}

export async function completeAuth(id: string, code: string, verifier: string): Promise<OAuthProfile> {
    const p = PROVIDERS[id];
    const creds = config.oauth(id);
    if (!p || !creds) error(404, 'That sign-in method is not available.');
    const body = new URLSearchParams({
        client_id: creds.id,
        client_secret: creds.secret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(id)
    });
    if (p.pkce) body.set('code_verifier', verifier);
    const res = await fetch(p.tokenUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(TIMEOUT)
    });
    const json = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (!res.ok || !json.access_token) error(502, 'Could not complete sign-in with that provider.');
    return p.profile(json.access_token);
}
