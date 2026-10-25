<script lang="ts">
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { enhance } from '$app/forms';
    import Icon, { type IconName } from '../../Icon.svelte';
    import Avatar from '../../Avatar.svelte';
    import { ws } from '#lib/ws.svelte.ts';
    import { useLive, refresh } from '#lib/live.svelte.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import { toast } from '#lib/toast.svelte.ts';
    import { can } from '#lib/access.ts';
    import { projectHref, userHref, withRef } from '#lib/util.ts';
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    const presence = $derived(ws.presence[`project:${p.id}`]);
    const writer = $derived(can(data.role, 'write'));
    const admin = $derived(can(data.role, 'admin'));

    // Which events invalidate which data, so only the affected loads re-run.
    useLive(() => `project:${p.id}`, (type, d) => {
        if (type === 'presence' || type === 'typing') return;
        if (type === 'resync') return refresh('bitlin:project', 'bitlin:refs', 'bitlin:changes', 'bitlin:proposals', 'bitlin:people');
        if (type === 'project.deleted') {
            toast('This project was deleted.', 'error');
            return void goto('/dashboard');
        }
        if (type === 'project.renamed') return void goto(projectHref(p.owner.username, d.name) + page.url.search, { replaceState: true });
        if (type.startsWith('snapshot') || type.startsWith('branch') || type.startsWith('tag') || type === 'restore' || type.startsWith('remote')) refresh('bitlin:project', 'bitlin:refs');
        if (type.startsWith('proposal')) refresh('bitlin:proposals', 'bitlin:project');
        if (type.startsWith('collab') || type.startsWith('project') || type === 'ignore.updated') refresh('bitlin:project', 'bitlin:people');
        if (type === 'snapshot.created' && d.actor && d.actor !== page.data.user?.id) toast(`*${d.actor_name ?? 'someone'} saved “${d.message}” on ${d.branch}`, 'info');
    });
    useLive(() => (page.data.user ? `user:${page.data.user.id}` : null), (type, d) => {
        if (type === 'draft.updated' && d.project === p.id) refresh('bitlin:changes', 'bitlin:project');
    });

    const tabs = $derived<{ href: string; label: string; icon: IconName; count?: number; show?: boolean; key: string }[]>([
        { key: '', href: '', label: 'Overview', icon: 'book-open' },
        { key: 'files', href: '/files', label: 'Files', icon: 'folder-open' },
        { key: 'snapshots', href: '/snapshots', label: 'History', icon: 'history', count: data.stats.snapshots },
        { key: 'branches', href: '/branches', label: 'Branches', icon: 'forest', count: data.stats.branches },
        { key: 'tags', href: '/tags', label: 'Tags', icon: 'tag', count: data.stats.tags },
        { key: 'proposals', href: '/proposals', label: 'Proposals', icon: 'inbox', count: data.stats.proposals },
        { key: 'changes', href: '/changes', label: 'Changes', icon: 'file-diff', count: data.pendingChanges, show: writer },
        { key: 'remotes', href: '/remotes', label: 'Remotes', icon: 'server' },
        { key: 'ignore', href: '/ignore', label: 'Ignore', icon: 'ignore' },
        { key: 'collaborators', href: '/collaborators', label: 'People', icon: 'users', count: data.stats.people },
        { key: 'settings', href: '/settings', label: 'Settings', icon: 'settings', show: admin }
    ]);
    const section = $derived(page.url.pathname.slice(base.length).split('/')[1] ?? '');
    let forking = $state(false);
</script>

<div class="page stack">
    <div class="head">
        <div class="stack" style="gap: 0.4rem; min-width: 0">
            <div class="title">
                <Icon name="projects" size={22} />
                <a href={userHref(p.owner.username)}>*{p.owner.username}</a><span class="muted">/</span>
                <a class="pname" href={base}>{p.name}</a>
                <span class="chip">{#if p.visibility === 'private'}<Icon name="lock" size={12} /> Private{:else}<Icon name="globe" size={12} /> Public{/if}</span>
                {#if p.forked}<span class="chip plain"><Icon name="git-fork" size={12} /> fork</span>{/if}
            </div>
            {#if p.description}<p class="muted">{p.description}</p>{/if}
        </div>
        <div class="row">
            {#if presence && presence.total > 1}
                <div class="faces" title="{presence.total} viewing now">
                    {#each presence.users as u (u.id)}<a href={userHref(u.username)} title="*{u.username}"><Avatar user={u} size={24} /></a>{/each}
                    {#if presence.anon || presence.more}<span class="chip plain">+{presence.anon + presence.more}</span>{/if}
                </div>
            {/if}
            {#if page.data.user && !(page.data.user.id === p.owner.id)}
                <form method="POST" action="{base}/settings?/fork" use:enhance={enhanceForm({ busy: (b) => (forking = b) })}>
                    <button class="btn sm" disabled={forking}><Icon name="git-fork" size={14} /> Fork</button>
                </form>
            {/if}
            <a class="btn sm" href="{base}/archive{withRef('', data.ref.name, p.default_branch)}" data-sveltekit-reload><Icon name="download" size={14} /> ZIP</a>
        </div>
    </div>

    <nav class="tabs" aria-label="Project sections">
        {#each tabs as t (t.key)}
            {#if t.show !== false}
                <a href="{base}{t.href}{t.key !== 'settings' && t.key !== 'collaborators' && t.key !== 'remotes' && t.key !== 'proposals' && t.key !== 'ignore' ? withRef('', data.ref.name, p.default_branch) : ''}" aria-current={section === t.key ? 'page' : undefined}>
                    <Icon name={t.icon} size={15} /> {t.label}{#if t.count}<span class="count">{t.count}</span>{/if}
                </a>
            {/if}
        {/each}
    </nav>

    {@render children()}
</div>

<style>
    .head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
    .title { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; font-size: 1.15rem; }
    .pname { font-family: var(--font-display); font-size: 1.9rem; color: var(--fg); line-height: 1; }
    .faces { display: flex; align-items: center; gap: 0.25rem; }
</style>
