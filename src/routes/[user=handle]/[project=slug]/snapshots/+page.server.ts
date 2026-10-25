import type { PageServerLoad } from './$types';
import { history } from '#lib/server/vcs/snapshots.ts';
import { db } from '#lib/server/db.ts';

const PAGE = 40;

export const load: PageServerLoad = async ({ parent, url, depends }) => {
    depends('bitlin:refs');
    const { project, ref, branches } = await parent();
    const page = Math.max(1, Math.min(500, Number(url.searchParams.get('page')) || 1));
    const rows = await history(project.id, ref.snapshot, PAGE + 1, (page - 1) * PAGE);
    const tags = await db.q<{ name: string; snapshot_id: string }>('SELECT name, snapshot_id FROM tags WHERE project_id = $1', [project.id]);

    const labels: Record<string, { branches: string[]; tags: string[] }> = {};
    const slot = (id: string) => (labels[id] ??= { branches: [], tags: [] });
    for (const b of branches) if (b.head && !b.tracking) slot(b.head).branches.push(b.name);
    for (const t of tags) slot(t.snapshot_id).tags.push(t.name);

    return { snapshots: rows.slice(0, PAGE), more: rows.length > PAGE, page, labels };
};
