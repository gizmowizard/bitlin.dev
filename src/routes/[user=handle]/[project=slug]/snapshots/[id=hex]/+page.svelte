<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../../Meta.svelte';
    import Icon from '../../../../Icon.svelte';
    import Avatar from '../../../../Avatar.svelte';
    import Time from '../../../../Time.svelte';
    import DiffView from '../../DiffView.svelte';
    import { can } from '#lib/access.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import { projectHref, shortId, withRef } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const s = $derived(data.snapshot);
    const base = $derived(projectHref(p.owner.username, p.name));
    const writer = $derived(can(data.role, 'write'));
    const writable = $derived(data.branches.filter((b) => !b.tracking));
    let panel = $state<'' | 'restore' | 'branch' | 'tag'>('');
    let branch = $state('');
    $effect(() => {
        branch = data.ref.branch ?? p.default_branch;
    });
    const added = $derived(data.diffs.reduce((n, d) => n + d.additions, 0));
    const removed = $derived(data.diffs.reduce((n, d) => n + d.deletions, 0));
</script>

<Meta
    title="{s.message.split('\n')[0]} · {p.owner.username}/{p.name}"
    description="Snapshot {shortId(s.id)} by *{s.author?.username ?? s.author_name} in *{p.owner.username}/{p.name}: {data.diffs.length} file{data.diffs.length === 1 ? '' : 's'} changed (+{added} −{removed}). {s.message.split('\n').slice(1).join(' ').trim()}"
    path="{base}/snapshots/{s.id}"
    type="article"
    published={s.created_at}
/>

<div class="stack">
    <div class="card stack">
        <div class="row between" style="align-items: flex-start">
            <div style="min-width: 0"><h2 style="overflow-wrap: anywhere">{s.message.split('\n')[0]}</h2></div>
            <span class="chip mono">{shortId(s.id)}</span>
        </div>
        {#if s.message.includes('\n')}<p class="small muted" style="white-space: pre-wrap">{s.message.split('\n').slice(1).join('\n').trim()}</p>{/if}
        <div class="row small muted">
            <Avatar user={s.author ?? { username: s.author_name }} size={20} /> <span>*{s.author?.username ?? s.author_name}</span> · <Time date={s.created_at} /> · <span>{data.fileCount} files</span>
            {#each data.heads as b}<span class="chip solid"><Icon name="git-branch" size={12} /> {b}</span>{/each}
            {#each data.tags as t}<a class="chip" href="{base}/tags/{t}"><Icon name="tag" size={12} /> {t}</a>{/each}
        </div>
        <div class="row small">
            {#each data.parents as par, i}<span class="muted">{data.parents.length > 1 ? `Parent ${i + 1}:` : 'Parent:'}</span> <a class="mono" href="{base}/snapshots/{par.id}">{shortId(par.id)}</a>{/each}
            {#if !data.parents.length}<span class="muted">Initial snapshot</span>{/if}
        </div>
        <div class="row">
            <a class="btn sm" href="{base}/files/?ref={s.id.slice(0, 12)}"><Icon name="folder-open" size={14} /> Browse files</a>
            <a class="btn sm" href="{base}/archive?ref={s.id.slice(0, 12)}" data-sveltekit-reload><Icon name="download" size={14} /> ZIP</a>
            {#if writer}
                <button class="btn sm" onclick={() => (panel = panel === 'restore' ? '' : 'restore')}><Icon name="archive-restore" size={14} /> Restore</button>
                <button class="btn sm" onclick={() => (panel = panel === 'branch' ? '' : 'branch')}><Icon name="git-branch-plus" size={14} /> Branch from here</button>
                <button class="btn sm" onclick={() => (panel = panel === 'tag' ? '' : 'tag')}><Icon name="tag" size={14} /> Tag</button>
            {/if}
        </div>

        {#if panel === 'restore'}
            <form class="card flat stack" method="POST" action="?/restore" use:enhance={enhanceForm({ success: 'Restored as a new snapshot' })}>
                <p class="small">Restoring adds a <b>new snapshot</b> on the branch that matches this version. Nothing in your history is lost, so you can undo it later.</p>
                <div class="field"><label for="rb">Restore onto</label><select class="select" id="rb" name="branch" bind:value={branch}>{#each writable as b}<option value={b.name}>{b.name}</option>{/each}</select></div>
                <div class="field"><label for="rp">Only these paths <span class="muted">(optional, one per line)</span></label><textarea class="textarea" id="rp" name="paths" rows="2" placeholder="src/app.ts"></textarea></div>
                <button class="btn primary" style="align-self: flex-start">Restore</button>
            </form>
        {:else if panel === 'branch'}
            <form class="card flat row" method="POST" action="?/branch" use:enhance={enhanceForm()}>
                <input class="input grow" name="name" placeholder="new-branch-name" required />
                <button class="btn primary">Create branch</button>
            </form>
        {:else if panel === 'tag'}
            <form class="card flat stack" method="POST" action="?/tag" use:enhance={enhanceForm()}>
                <div class="field"><label for="tn">Tag name</label><input class="input" id="tn" name="name" placeholder="v1.0.0" required /></div>
                <div class="field"><label for="tm">Title</label><input class="input" id="tm" name="message" placeholder="First stable release" maxlength="200" /></div>
                <div class="field"><label for="tt">Release notes <span class="muted">(markdown)</span></label><textarea class="textarea" id="tt" name="notes" rows="4"></textarea></div>
                <button class="btn primary" style="align-self: flex-start">Create tag</button>
            </form>
        {/if}
    </div>

    <div class="row between"><h3>Changes {data.baseId ? `since ${shortId(data.baseId)}` : '(initial snapshot)'}</h3></div>
    <DiffView files={data.diffs}>
        {#snippet actions(f)}
            {#if writer && data.baseId && f.status !== 'added'}
                <form method="POST" action="?/restore" use:enhance={enhanceForm({ success: 'File restored as a new snapshot' })}>
                    <input type="hidden" name="branch" value={data.ref.branch ?? p.default_branch} /><input type="hidden" name="paths" value={f.path} />
                    <button class="btn sm ghost" title="Restore this file to its state in this snapshot"><Icon name="rotate-ccw" size={14} /></button>
                </form>
            {/if}
        {/snippet}
    </DiffView>
</div>
