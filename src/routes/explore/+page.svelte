<script lang="ts">
    import Meta from '../Meta.svelte';
    import Icon from '../Icon.svelte';
    import ProjectCard from '../ProjectCard.svelte';
    import { useLive, refresh } from '#lib/live.svelte.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    useLive(() => 'explore', (type) => type === 'project.changed' && refresh('bitlin:explore'));
</script>

<Meta title="Explore projects" description="Browse public Bitlin projects: snapshots, branches and releases you can read without signing in." />
<div class="page stack">
    <h1>Explore</h1>
    <form class="row" method="GET" role="search">
        <div class="grow" style="min-width: 220px; position: relative">
            <input class="input" name="q" value={data.q} placeholder="Search projects, descriptions or *users" aria-label="Search" />
        </div>
        <select class="select" name="sort" style="width: auto" aria-label="Sort">
            <option value="updated" selected={data.sort === 'updated'}>Recently active</option>
            <option value="new" selected={data.sort === 'new'}>Newest</option>
        </select>
        <button class="btn primary"><Icon name="search" /> Search</button>
    </form>

    {#if data.projects.length}
        <div class="grid">{#each data.projects as p (p.id)}<ProjectCard {p} />{/each}</div>
        <div class="row between">
            {#if data.page > 1}<a class="btn" href="?q={encodeURIComponent(data.q)}&sort={data.sort}&page={data.page - 1}"><Icon name="arrow-left" /> Newer</a>{:else}<span></span>{/if}
            {#if data.more}<a class="btn" href="?q={encodeURIComponent(data.q)}&sort={data.sort}&page={data.page + 1}">Older <Icon name="arrow-right" /></a>{/if}
        </div>
    {:else}
        <div class="empty"><h3>No projects found</h3><p>{data.q ? 'Try a different search.' : 'Be the first to publish something.'}</p></div>
    {/if}
</div>
