import type { RequestHandler } from './$types';
import { db } from '#lib/server/db.ts';
import { config } from '#lib/server/config.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Public projects and their owners; capped well below the 50,000-URL sitemap limit.
export const GET: RequestHandler = async () => {
    const origin = config.canonicalOrigin;
    const projects = await db.q<{ owner: string; name: string; updated_at: Date }>(
        `SELECT u.username AS owner, p.name, p.updated_at FROM projects p JOIN users u ON u.id = p.owner_id
          WHERE p.visibility = 'public' ORDER BY p.updated_at DESC LIMIT 40000`
    );
    const users = await db.q<{ username: string }>(
        `SELECT DISTINCT u.username FROM users u JOIN projects p ON p.owner_id = u.id WHERE p.visibility = 'public' AND u.onboarded LIMIT 9000`
    );
    const urls = [
        ...users.map((u) => `<url><loc>${esc(`${origin}/*${u.username}`)}</loc><changefreq>weekly</changefreq><priority>0.4</priority></url>`),
        ...projects.map((p) => `<url><loc>${esc(`${origin}/*${p.owner}/${p.name}`)}</loc><lastmod>${p.updated_at.toISOString()}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`)
    ];
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' }
    });
};
