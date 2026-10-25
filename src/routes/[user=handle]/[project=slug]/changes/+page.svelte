<script lang="ts">
    import { enhance } from '$app/forms';
    import { invalidate } from '$app/navigation';
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import DiffView from '../DiffView.svelte';
    import RefPicker from '../RefPicker.svelte';
    import { enhanceForm } from '#lib/forms.ts';
    import { toast } from '#lib/toast.svelte.ts';
    import { formatBytes, projectHref, withRef } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    const refQ = $derived(withRef('', data.ref.name, p.default_branch));
    const act = (name: string) => `?/${name}${refQ ? `&${refQ.slice(1)}` : ''}`;

    let busy = $state(false);
    let uploading = $state<{ done: number; total: number } | null>(null);
    let dragging = $state(false);
    let dir = $state('');
    let unzip = $state(true);
    const stale = $derived(!data.readOnly && data.changes.some((c) => c.stale));

    interface Item { path: string; file: File }

    // Walks dropped folders; FileSystem entry APIs hand back directory contents in chunks.
    async function walk(entry: any, prefix: string, out: Item[]) {
        if (entry.isFile) {
            const file: File = await new Promise((res, rej) => entry.file(res, rej));
            out.push({ path: prefix + entry.name, file });
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            for (;;) {
                const batch: any[] = await new Promise((res, rej) => reader.readEntries(res, rej));
                if (!batch.length) break;
                for (const e of batch) await walk(e, `${prefix}${entry.name}/`, out);
            }
        }
    }

    async function onDrop(e: DragEvent) {
        e.preventDefault();
        dragging = false;
        const items = [...(e.dataTransfer?.items ?? [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
        const out: Item[] = [];
        if (items.length) for (const it of items) await walk(it, '', out);
        else for (const f of e.dataTransfer?.files ?? []) out.push({ path: f.name, file: f });
        await upload(out);
    }

    function onPick(e: Event, folder: boolean) {
        const input = e.currentTarget as HTMLInputElement;
        const out = [...(input.files ?? [])].map((file) => ({ path: folder ? ((file as any).webkitRelativePath || file.name) : file.name, file }));
        input.value = '';
        void upload(out);
    }

    async function upload(items: Item[]) {
        if (!items.length) return;
        // Small batches keep every request well under the server's body limit.
        const batches: Item[][] = [];
        let cur: Item[] = [];
        let size = 0;
        for (const it of items) {
            if (cur.length && (size + it.file.size > 20 * 1024 * 1024 || cur.length >= 150)) {
                batches.push(cur);
                cur = [];
                size = 0;
            }
            cur.push(it);
            size += it.file.size;
        }
        if (cur.length) batches.push(cur);

        const sum = { staged: 0, ignored: 0, unchanged: 0, tooLarge: [] as string[] };
        uploading = { done: 0, total: items.length };
        try {
            for (const b of batches) {
                const fd = new FormData();
                fd.set('dir', dir);
                fd.set('unzip', unzip ? '1' : '0');
                for (const it of b) {
                    fd.append('path', it.path);
                    fd.append('file', it.file);
                }
                const res = await fetch(`${base}/changes/upload${refQ}`, { method: 'POST', body: fd });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body?.message ?? `Upload failed (${res.status})`);
                sum.staged += body.staged;
                sum.ignored += body.ignored;
                sum.unchanged += body.unchanged;
                sum.tooLarge.push(...body.tooLarge);
                uploading = { done: uploading.done + b.length, total: items.length };
            }
            toast(`Staged ${sum.staged} file${sum.staged === 1 ? '' : 's'}${sum.ignored ? `, ignored ${sum.ignored}` : ''}${sum.unchanged ? `, ${sum.unchanged} unchanged` : ''}`, 'success');
            if (sum.tooLarge.length) toast(`Too large to track: ${sum.tooLarge.slice(0, 3).join(', ')}${sum.tooLarge.length > 3 ? '…' : ''}`, 'error');
        } catch (err) {
            toast((err as Error).message, 'error');
        } finally {
            uploading = null;
            await invalidate('bitlin:changes');
        }
    }
</script>

<Meta title="Changes · {p.owner.username}/{p.name}" noindex />

{#if data.readOnly}
    <div class="empty"><h3>Pick a branch to change</h3><p>You are viewing <b>{data.ref.name}</b>, which is read-only. Switch to one of your branches.</p>
        <p style="margin-top: 0.8rem"><RefPicker branches={data.branches} current={data.ref.name} kind={data.ref.kind} defaultBranch={p.default_branch} /></p></div>
{:else}
    <div class="row between"><div class="row"><h2>Changes</h2><RefPicker branches={data.branches.filter((b) => !b.tracking)} current={data.ref.name} kind="branch" defaultBranch={p.default_branch} /></div>
        {#if data.changes.length}<form method="POST" action={act('discard')} use:enhance={enhanceForm({ success: 'Discarded all changes' })}><input type="hidden" name="path" value="" /><button class="btn sm danger"><Icon name="eraser" size={14} /> Discard all</button></form>{/if}</div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="drop" class:over={dragging} ondragover={(e) => { e.preventDefault(); dragging = true; }} ondragleave={() => (dragging = false)} ondrop={onDrop}>
        <Icon name="cloud-upload" size={28} />
        {#if uploading}
            <b>Uploading {uploading.done} / {uploading.total}…</b>
            <progress max={uploading.total} value={uploading.done}></progress>
        {:else}
            <b>Drop files, folders or a ZIP here</b>
            <div class="row" style="justify-content: center">
                <label class="btn sm"><input type="file" multiple hidden onchange={(e) => onPick(e, false)} /> Choose files</label>
                <label class="btn sm"><input type="file" hidden {...{ webkitdirectory: true }} onchange={(e) => onPick(e, true)} /> Choose folder</label>
                <a class="btn sm" href={`${base}/edit/${refQ}`}><Icon name="file-plus" size={14} /> New file</a>
            </div>
            <div class="row small muted" style="justify-content: center">
                <input class="input" style="width: 11rem; padding: 0.3rem 0.5rem" placeholder="Into folder (optional)" bind:value={dir} aria-label="Target folder" />
                <label class="row"><input type="checkbox" bind:checked={unzip} /> Unpack ZIPs</label>
            </div>
            <span class="hint">Files matching your <a href="{base}/ignore">ignore rules</a> are skipped automatically.</span>
        {/if}
    </div>

    {#if data.changes.length}
        {#if stale}<div class="card"><b>Some files changed on this branch after you staged them.</b> <span class="muted">They’re marked below. Saving will overwrite the newer versions only if you tick “save anyway”.</span></div>{/if}

        <form class="card stack" method="POST" action={act('commit')} use:enhance={enhanceForm({ busy: (b) => (busy = b) })}>
            <div class="field">
                <label for="message">Snapshot note</label>
                <textarea class="textarea" id="message" name="message" rows="2" placeholder="What changed, in a sentence?" required></textarea>
            </div>
            <div class="row between">
                <div class="row small muted"><span>{data.changes.length} file{data.changes.length === 1 ? '' : 's'} staged on <b>{data.ref.name}</b></span>
                    {#if stale}<label class="row"><input type="checkbox" name="force" /> save anyway</label>{/if}</div>
                <button class="btn primary" disabled={busy}><Icon name="git-commit-horizontal" /> {busy ? 'Saving…' : 'Save snapshot'}</button>
            </div>
        </form>

        <DiffView files={data.diffs}>
            {#snippet actions(f)}
                {@const c = data.changes.find((x) => x.path === f.path)}
                <span class="row" style="gap: 0.4rem">
                    {#if c?.stale}<span class="chip red">changed upstream</span>{/if}
                    <form method="POST" action={act('discard')} use:enhance={enhanceForm()}><input type="hidden" name="path" value={f.path} /><button class="btn sm ghost" aria-label="Discard {f.path}"><Icon name="rotate-ccw" size={14} /></button></form>
                </span>
            {/snippet}
        </DiffView>
    {:else}
        <div class="empty"><h3>Nothing staged</h3><p>Upload or edit files, review them here, then save a snapshot.</p></div>
    {/if}
{/if}

<style>
    .drop { display: flex; flex-direction: column; align-items: center; gap: 0.7rem; text-align: center; padding: 1.6rem 1rem; border: 2px dashed var(--line); border-radius: var(--radius); background: var(--surface); transition: border-color 0.12s, background 0.12s; color: var(--accent); }
    .drop.over { border-color: var(--blue); background: var(--surface-2); }
    .drop b { color: var(--fg); font-weight: 400; }
    .drop progress { width: min(320px, 80%); accent-color: var(--blue); }
</style>
