<script lang="ts">
    import { page } from '$app/state';
    import Icon from '../Icon.svelte';
    let { children } = $props();
    const links = [
        { href: '/settings', label: 'Profile', icon: 'user' },
        { href: '/settings/accounts', label: 'Sign-in accounts', icon: 'shield' },
        { href: '/settings/tokens', label: 'Access tokens', icon: 'key-round' }
    ] as const;
</script>

<div class="page wrap">
    <nav class="side">
        {#each links as l}
            <a href={l.href} aria-current={page.url.pathname === l.href ? 'page' : undefined}><Icon name={l.icon} /> {l.label}</a>
        {/each}
    </nav>
    <div class="stack content">{@render children()}</div>
</div>

<style>
    .wrap { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 2rem; align-items: start; }
    .side { display: flex; flex-direction: column; gap: 0.2rem; position: sticky; top: 4.5rem; }
    .side a { display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 0.75rem; border-radius: 8px; color: var(--fg); font-weight: 300; }
    .side a:hover { background: var(--surface); text-decoration: none; }
    .side a[aria-current='page'] { background: var(--surface-2); color: var(--accent); font-weight: 400; }
    .content { max-width: 680px; }
    @media (max-width: 760px) {
        .wrap { grid-template-columns: 1fr; gap: 1rem; }
        .side { flex-direction: row; overflow-x: auto; position: static; }
        .side a { white-space: nowrap; }
    }
</style>
