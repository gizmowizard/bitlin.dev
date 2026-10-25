<script lang="ts">
    import { page } from '$app/state';
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import Time from '../../../Time.svelte';
    import DiffView from '../DiffView.svelte';
    import RefPicker from '../RefPicker.svelte';
    import { can } from '#lib/access.ts';
    import { projectHref, shortId } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    const writer = $derived(can(data.role, 'write'));
    const enc = encodeURIComponent;
    const swap = $derived(`${base}/compare?base=${enc(data.head.name)}&head=${enc(data.base.name)}`);
</script>

<Meta title="Compare {data.base.name}…{data.head.name} · {p.owner.username}/{p.name}" description="{data.diffs.length} files differ between {data.base.name} and {data.head.name} in *{p.owner.username}/{p.name}." />

<div class="stack">
    <div class="row">
        <RefPicker branches={data.branches} tags={[]} current={data.base.name} kind={data.base.kind} defaultBranch={p.default_branch} param="base" label="base" />
        <a class="btn icon sm" href={swap} aria-label="Swap"><Icon name="git-compare-arrows" size={14} /></a>
        <RefPicker branches={data.branches} tags={[]} current={data.head.name} kind={data.head.kind} defaultBranch={p.default_branch} param="head" label="compare" />
        <span class="grow"></span>
        {#if data.head.snapshot && data.base.snapshot && data.head.snapshot !== data.base.snapshot}
            {#if writer && data.plan && data.plan.kind !== 'up-to-date'}
                <a class="btn primary sm" href="{base}/merge?into={enc(data.base.name)}&from={enc(data.head.name)}"><Icon name="git-merge" size={14} /> Merge into {data.base.name}</a>
            {/if}
            {#if page.data.user}<a class="btn sm" href="{base}/proposals/new?base={enc(data.base.name)}&head={enc(data.head.name)}"><Icon name="git-pull-request-create" size={14} /> Open proposal</a>{/if}
        {/if}
    </div>

    <div class="row small">
        <span class="chip solid">{data.counts.ahead} ahead</span><span class="chip">{data.counts.behind} behind</span>
        {#if data.plan}
            {#if data.plan.kind === 'up-to-date'}<span class="muted">Already merged.</span>
            {:else if data.plan.kind === 'fast-forward'}<span class="muted">Can fast-forward cleanly.</span>
            {:else if data.plan.conflicts}<span class="chip red"><Icon name="git-merge-conflict" size={12} /> {data.plan.conflicts} conflict{data.plan.conflicts === 1 ? '' : 's'} to resolve</span>
            {:else}<span class="muted">Merges cleanly.</span>{/if}
        {/if}
    </div>

    {#if data.commits.length}
        <div class="list">
            {#each data.commits as c (c.id)}
                <a class="item" href="{base}/snapshots/{c.id}"><Icon name="git-commit-horizontal" class="muted" /><span class="grow clip">{c.message.split('\n')[0]}</span><span class="small muted">*{c.author?.username ?? c.author_name} · <Time date={c.created_at} /></span><span class="chip plain mono">{shortId(c.id)}</span></a>
            {/each}
        </div>
    {/if}

    <DiffView files={data.diffs} />
</div>
