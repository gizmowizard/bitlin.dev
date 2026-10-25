<script lang="ts">
    import Icon from './Icon.svelte';
    import Time from './Time.svelte';
    import { projectHref } from '#lib/util.ts';

    interface Props {
        p: { name: string; description: string; visibility: string; updated_at: Date; is_fork: boolean; owner: string; snapshots: number };
        showOwner?: boolean;
    }
    let { p, showOwner = true }: Props = $props();
</script>

<a class="card link stack" href={projectHref(p.owner, p.name)}>
    <div class="row between">
        <b class="clip">{showOwner ? `*${p.owner} / ` : ''}{p.name}</b>
        {#if p.visibility === 'private'}<span class="chip"><Icon name="lock" size={12} /> Private</span>{/if}
    </div>
    <p class="small muted desc">{p.description || 'No description yet.'}</p>
    <div class="row small muted">
        <span class="row" style="gap: 0.3rem"><Icon name="stack" size={14} /> {p.snapshots}</span>
        {#if p.is_fork}<span class="row" style="gap: 0.3rem"><Icon name="git-fork" size={14} /> fork</span>{/if}
        <span class="grow"></span>
        <Time date={p.updated_at} />
    </div>
</a>

<style>
    .desc { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.9em; }
</style>
