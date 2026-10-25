<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../../Meta.svelte';
    import Icon from '../../../../Icon.svelte';
    import Avatar from '../../../../Avatar.svelte';
    import Time from '../../../../Time.svelte';
    import DiffView from '../../DiffView.svelte';
    import ConflictEditor from '../../ConflictEditor.svelte';
    import { page } from '$app/state';
    import { can } from '#lib/access.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import { ws } from '#lib/ws.svelte.ts';
    import { plainText, projectHref, shortId } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const pr = $derived(data.pr);
    const base = $derived(projectHref(p.owner.username, p.name));
    const writer = $derived(can(data.role, 'write'));
    const me = $derived(page.data.user);
    const ctx = $derived(`proposal:${pr.number}`);
    const typers = $derived((ws.typers[`project:${p.id}|${ctx}`] ?? []).filter((u) => u.id !== me?.id));
    let busy = $state(false);
    let complete = $state(false);
    let body = $state('');
    const canMerge = $derived(!!data.plan && data.plan.kind !== 'up-to-date' && (data.plan.conflicts.length === 0 || complete));
    const icon = $derived(pr.status === 'merged' ? 'git-merge' : pr.status === 'closed' ? 'git-pull-request-closed' : 'git-pull-request');
</script>

<Meta
    title="#{pr.number} {pr.title} · {p.owner.username}/{p.name}"
    description="{pr.status === 'merged' ? 'Merged' : pr.status === 'closed' ? 'Closed' : 'Open'} proposal by *{pr.author?.username ?? 'someone'}: {pr.source_branch} → {pr.target_branch}, {data.diffs.length} file{data.diffs.length === 1 ? '' : 's'} changed. {plainText(pr.body, 140)}"
    path="{base}/proposals/{pr.number}"
    type="article"
    published={pr.created_at}
/>

<div class="stack">
    <div class="stack" style="gap: 0.5rem">
        <h2 style="overflow-wrap: anywhere">{pr.title} <span class="muted">#{pr.number}</span></h2>
        <div class="row small">
            <span class="chip {pr.status === 'open' ? 'solid' : pr.status === 'closed' ? 'red' : ''}"><Icon name={icon} size={12} /> {pr.status}</span>
            <span class="muted">{pr.author ? `*${pr.author.username}` : 'Someone'} wants to merge</span><span class="chip">{pr.source_branch}{pr.source_project_id !== p.id ? ` (*${pr.source_owner}/${pr.source_name})` : ''}</span>
            <Icon name="arrow-right" size={14} /><span class="chip">{pr.target_branch}</span><span class="muted">· <Time date={pr.created_at} /></span>
        </div>
    </div>

    <div class="two-col">
        <div class="stack">
            {#if pr.body}<div class="card flat md">{@html pr.html}</div>{/if}

            {#if data.commits.length}
                <details class="card flat"><summary><b>{data.commits.length} snapshot{data.commits.length === 1 ? '' : 's'}</b></summary>
                    <div class="stack" style="margin-top: 0.6rem; gap: 0.3rem">{#each data.commits as c}<a class="row small" href="{base}/snapshots/{c.id}"><span class="mono chip plain">{shortId(c.id)}</span><span class="clip">{c.message.split('\n')[0]}</span></a>{/each}</div></details>
            {/if}

            <DiffView files={data.diffs} />

            <h3>Discussion</h3>
            {#each data.comments as c (c.id)}
                <div class="card flat stack" style="gap: 0.5rem">
                    <div class="row between"><div class="row small"><Avatar user={c.author ?? { username: '?' }} size={22} /><b>{c.author ? `*${c.author.username}` : 'Deleted user'}</b><span class="muted"><Time date={c.created_at} /></span></div>
                        {#if me && (c.author?.id === me.id || can(data.role, 'admin'))}<form method="POST" action="?/deleteComment" use:enhance={enhanceForm()}><input type="hidden" name="id" value={c.id} /><button class="btn ghost sm" aria-label="Delete comment"><Icon name="trash-2" size={14} /></button></form>{/if}</div>
                    <div class="md">{@html c.html}</div>
                </div>
            {:else}<p class="muted small">No comments yet.</p>{/each}
            {#if typers.length}<p class="small muted"><Icon name="pencil" size={12} /> {typers.map((u) => `*${u.username}`).join(', ')} {typers.length === 1 ? 'is' : 'are'} typing…</p>{/if}

            {#if me}
                <form class="stack" method="POST" action="?/comment" use:enhance={enhanceForm({ reset: true, after: () => (body = '') })}>
                    <textarea class="textarea" name="body" bind:value={body} rows="3" placeholder="Leave a comment (markdown)" oninput={() => ws.typing(`project:${p.id}`, ctx)} required></textarea>
                    <button class="btn primary" style="align-self: flex-start" disabled={!body.trim()}>Comment</button>
                </form>
            {:else}<p class="muted"><a href="/#signin">Sign in</a> to join the discussion.</p>{/if}
        </div>

        <aside class="stack">
            {#if pr.status === 'merged'}
                <div class="card stack"><b><Icon name="git-merge" size={16} /> Merged</b><span class="small muted">{#if pr.merged_snapshot}as <a class="mono" href="{base}/snapshots/{pr.merged_snapshot}">{shortId(pr.merged_snapshot)}</a>{/if}</span></div>
            {:else if pr.status === 'open' && writer && data.plan}
                <form class="card stack" method="POST" action="?/merge" use:enhance={enhanceForm({ busy: (b) => (busy = b), success: 'Merged' })}>
                    <b>Merge</b>
                    {#if data.plan.kind === 'up-to-date'}<span class="small muted">Nothing left to merge.</span>
                    {:else}
                        <span class="small muted">{data.plan.kind === 'fast-forward' ? 'Can fast-forward.' : data.plan.conflicts.length ? `${data.plan.conflicts.length} conflict(s) to resolve below.` : 'No conflicts.'}</span>
                        {#if data.plan.conflicts.length}<ConflictEditor conflicts={data.plan.conflicts} oursLabel={pr.target_branch} theirsLabel={pr.source_branch} bind:complete />{/if}
                        <input class="input" name="message" placeholder="Merge note (optional)" />
                        <button class="btn primary" disabled={busy || !canMerge}><Icon name="git-merge" /> {busy ? 'Merging…' : 'Merge proposal'}</button>
                    {/if}
                </form>
            {:else if data.sourceMissing && pr.status === 'open'}
                <div class="card small muted">The source branch no longer exists.</div>
            {/if}
            {#if me && pr.status !== 'merged' && (pr.author?.id === me.id || writer)}
                <form method="POST" action="?/{pr.status === 'open' ? 'close' : 'reopen'}" use:enhance={enhanceForm()}><button class="btn" style="width: 100%">{pr.status === 'open' ? 'Close proposal' : 'Reopen proposal'}</button></form>
            {/if}
        </aside>
    </div>
</div>
