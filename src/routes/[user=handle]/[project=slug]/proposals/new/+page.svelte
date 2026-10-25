<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../../Meta.svelte';
    import Icon from '../../../../Icon.svelte';
    import { enhanceForm } from '#lib/forms.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    // svelte-ignore state_referenced_locally
    let sourceId = $state(data.sources[0].id);
    // svelte-ignore state_referenced_locally
    let head = $state(data.head ?? '');
    // svelte-ignore state_referenced_locally
    let title = $state(data.head ? `Merge ${data.head}` : '');
    let busy = $state(false);
    const heads = $derived(data.sources.find((s) => s.id === sourceId)?.branches ?? []);
    $effect(() => {
        if (!heads.includes(head)) head = heads.find((h) => h !== data.base) ?? heads[0] ?? '';
    });
</script>

<Meta title="New proposal" noindex />
<form class="stack" style="max-width: 760px" method="POST" use:enhance={enhanceForm({ busy: (b) => (busy = b) })}>
    <h2>New proposal</h2>
    <div class="card row">
        {#if data.sources.length > 1}
            <select class="select" style="width: auto" name="source" bind:value={sourceId} aria-label="Source project">{#each data.sources as s}<option value={s.id}>{s.label}</option>{/each}</select>
        {:else}<input type="hidden" name="source" value={sourceId} />{/if}
        <select class="select" style="width: auto" name="head" bind:value={head} aria-label="Source branch">{#each heads as h}<option value={h}>{h}</option>{/each}</select>
        <Icon name="arrow-right" />
        <select class="select" style="width: auto" name="base" aria-label="Target branch">{#each data.targets as t}<option value={t} selected={t === data.base}>{t}</option>{/each}</select>
    </div>
    <div class="field"><label for="title">Title</label><input class="input" id="title" name="title" bind:value={title} maxlength="150" required /></div>
    <div class="field"><label for="body">Description <span class="muted">(markdown)</span></label><textarea class="textarea" id="body" name="body" rows="7"></textarea></div>
    <button class="btn primary" style="align-self: flex-start" disabled={busy || !head}><Icon name="git-pull-request-create" /> Open proposal</button>
</form>
