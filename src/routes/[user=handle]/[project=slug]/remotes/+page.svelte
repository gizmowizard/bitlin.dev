<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import Time from '../../../Time.svelte';
    import { can } from '#lib/access.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import { toast } from '#lib/toast.svelte.ts';
    import { projectHref } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    const admin = $derived(can(data.role, 'admin'));
    const writer = $derived(can(data.role, 'write'));
    const own = $derived(data.branches.filter((b) => !b.tracking && b.head));
    let busy = $state<string | null>(null);
    const done = (d: any) => {
        const r = d?.result;
        if (r) toast(d.pushed ? `Pushed ${r.snapshots} snapshot${r.snapshots === 1 ? '' : 's'}` : `Fetched ${r.snapshots} new snapshot${r.snapshots === 1 ? '' : 's'} across ${r.branches} branch${r.branches === 1 ? '' : 'es'}`, 'success');
    };
</script>

<Meta title="Remotes · {p.owner.username}/{p.name}" description="Remotes link *{p.owner.username}/{p.name} to other Bitlin projects so snapshots can be fetched and pushed." />

<div class="stack">
    <p class="muted">A remote is another Bitlin project, on this server or any other. <b>Fetch</b> brings its branches in as read-only tracking branches; <b>push</b> sends one of yours back.</p>

    {#if admin}
        <form class="card stack" method="POST" action="?/add" use:enhance={enhanceForm({ reset: true, success: 'Remote added' })}>
            <b>Add a remote</b>
            <div class="row">
                <input class="input" style="width: 9rem" name="name" placeholder="origin" required />
                <input class="input grow" style="min-width: 14rem" name="url" placeholder="https://bitlin.dev/*user/project" required />
            </div>
            <input class="input" type="password" name="token" placeholder="Access token (needed to push or read private projects)" autocomplete="off" />
            <button class="btn primary" style="align-self: flex-start"><Icon name="plus" size={14} /> Add remote</button>
        </form>
    {/if}

    {#each data.remotes as r (r.name)}
        <div class="card stack">
            <div class="row between">
                <div style="min-width: 0"><div class="row"><Icon name="server" /><b>{r.name}</b>{#if r.has_token}<span class="chip plain"><Icon name="key-round" size={12} /> token</span>{/if}</div>
                    <div class="small muted clip mono">{r.url}</div>
                    <div class="small muted">{r.last_fetched_at ? 'Fetched ' : 'Never fetched'}{#if r.last_fetched_at}<Time date={r.last_fetched_at} />{/if}</div></div>
                <div class="row">
                    {#if writer}<form method="POST" action="?/fetch" use:enhance={enhanceForm({ busy: (b) => (busy = b ? `f-${r.name}` : null), after: done })}><input type="hidden" name="name" value={r.name} />
                        <button class="btn sm" disabled={busy !== null}>{#if busy === `f-${r.name}`}<Icon name="loader-circle" size={14} class="spin" /> Fetching…{:else}<Icon name="cloud-download" size={14} /> Fetch{/if}</button></form>{/if}
                    {#if admin}<form method="POST" action="?/remove" use:enhance={enhanceForm({ success: 'Remote removed' })} onsubmit={(e) => !confirm(`Remove remote “${r.name}” and its tracking branches?`) && e.preventDefault()}><input type="hidden" name="name" value={r.name} /><button class="btn sm danger" aria-label="Remove"><Icon name="trash-2" size={14} /></button></form>{/if}
                </div>
            </div>

            {#if writer && own.length}
                <form class="row" method="POST" action="?/push" use:enhance={enhanceForm({ busy: (b) => (busy = b ? `p-${r.name}` : null), after: done })}>
                    <input type="hidden" name="name" value={r.name} />
                    <select class="select" style="width: auto" name="branch" aria-label="Branch to push">{#each own as b}<option value={b.name} selected={b.name === data.ref.name}>{b.name}</option>{/each}</select>
                    <Icon name="arrow-right" size={14} />
                    <input class="input" style="width: 10rem" name="target" placeholder="same name" aria-label="Remote branch" />
                    <label class="row small muted"><input type="checkbox" name="force" /> force</label>
                    <button class="btn sm primary" disabled={busy !== null}>{#if busy === `p-${r.name}`}<Icon name="loader-circle" size={14} class="spin" /> Pushing…{:else}<Icon name="cloud-upload" size={14} /> Push{/if}</button>
                </form>
            {/if}

            {#each data.tracking.filter((t) => t.tracking === r.name) as t (t.name)}
                <div class="row small"><Icon name="git-branch" size={14} class="muted" /><a href="{base}/files/?ref={encodeURIComponent(t.name)}">{t.name}</a><span class="grow"></span>
                    {#if writer}<a href="{base}/merge?into={encodeURIComponent(p.default_branch)}&from={encodeURIComponent(t.name)}">merge into {p.default_branch}</a>{/if}</div>
            {/each}
        </div>
    {:else}
        <div class="empty"><h3>No remotes</h3><p>Add one to start exchanging snapshots with another project.</p></div>
    {/each}
</div>
