import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { renderMarkdown } from '#lib/server/markdown.ts';
import { enforce } from '#lib/server/ratelimit.ts';

export const POST: RequestHandler = async (event) => {
    if (!event.locals.user) error(401, 'Sign in first');
    await enforce(event, 'markdown');
    const body = await event.request.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.slice(0, 20_000) : '';
    return json({ html: renderMarkdown(text) });
};
