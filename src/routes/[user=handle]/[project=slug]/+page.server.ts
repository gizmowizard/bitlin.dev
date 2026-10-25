import type { PageServerLoad } from './$types';
import { headTree } from '#lib/server/vcs/drafts.ts';
import { history, aheadBehind, snapshotInfos } from '#lib/server/vcs/snapshots.ts';
import { listDir } from '#lib/server/vcs/paths.ts';
import { getBlob } from '#lib/server/storage.ts';
import { decodeText } from '#lib/server/vcs/diff.ts';
import { renderMarkdown } from '#lib/server/markdown.ts';
import { projectActivity } from '#lib/server/projects.ts';
import { db } from '#lib/server/db.ts';
import { plainText } from '#lib/util.ts';

const README = /^readme(\.md|\.markdown|\.txt)?$/i;

export const load: PageServerLoad = async ({ parent, depends }) => {
    depends('bitlin:refs', 'bitlin:project');
    const { project, ref, branches } = await parent();
    const tree = await headTree(project.id, ref.snapshot);
    const entries = listDir(tree, '');
    const paths = Object.keys(tree);
    const size = Object.values(tree).reduce((n, e) => n + e.s, 0);

    let readme: { name: string; html: string | null; text: string | null } | null = null;
    const rm = entries.find((e) => e.type === 'file' && README.test(e.name) && e.size <= 512 * 1024);
    if (rm) {
        const text = decodeText(await getBlob(tree[rm.path].h));
        if (text !== null) {
            const isMd = /\.m(d|arkdown)$/i.test(rm.name);
            readme = {
                name: rm.name,
                html: isMd ? renderMarkdown(text, { rawBase: `/*${project.owner.username}/${project.name}/raw` }) : null,
                text: isMd ? null : text
            };
        }
    }

    const [recent, activity, tags, openProposals] = await Promise.all([
        history(project.id, ref.snapshot, 6),
        projectActivity(project.id, 8),
        db.q<{ name: string; snapshot_id: string; created_at: Date }>('SELECT name, snapshot_id, created_at FROM tags WHERE project_id = $1 ORDER BY created_at DESC LIMIT 5', [project.id]),
        Promise.resolve(null)
    ]);

    // Ahead/behind for a handful of non-default branches gives the sidebar some useful signal.
    const defaultHead = branches.find((b) => b.name === project.default_branch)?.head ?? null;
    const others = branches.filter((b) => !b.tracking && b.name !== project.default_branch).slice(0, 5);
    const infos = await snapshotInfos(project.id, others.map((b) => b.head).filter(Boolean) as string[]);
    const sideBranches = await Promise.all(
        others.map(async (b) => ({ name: b.name, updated_at: b.updated_at, message: (b.head && infos.get(b.head)?.message) || '', ...(await aheadBehind(project.id, b.head, defaultHead)) }))
    );

    return {
        entries, fileCount: paths.length, size, readme, recent, activity, tags, sideBranches,
        description: [project.description, `${paths.length} files`, `${recent.length ? `latest: “${plainText(recent[0].message, 80)}”` : 'no snapshots yet'}`].filter(Boolean).join(' · ')
    };
};
