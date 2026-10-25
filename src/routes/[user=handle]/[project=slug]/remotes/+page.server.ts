import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { guard } from '#lib/server/guard.ts';
import { enforce } from '#lib/server/ratelimit.ts';
import { db } from '#lib/server/db.ts';
import { encrypt } from '#lib/server/crypto.ts';
import { fetchRemote, parseRemoteUrl, pushToRemote } from '#lib/server/sync.ts';
import { validateBranchName } from '#lib/util.ts';

const NAME = /^[a-z][a-z0-9_-]{0,31}$/;

export const load: PageServerLoad = async ({ parent, depends }) => {
    depends('bitlin:refs', 'bitlin:project');
    const { project, branches } = await parent();
    const remotes = await db.q<{ name: string; url: string; has_token: boolean; last_fetched_at: Date | null }>(
        'SELECT name, url, token_enc IS NOT NULL AS has_token, last_fetched_at FROM remotes WHERE project_id = $1 ORDER BY name',
        [project.id]
    );
    return { remotes, tracking: branches.filter((b) => b.tracking) };
};

async function remoteOf(projectId: string, name: string) {
    const r = await db.one<{ name: string; url: string; token_enc: string | null }>('SELECT name, url, token_enc FROM remotes WHERE project_id = $1 AND name = $2', [projectId, name]);
    if (!r) error(404, 'Remote not found');
    return r;
}

export const actions: Actions = {
    add: async (event) => {
        const { project } = await guard(event.params, event.locals.user, 'admin');
        await enforce(event, 'remote');
        const f = await event.request.formData();
        const name = String(f.get('name') ?? '').trim().toLowerCase();
        if (!NAME.test(name)) return fail(400, { message: 'Remote names are lowercase letters, numbers, “-” and “_”.' });
        const { canonical } = parseRemoteUrl(String(f.get('url') ?? ''));
        const token = String(f.get('token') ?? '').trim();
        const n = await db.one<{ n: number }>('SELECT count(*)::int AS n FROM remotes WHERE project_id = $1', [project.id]);
        if ((n?.n ?? 0) >= 10) return fail(400, { message: 'A project can have up to 10 remotes.' });
        const res = await db.q('INSERT INTO remotes (project_id, name, url, token_enc) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING 1', [project.id, name, canonical, token ? encrypt(token) : null]);
        if (!res.length) return fail(409, { message: `A remote named “${name}” already exists.` });
        return { ok: true };
    },
    remove: async (event) => {
        const { project } = await guard(event.params, event.locals.user, 'admin');
        await enforce(event, 'remote');
        const name = String((await event.request.formData()).get('name'));
        await db.q('DELETE FROM branches WHERE project_id = $1 AND tracking = $2', [project.id, name]);
        await db.q('DELETE FROM remotes WHERE project_id = $1 AND name = $2', [project.id, name]);
        return { ok: true };
    },
    fetch: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'write');
        await enforce(event, 'remote');
        const remote = await remoteOf(project.id, String((await event.request.formData()).get('name')));
        return { result: await fetchRemote(project, remote, user) };
    },
    push: async (event) => {
        const { project, user } = await guard(event.params, event.locals.user, 'write');
        await enforce(event, 'remote');
        const f = await event.request.formData();
        const remote = await remoteOf(project.id, String(f.get('name')));
        const local = String(f.get('branch') ?? '');
        const target = String(f.get('target') ?? '').trim() || local;
        const problem = validateBranchName(target);
        if (problem) return fail(400, { message: problem });
        return { result: await pushToRemote(project, remote, user, local, target, f.get('force') === 'on'), pushed: true };
    }
};
