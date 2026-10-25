<script lang="ts">
    import Meta from '../Meta.svelte';
    import Icon from '../Icon.svelte';
    import Avatar from '../Avatar.svelte';
    import Time from '../Time.svelte';
    import ProjectCard from '../ProjectCard.svelte';
    import { describeActivity } from '../activity.ts';
    import { ws } from '#lib/ws.svelte.ts';
    import { refresh } from '#lib/live.svelte.ts';
    import { projectHref } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();

    // Follow every project on screen so the feed and cards update the moment anything happens.
    $effect(() => {
        const ids = [...data.mine, ...data.collabs].slice(0, 20).map((p) => `project:${p.id}`);
        const offs = ids.map((t) => ws.on(t, (type) => type !== 'presence' && type !== 'typing' && refresh('bitlin:dashboard')));
        return () => offs.forEach((o) => o());
    });
</script>

<Meta title="Dashboard" noindex />
<div class="page stack">
    <div class="row between"><h1>Your projects</h1><a class="btn primary" href="/new"><Icon name="plus" /> New project</a></div>

    <div class="two-col">
        <div class="stack">
            {#if data.mine.length}
                <div class="grid">{#each data.mine as p (p.id)}<ProjectCard {p} showOwner={false} />{/each}</div>
            {:else}
                <div class="empty"><h3>Nothing here yet</h3><p>Create your first project and save a snapshot.</p><p style="margin-top: 1rem"><a class="btn primary" href="/new">Create a project</a></p></div>
            {/if}

            {#if data.collabs.length}
                <h2>Shared with you</h2>
                <div class="grid">{#each data.collabs as p (p.id)}<ProjectCard {p} />{/each}</div>
            {/if}
        </div>

        <aside class="stack">
            <h3>Activity</h3>
            {#if data.feed.length}
                <div class="list">
                    {#each data.feed as a (a.id)}
                        {@const d = describeActivity(a.type, a.data)}
                        <a class="item" href={projectHref(a.project!.owner, a.project!.name)}>
                            <Icon name={d.icon} />
                            <div class="grow small">
                                <div class="clip"><b>{a.actor ? `*${a.actor.username}` : 'Someone'}</b> {d.text}</div>
                                <div class="muted clip">{a.project!.owner}/{a.project!.name} · <Time date={a.created_at} /></div>
                            </div>
                        </a>
                    {/each}
                </div>
            {:else}
                <p class="muted small">Activity from your projects will appear here live.</p>
            {/if}
        </aside>
    </div>
</div>
