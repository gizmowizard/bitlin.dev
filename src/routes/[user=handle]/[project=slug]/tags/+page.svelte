<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import Time from '../../../Time.svelte';
    import { can } from '#lib/access.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import { projectHref, shortId } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    let open = $state(false);
</script>

<Meta title="Tags · {p.owner.username}/{p.name}" description="Tagged versions of *{p.owner.username}/{p.name}: {data.tags.slice(0, 6).map((t) => t.name).join(', ')}" />

<div class="stack">
    <div class="row between"><h2>Tags</h2>{#if can(data.role, 'write')}<button class="btn primary sm" onclick={() => (open = !open)}><Icon name="plus" size={14} /> New tag</button>{/if}</div>
    {#if open}
        <form class="card stack" method="POST" action="?/create" use:enhance={enhanceForm({ reset: true })}>
            <div class="row">
                <input class="input grow" name="name" placeholder="v1.0.0" required />
                <select class="select" style="width: auto" name="ref" aria-label="Tag this">
                    {#each data.branches.filter((b) => !b.tracking && b.head) as b}<option value={b.name} selected={b.name === data.ref.name}>latest of {b.name}</option>{/each}
                </select>
            </div>
            <input class="input" name="message" placeholder="Title (optional)" maxlength="200" />
            <textarea class="textarea" name="notes" rows="4" placeholder="Release notes (markdown)"></textarea>
            <button class="btn primary" style="align-self: flex-start">Create tag</button>
        </form>
    {/if}

    {#if data.tags.length}
        <div class="list">
            {#each data.tags as t (t.name)}
                <a class="item" href="{base}/tags/{t.name}">
                    <Icon name="tag" class="muted" />
                    <div class="grow"><b>{t.name}</b>{#if t.message} <span class="muted">· {t.message}</span>{/if}<div class="small muted clip">{t.info?.message.split('\n')[0]}</div></div>
                    <span class="small muted"><Time date={t.created_at} /></span><span class="chip plain mono">{shortId(t.snapshot_id)}</span>
                </a>
            {/each}
        </div>
    {:else}
        <div class="empty"><h3>No tags yet</h3><p>Tags mark important versions, like releases, so you can find them again.</p></div>
    {/if}
</div>
