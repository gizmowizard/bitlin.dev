<script lang="ts">
    import './app.css';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import Header from './Header.svelte';
    import Toasts from './Toasts.svelte';
    import { toast } from '#lib/toast.svelte.ts';
    import { useLive, refresh } from '#lib/live.svelte.ts';
    import { ws } from '#lib/ws.svelte.ts';
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();
    const landing = $derived(page.url.pathname === '/');

    $effect(() => ws.connect());
    useLive(() => (data.user ? `user:${data.user.id}` : null), (type, d) => {
        if (type === 'notice') toast(d.text, 'info', d.href);
        if (type === 'project.created') refresh('bitlin:dashboard');
    });
</script>

{#if !landing}<Header user={data.user} />{/if}
{@render children()}
<Toasts />
