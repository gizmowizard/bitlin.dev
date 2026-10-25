<script lang="ts">
    import { page } from '$app/state';
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import Avatar from '../../../Avatar.svelte';
    import Time from '../../../Time.svelte';
    import { projectHref } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
</script>

<Meta title="Proposals · {p.owner.username}/{p.name}" description="Proposed changes to *{p.owner.username}/{p.name}: review a diff, discuss it, and merge." />

<div class="stack">
    <div class="row between">
        <div class="row"><h2>Proposals</h2>
            <a class="chip" class:solid={data.status === 'open'} href="{base}/proposals">Open</a><a class="chip" class:solid={data.status === 'closed'} href="{base}/proposals?status=closed">Closed</a></div>
        {#if page.data.user}<a class="btn primary sm" href="{base}/proposals/new"><Icon name="git-pull-request-create" size={14} /> New proposal</a>{/if}
    </div>
    {#if data.proposals.length}
        <div class="list">
            {#each data.proposals as pr (pr.id)}
                <a class="item" href="{base}/proposals/{pr.number}">
                    <Icon name={pr.status === 'merged' ? 'git-merge' : pr.status === 'closed' ? 'git-pull-request-closed' : 'git-pull-request'} class={pr.status === 'closed' ? 'danger' : ''} />
                    <div class="grow"><b>{pr.title}</b>
                        <div class="small muted clip">#{pr.number} · {pr.source_branch}{pr.source_project_id !== p.id ? ` (*${pr.source_owner}/${pr.source_name})` : ''} → {pr.target_branch} · <Time date={pr.created_at} /></div></div>
                    {#if pr.author}<Avatar user={pr.author} size={22} />{/if}
                </a>
            {/each}
        </div>
    {:else}
        <div class="empty"><h3>No {data.status} proposals</h3><p>A proposal asks to merge one branch into another, with a diff and a discussion.</p></div>
    {/if}
</div>
