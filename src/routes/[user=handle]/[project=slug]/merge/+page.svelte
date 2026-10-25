<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import ConflictEditor from '../ConflictEditor.svelte';
    import { enhanceForm } from '#lib/forms.ts';
    import { projectHref } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    let busy = $state(false);
    let complete = $state(false);
    const ready = $derived(data.kind !== 'merge' || data.conflicts.length === 0 || complete);
</script>

<Meta title="Merge {data.from} into {data.into} · {p.owner.username}/{p.name}" noindex />

<div class="stack narrow" style="max-width: 820px">
    <h2>Merge <span class="chip">{data.from}</span> into <span class="chip solid">{data.into}</span></h2>

    {#if data.kind === 'up-to-date'}
        <div class="empty"><h3>Already up to date</h3><p>{data.into} already contains everything from {data.from}.</p><p style="margin-top: 0.8rem"><a class="btn" href="{base}/branches">Back to branches</a></p></div>
    {:else}
        <form class="stack" method="POST" action="?/merge" use:enhance={enhanceForm({ busy: (b) => (busy = b) })}>
            <input type="hidden" name="into" value={data.into} /><input type="hidden" name="from" value={data.from} />
            {#if data.kind === 'fast-forward'}
                <div class="card"><b>Fast-forward.</b> <span class="muted">{data.into} has no newer work of its own, so it can simply move forward to {data.from}.</span></div>
                <label class="row small"><input type="checkbox" name="noff" /> Record a merge snapshot anyway</label>
            {:else}
                <div class="card stack">
                    <div class="row"><Icon name="git-merge" /> <b>{data.changed} file{data.changed === 1 ? '' : 's'} will change</b>
                        {#if data.autoMerged.length}<span class="chip">{data.autoMerged.length} auto-merged</span>{/if}
                        {#if data.conflicts.length}<span class="chip red">{data.conflicts.length} conflict{data.conflicts.length === 1 ? '' : 's'}</span>{/if}</div>
                    <div class="field"><label for="msg">Merge note</label><input class="input" id="msg" name="message" placeholder="Merge {data.from} into {data.into}" /></div>
                </div>
                {#if data.conflicts.length}
                    <h3>Resolve conflicts</h3>
                    <ConflictEditor conflicts={data.conflicts} oursLabel={data.into} theirsLabel={data.from} bind:complete />
                {/if}
            {/if}
            <div class="row">
                <button class="btn primary" disabled={busy || !ready}><Icon name="git-merge" /> {busy ? 'Merging…' : data.kind === 'fast-forward' ? 'Fast-forward' : 'Complete merge'}</button>
                <a class="btn" href="{base}/compare?base={encodeURIComponent(data.into)}&head={encodeURIComponent(data.from)}">Review diff</a>
            </div>
        </form>
    {/if}
</div>
