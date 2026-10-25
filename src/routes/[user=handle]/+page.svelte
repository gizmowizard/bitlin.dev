<script lang="ts">
    import Meta from '../Meta.svelte';
    import Avatar from '../Avatar.svelte';
    import Icon from '../Icon.svelte';
    import ProjectCard from '../ProjectCard.svelte';
    import { clock } from '#lib/clock.svelte.ts';
    import { regionName } from '#lib/regions.ts';
    import { userHref } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.profile);
    const localTime = $derived.by(() => {
        try {
            return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: p.timezone, timeZoneName: 'short' }).format(clock.now);
        } catch {
            return '';
        }
    });
    const desc = $derived(
        [`*${p.username}`, p.bio_text, `${data.projects.length} public project${data.projects.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
    );
</script>

<Meta title="{p.display_name} (*{p.username})" description={desc} image={p.avatar_url} type="profile" imageAlt="{p.display_name}’s avatar" />
<div class="page stack">
    <div class="head">
        <Avatar user={p} size={96} />
        <div class="stack" style="gap: 0.5rem">
            <div>
                <h1>{p.display_name}</h1>
                <div class="muted mono">*{p.username}</div>
            </div>
            {#if p.bio_html}<div class="md">{@html p.bio_html}</div>{/if}
            <div class="row small muted">
                {#if regionName(p.region)}<span class="row" style="gap: 0.3rem"><Icon name="map-pin" size={14} /> {regionName(p.region)}</span>{/if}
                <span class="row" style="gap: 0.3rem"><Icon name="clock" size={14} /> {localTime} · {p.timezone.replaceAll('_', ' ')}</span>
                <span class="row" style="gap: 0.3rem"><Icon name="calendar" size={14} /> Joined {new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
            </div>
            {#if data.isSelf}<a class="btn sm" style="align-self: flex-start" href="/settings"><Icon name="pencil" size={14} /> Edit profile</a>{/if}
        </div>
    </div>

    <h2>Projects</h2>
    {#if data.projects.length}
        <div class="grid">{#each data.projects as pr (pr.id)}<ProjectCard p={pr} showOwner={false} />{/each}</div>
    {:else}
        <div class="empty"><p>No public projects yet.</p></div>
    {/if}
</div>

<style>
    .head { display: flex; gap: 1.5rem; align-items: flex-start; }
    @media (max-width: 560px) { .head { flex-direction: column; } }
</style>
