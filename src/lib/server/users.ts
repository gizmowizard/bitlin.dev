import { error } from '@sveltejs/kit';
import { db, isUniqueViolation } from './db.ts';
import { RESERVED_USERNAMES, USERNAME_RE, BIO_MAX_WORDS, wordCount, isValidTimezone } from '../util.ts';
import { REGION_CODES } from '../regions.ts';
import type { PublicUser } from '../types.ts';

export interface Profile extends PublicUser {
    bio: string;
    timezone: string;
    region: string | null;
    created_at: Date;
}

const PROFILE_COLS = 'id, username, display_name, avatar_url, bio, timezone, region, created_at';

export const getProfile = (username: string) =>
    db.one<Profile>(`SELECT ${PROFILE_COLS} FROM users WHERE lower(username) = lower($1)`, [username]);

export const getProfileById = (id: string) => db.one<Profile>(`SELECT ${PROFILE_COLS} FROM users WHERE id = $1`, [id]);

export function validateUsername(name: string): string | null {
    if (!USERNAME_RE.test(name)) return 'Usernames are 2–32 characters: lowercase letters, numbers, “-” and “_”, starting with a letter or number.';
    if (RESERVED_USERNAMES.has(name)) return 'That username is reserved.';
    return null;
}

export interface ProfileInput {
    username: string;
    display_name: string;
    bio: string;
    timezone: string;
    region: string | null;
}

export function validateProfile(input: ProfileInput): string | null {
    const un = validateUsername(input.username);
    if (un) return un;
    const dn = input.display_name.trim();
    if (!dn || dn.length > 50) return 'Display names are 1–50 characters.';
    if (wordCount(input.bio) > BIO_MAX_WORDS) return `Bios are limited to ${BIO_MAX_WORDS} words.`;
    if (input.bio.length > 4000) return 'That bio is too long.';
    if (!isValidTimezone(input.timezone)) return 'Pick a valid timezone.';
    if (input.region && !REGION_CODES.includes(input.region)) return 'Pick a valid region.';
    return null;
}

export async function updateProfile(userId: string, input: ProfileInput, finishOnboarding = false) {
    const problem = validateProfile(input);
    if (problem) error(400, problem);
    try {
        await db.q(
            `UPDATE users SET username = $2, display_name = $3, bio = $4, timezone = $5, region = $6,
                    onboarded = onboarded OR $7
              WHERE id = $1`,
            [userId, input.username, input.display_name.trim(), input.bio.trim(), input.timezone, input.region || null, finishOnboarding]
        );
    } catch (err) {
        if (isUniqueViolation(err)) error(409, `*${input.username} is already taken.`);
        throw err;
    }
}

export async function listIdentities(userId: string) {
    return db.q<{ provider: string; login: string | null; created_at: Date }>(
        'SELECT provider, login, created_at FROM identities WHERE user_id = $1 ORDER BY created_at',
        [userId]
    );
}

export async function unlinkIdentity(userId: string, provider: string) {
    const rows = await listIdentities(userId);
    if (rows.length < 2) error(400, 'Keep at least one linked account so you can still sign in.');
    await db.q('DELETE FROM identities WHERE user_id = $1 AND provider = $2', [userId, provider]);
}

export async function deleteAccount(userId: string) {
    await db.q('DELETE FROM users WHERE id = $1', [userId]);
}

function usernameBase(login: string): string {
    let base = login.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 28);
    if (base.length < 2) base = `user${base}`;
    return base;
}

export interface OAuthProfile {
    id: string;
    login: string;
    name: string;
    avatar: string | null;
}

export async function signInWithIdentity(provider: string, p: OAuthProfile, linkTo: string | null): Promise<{ userId: string; created: boolean }> {
    const existing = await db.one<{ user_id: string }>('SELECT user_id FROM identities WHERE provider = $1 AND provider_id = $2', [provider, p.id]);
    if (existing) {
        if (linkTo && existing.user_id !== linkTo) error(409, 'That account is already linked to a different Bitlin user.');
        return { userId: existing.user_id, created: false };
    }
    if (linkTo) {
        await db.q('INSERT INTO identities (provider, provider_id, user_id, login) VALUES ($1, $2, $3, $4)', [provider, p.id, linkTo, p.login]);
        return { userId: linkTo, created: false };
    }

    const display = (p.name || p.login).trim().slice(0, 50) || 'New user';
    const base = usernameBase(p.login);
    for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = attempt === 0 ? base : `${base.slice(0, 26)}-${Math.floor(1000 + Math.random() * 9000)}`;
        if (validateUsername(candidate)) continue;
        try {
            const row = await db.one<{ id: string }>(
                `INSERT INTO users (username, display_name, avatar_url) VALUES ($1, $2, $3) RETURNING id`,
                [candidate, display, p.avatar]
            );
            await db.q('INSERT INTO identities (provider, provider_id, user_id, login) VALUES ($1, $2, $3, $4)', [provider, p.id, row!.id, p.login]);
            return { userId: row!.id, created: true };
        } catch (err) {
            if (!isUniqueViolation(err)) throw err;
            // Either the username was taken, or two sign-ins raced for the same identity.
            const raced = await db.one<{ user_id: string }>('SELECT user_id FROM identities WHERE provider = $1 AND provider_id = $2', [provider, p.id]);
            if (raced) return { userId: raced.user_id, created: false };
        }
    }
    error(500, 'Could not allocate a username. Please try again.');
}
