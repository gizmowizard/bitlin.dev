<script lang="ts">
    import './app.css';
    import { page } from '$app/state';
    import Header from './Header.svelte';
    import Toasts from './Toasts.svelte';
    import Footer from './Footer.svelte';
    import Doodles from './Doodles.svelte';
    import { toast } from '#lib/toast.svelte.ts';
    import { useLive, refresh } from '#lib/live.svelte.ts';
    import { ws } from '#lib/ws.svelte.ts';
    import { initTheme } from '#lib/theme.svelte.ts';
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();
    const landing = $derived(page.url.pathname === '/');

    $effect(() => initTheme());
    $effect(() => ws.connect());
    useLive(() => (data.user ? `user:${data.user.id}` : null), (type, d) => {
        if (type === 'notice') toast(d.text, 'info', d.href);
        if (type === 'project.created') refresh('bitlin:dashboard');
    });
</script>

<Doodles />
<div class="app">
    {#if !landing}<Header user={data.user} />{/if}
    <div class="main">{@render children()}</div>
    {#if !landing}<Footer />{/if}
</div>
<Toasts />

<style>
    .app {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
    }
    .main {
        flex: 1 0 auto;
        min-width: 0;
    }
</style>