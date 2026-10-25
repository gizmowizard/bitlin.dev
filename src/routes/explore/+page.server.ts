import type { PageServerLoad } from './$types';
import { exploreProjects } from '#lib/server/projects.ts';

const PAGE = 24;

export const load: PageServerLoad = async ({ url, depends }) => {
    depends('bitlin:explore');
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
    const sort = url.searchParams.get('sort') === 'new' ? 'new' : 'updated';
    const page = Math.max(1, Math.min(200, Number(url.searchParams.get('page')) || 1));
    const rows = await exploreProjects(q, sort, PAGE + 1, (page - 1) * PAGE);
    return { projects: rows.slice(0, PAGE), more: rows.length > PAGE, q, sort, page };
};
