import type { IconName } from './Icon.svelte';

export function describeActivity(type: string, d: Record<string, any>): { icon: IconName; text: string } {
    switch (type) {
        case 'snapshot.created': return { icon: 'git-commit-horizontal', text: `saved a snapshot on ${d.branch}: ${d.message ?? ''}` };
        case 'restore': return { icon: 'archive-restore', text: `restored ${d.branch} · ${d.message ?? ''}` };
        case 'branch.created': return { icon: 'git-branch-plus', text: `created branch ${d.branch}` };
        case 'branch.deleted': return { icon: 'git-branch', text: `deleted branch ${d.branch}` };
        case 'tag.created': return { icon: 'tag', text: `tagged ${d.tag}` };
        case 'proposal.opened': return { icon: 'git-pull-request', text: `opened proposal #${d.number}: ${d.title}` };
        case 'proposal.merged': return { icon: 'git-merge', text: `merged proposal #${d.number}: ${d.title}` };
        case 'proposal.closed': return { icon: 'git-pull-request-closed', text: `closed proposal #${d.number}` };
        case 'collab.added': return { icon: 'user-plus', text: `added *${d.username} as ${d.role}` };
        case 'project.created': return { icon: 'projects', text: 'created the project' };
        case 'project.forked': return { icon: 'git-fork', text: d.from ? `forked from ${d.from}` : `was forked by *${d.by}` };
        case 'remote.pulled': return { icon: 'cloud-download', text: `fetched ${d.snapshots} snapshots from ${d.remote}` };
        case 'remote.pushed': return { icon: 'cloud-upload', text: `pushed ${d.branch} to ${d.remote}` };
        default: return { icon: 'activity', text: type };
    }
}
