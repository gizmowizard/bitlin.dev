<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../../Meta.svelte';
    import Icon from '../../../../Icon.svelte';
    import { fileIcon } from '../../../../fileicon.ts';
    import { can } from '#lib/access.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import { formatBytes, projectHref, shortId, withRef } from '#lib/util.ts';
    import { toast } from '#lib/toast.svelte.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    const refQ = $derived(withRef('', data.ref.name, p.default_branch));
    const q = (path: string) => withRef(`${base}${path}`, data.ref.name, p.default_branch);
    const crumbs = $derived(data.path ? data.path.split('/').map((name, i, a) => ({ name, path: a.slice(0, i + 1).join('/') })) : []);
    const writer = $derived(can(data.role, 'write') && !!data.ref.branch);
    let rendered = $state(true);

    const copyLink = async () => {
        await navigator.clipboard?.writeText(`${location.origin}${base}/files/${data.path}${data.ref.snapshot ? `?ref=${data.ref.snapshot.slice(0, 12)}` : ''}`);
        toast('Permalink copied', 'success');
    };
</script>

<Meta
    title="{data.path || p.name} · {p.owner.username}/{p.name}"
    description={data.kind === 'file' ? `${data.path} (${formatBytes(data.size)}) at ${data.ref.name} in *${p.owner.username}/${p.name}` : `Files in *${p.owner.username}/${p.name} at ${data.ref.name}`}
    path={`${base}/files/${data.path}`}
/>

<nav class="crumbs row" aria-label="Path">
    <a href={q('/files/')}>{p.name}</a>
    {#each crumbs as c (c.path)}<Icon name="chevron-right" size={14} class="muted" /><a href={q(`/files/${c.path}`)}>{c.name}</a>{/each}
</nav>

{#if data.kind === 'dir'}
    <div class="list">
        {#if data.path}<a class="item" href={q(`/files/${data.path.split('/').slice(0, -1).join('/')}`)}><Icon name="arrow-left" class="muted" /> ..</a>{/if}
        {#each data.entries as e (e.path)}
            <a class="item" href={q(`/files/${e.path}`)}>
                <Icon name={e.type === 'dir' ? 'folder' : fileIcon(e.path)} class="muted" />
                <span class="grow clip">{e.name}{e.type === 'dir' ? '/' : ''}</span>
                <span class="small muted">{e.type === 'dir' ? `${e.count} files` : formatBytes(e.size)}</span>
            </a>
        {:else}
            <div class="item muted">This folder is empty.</div>
        {/each}
    </div>
    {#if writer}<div class="row"><a class="btn sm" href={q(`/edit/${data.path ? `${data.path}/` : ''}`)}><Icon name="file-plus" size={14} /> New file here</a></div>{/if}
{:else}
    <div class="card flat fileview">
        <div class="bar row between">
            <div class="row small muted"><Icon name={fileIcon(data.path)} size={14} /> <span>{formatBytes(data.size)}</span>
                {#if data.type === 'text'}<span>· {data.lineCount} lines</span>{/if}
                {#if data.ref.snapshot}<span class="chip plain mono">{shortId(data.ref.snapshot)}</span>{/if}</div>
            <div class="row">
                {#if data.type === 'text' && data.html}<button class="btn sm" onclick={() => (rendered = !rendered)}>{rendered ? 'Source' : 'Preview'}</button>{/if}
                <button class="btn sm" onclick={copyLink}><Icon name="link" size={14} /> Permalink</button>
                <a class="btn sm" href="{base}/raw/{data.path}{refQ}" data-sveltekit-reload>Raw</a>
                {#if writer}
                    <a class="btn sm" href={q(`/edit/${data.path}`)}><Icon name="pencil" size={14} /> Edit</a>
                    <form method="POST" action="{base}/changes?/stageDelete{refQ ? `&${refQ.slice(1)}` : ''}" use:enhance={enhanceForm({ success: 'Deletion staged' })}>
                        <input type="hidden" name="path" value={data.path} />
                        <button class="btn sm danger" aria-label="Stage deletion"><Icon name="trash-2" size={14} /></button>
                    </form>
                {/if}
            </div>
        </div>
        {#if data.type === 'text'}
            {#if data.html && rendered}
                <div class="md body">{@html data.html}</div>
            {:else}
                <div class="code" role="region" aria-label="File contents">
                    {#each data.lines as line, i (i)}<div class="ln" id="L{i + 1}"><a href="#L{i + 1}">{i + 1}</a><span>{line || ' '}</span></div>{/each}
                </div>
                {#if data.truncated}<p class="body muted small">Showing the first {data.lines.length} lines. Use Raw for the full file.</p>{/if}
            {/if}
        {:else if data.type === 'image'}
            <div class="body center"><img src="{base}/raw/{data.path}{refQ}" alt={data.path} /></div>
        {:else}
            <div class="body center muted"><Icon name="file-question" size={28} /><p>{data.type === 'large' ? 'This file is too large to preview.' : 'Binary file: no preview available.'}</p>
                <a class="btn sm" href="{base}/raw/{data.path}{refQ ? `${refQ}&` : '?'}download=1" data-sveltekit-reload><Icon name="download" size={14} /> Download</a></div>
        {/if}
    </div>
{/if}

<style>
    .crumbs { gap: 0.3rem; font-size: 0.95rem; }
    .fileview { padding: 0; overflow: hidden; }
    .bar { padding: 0.6rem 0.9rem; border-bottom: 1px solid var(--line); background: var(--surface); }
    .body { padding: 1rem 1.2rem; }
    .center { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; padding: 2.5rem 1rem; }
    .center img { max-width: 100%; max-height: 70dvh; border-radius: 6px; }
    .code { overflow-x: auto; font-family: var(--mono); font-size: 0.82rem; line-height: 1.55; padding: 0.5rem 0; }
    .ln { display: flex; min-width: max-content; }
    .ln a { flex: none; width: 3.6rem; text-align: right; padding-right: 0.9rem; color: var(--muted); user-select: none; }
    .ln span { white-space: pre; padding-right: 1rem; }
    .ln:target { background: var(--add-bg); }
    .ln:hover { background: var(--surface); }
</style>
