<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import Time from '../../../Time.svelte';
    import { can } from '#lib/access.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import { projectHref, withRef } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    const writer = $derived(can(data.role, 'write'));
    const admin = $derived(can(data.role, 'admin'));
    const own = $derived(data.rows.filter((b) => !b.tracking));
    const remote = $derived(data.rows.filter((b) => b.tracking));
    let renaming = $state<string | null>(null);
    const enc = encodeURIComponent;
</script>

<Meta title="Branches · {p.owner.username}/{p.name}" description="{data.stats.branches} branches in *{p.owner.username}/{p.name}." />

<div class="stack">
    {#if writer}
        <form class="card row" method="POST" action="?/create" use:enhance={enhanceForm({ reset: true })}>
            <Icon name="git-branch-plus" />
            <input class="input grow" style="min-width: 10rem" name="name" placeholder="New branch name" required />
            <select class="select" style="width: auto" name="from" aria-label="Start from">
                {#each own as b}<option value={b.name} selected={b.name === data.ref.name}>from {b.name}</option>{/each}
            </select>
            <button class="btn primary">Create</button>
        </form>
    {/if}

    <div class="list">
        {#each own as b (b.name)}
            <div class="item" style="flex-wrap: wrap">
                <Icon name="git-branch" class="muted" />
                <div class="grow" style="min-width: 12rem">
                    <div class="row"><a href="{base}/files/?ref={enc(b.name)}"><b>{b.name}</b></a>
                        {#if b.name === p.default_branch}<span class="chip solid">default</span>{/if}</div>
                    <div class="small muted clip">{b.info ? b.info.message.split('\n')[0] : 'No snapshots yet'} · <Time date={b.updated_at} /></div>
                </div>
                {#if b.name !== p.default_branch}<span class="chip plain mono" title="snapshots ahead / behind {p.default_branch}">+{b.ahead} −{b.behind}</span>{/if}
                <div class="row" style="gap: 0.25rem">
                    {#if b.name !== p.default_branch}
                        <a class="btn sm" href="{base}/compare?base={enc(p.default_branch)}&head={enc(b.name)}"><Icon name="git-compare" size={14} /> Compare</a>
                        {#if writer && b.head}<a class="btn sm" href="{base}/merge?into={enc(p.default_branch)}&from={enc(b.name)}"><Icon name="git-merge" size={14} /> Merge</a>{/if}
                    {/if}
                    {#if admin}
                        {#if b.name !== p.default_branch}<form method="POST" action="?/makeDefault" use:enhance={enhanceForm({ success: 'Default branch changed' })}><input type="hidden" name="name" value={b.name} /><button class="btn sm ghost" title="Make default"><Icon name="check" size={14} /></button></form>{/if}
                        <button class="btn sm ghost" title="Rename" onclick={() => (renaming = renaming === b.name ? null : b.name)}><Icon name="pencil" size={14} /></button>
                    {/if}
                    {#if writer && b.name !== p.default_branch}<form method="POST" action="?/delete" use:enhance={enhanceForm({ success: 'Branch deleted' })} onsubmit={(e) => !confirm(`Delete branch “${b.name}”? Its snapshots stay in history if other branches contain them.`) && e.preventDefault()}><input type="hidden" name="name" value={b.name} /><button class="btn sm ghost danger" title="Delete"><Icon name="trash-2" size={14} /></button></form>{/if}
                </div>
                {#if renaming === b.name}
                    <form class="row" style="flex-basis: 100%" method="POST" action="?/rename" use:enhance={enhanceForm({ success: 'Renamed', after: () => (renaming = null) })}>
                        <input type="hidden" name="from" value={b.name} /><input class="input grow" name="to" value={b.name} required /><button class="btn sm primary">Rename</button>
                    </form>
                {/if}
            </div>
        {/each}
    </div>

    {#if remote.length}
        <h3>Remote-tracking</h3>
        <div class="list">
            {#each remote as b (b.name)}
                <div class="item"><Icon name="cloud-download" class="muted" /><a class="grow" href="{base}/files/?ref={enc(b.name)}">{b.name}</a>
                    {#if writer && b.head}<a class="btn sm" href="{base}/merge?into={enc(p.default_branch)}&from={enc(b.name)}"><Icon name="git-merge" size={14} /> Merge into {p.default_branch}</a>{/if}</div>
            {/each}
        </div>
    {/if}
</div>
