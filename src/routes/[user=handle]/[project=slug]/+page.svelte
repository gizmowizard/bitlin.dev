<script lang="ts">
    import Meta from '../../Meta.svelte';
    import Icon from '../../Icon.svelte';
    import Avatar from '../../Avatar.svelte';
    import Time from '../../Time.svelte';
    import RefPicker from './RefPicker.svelte';
    import { fileIcon } from '../../fileicon.ts';
    import { describeActivity } from '../../activity.ts';
    import { can } from '#lib/access.ts';
    import { formatBytes, projectHref, shortId, withRef } from '#lib/util.ts';
    import { toast } from '#lib/toast.svelte.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    const q = (path = '') => withRef(`${base}${path}`, data.ref.name, p.default_branch);
    const remoteUrl = $derived(`${data.origin}${base}`);
    const writer = $derived(can(data.role, 'write'));
    const latest = $derived(data.recent[0]);
    const copy = async (t: string) => {
        await navigator.clipboard?.writeText(t);
        toast('Copied', 'success');
    };
</script>

<Meta title="{p.owner.username}/{p.name}" description={data.description} path={base} imageAlt="{p.name} on Bitlin" />

<div class="vitals">
    <div class="card"><div class="n">{data.stats.snapshots}</div><div class="muted small">Snapshots</div></div>
    <div class="card"><div class="n">{data.stats.branches}</div><div class="muted small">Branches</div></div>
    <div class="card"><div class="n">{data.stats.tags}</div><div class="muted small">Tags</div></div>
    <div class="card"><div class="n">{data.fileCount}</div><div class="muted small">Files · {formatBytes(data.size)}</div></div>
</div>

<div class="two-col">
    <div class="stack">
        <div class="row between">
            <RefPicker branches={data.branches} tags={data.tags.map((t) => t.name)} current={data.ref.name} kind={data.ref.kind} defaultBranch={p.default_branch} />
            {#if writer && data.ref.branch}<a class="btn sm primary" href={q('/changes')}><Icon name="upload" size={14} /> Add files</a>{/if}
        </div>

        {#if !data.ref.snapshot}
            <div class="card stack">
                <h3>This project is empty</h3>
                <p class="muted">Bitlin keeps a named version, a <b>snapshot</b>, every time you save. Start with your first one:</p>
                <ol class="steps muted">
                    <li>Upload files, a folder, or a ZIP on the Changes tab.</li>
                    <li>Review what changed, write a short note, and save the snapshot.</li>
                </ol>
                {#if writer}<a class="btn primary" style="align-self: flex-start" href={q('/changes')}><Icon name="upload" /> Upload files</a>{/if}
            </div>
        {:else}
            {#if latest}
                <a class="card link row pulse" href="{base}/snapshots/{latest.id}">
                    <Avatar user={latest.author ?? { username: latest.author_name }} size={34} />
                    <div class="grow"><div class="clip"><b>{latest.message.split('\n')[0]}</b></div><div class="small muted"><span>*{latest.author?.username ?? latest.author_name}</span> · <Time date={latest.created_at} /></div></div>
                    <span class="chip mono">{shortId(latest.id)}</span>
                </a>
            {/if}
            <div class="list">
                {#each data.entries as e (e.path)}
                    <a class="item" href={q(`/files/${e.path}`)}>
                        <Icon name={e.type === 'dir' ? 'folder' : fileIcon(e.path)} class="muted" />
                        <span class="grow clip">{e.name}{e.type === 'dir' ? '/' : ''}</span>
                        <span class="small muted">{e.type === 'dir' ? `${e.count} files` : formatBytes(e.size)}</span>
                    </a>
                {/each}
            </div>
            {#if data.readme}
                <div class="card flat">
                    <div class="small muted row" style="margin-bottom: 0.8rem"><Icon name="book-open" size={14} /> {data.readme.name}</div>
                    {#if data.readme.html}<div class="md">{@html data.readme.html}</div>{:else}<pre class="plain">{data.readme.text}</pre>{/if}
                </div>
            {/if}
        {/if}
    </div>

    <aside class="stack">
        <div class="card stack">
            <b>Remote address</b>
            <div class="row"><code class="grow clip small">{remoteUrl}</code><button class="btn icon sm" aria-label="Copy address" onclick={() => copy(remoteUrl)}><Icon name="copy" size={14} /></button></div>
            <span class="hint">Add this as a remote from another Bitlin project to fetch and push.</span>
        </div>

        <div class="stack">
            <div class="row between"><h3>Timeline</h3><a class="small" href={q('/snapshots')}>All</a></div>
            {#if data.recent.length}
                <ol class="timeline">
                    {#each data.recent as s (s.id)}
                        <li><a href="{base}/snapshots/{s.id}"><span class="clip">{s.message.split('\n')[0]}</span><span class="small muted"><Time date={s.created_at} />{s.parents.length > 1 ? ' · merge' : ''}</span></a></li>
                    {/each}
                </ol>
            {:else}<p class="muted small">No snapshots yet.</p>{/if}
        </div>

        {#if data.sideBranches.length}
            <div class="stack">
                <div class="row between"><h3>Branches</h3><a class="small" href={q('/branches')}>All</a></div>
                <div class="list">
                    {#each data.sideBranches as b (b.name)}
                        <a class="item" href="{base}/compare?base={encodeURIComponent(p.default_branch)}&head={encodeURIComponent(b.name)}">
                            <Icon name="git-branch" class="muted" /><span class="grow clip">{b.name}</span>
                            <span class="chip plain mono">+{b.ahead} −{b.behind}</span>
                        </a>
                    {/each}
                </div>
            </div>
        {/if}

        {#if data.tags.length}
            <div class="stack">
                <div class="row between"><h3>Tags</h3><a class="small" href={q('/tags')}>All</a></div>
                <div class="row">{#each data.tags as t (t.name)}<a class="chip" href="{base}/tags/{t.name}"><Icon name="tag" size={12} /> {t.name}</a>{/each}</div>
            </div>
        {/if}

        {#if data.activity.length}
            <div class="stack">
                <h3>Activity</h3>
                <div class="stack act">
                    {#each data.activity as a (a.id)}
                        {@const d = describeActivity(a.type, a.data)}
                        <div class="row small" style="flex-wrap: nowrap; align-items: flex-start"><Icon name={d.icon} class="muted" />
                            <div><b>{a.actor ? `*${a.actor.username}` : 'Someone'}</b> {d.text} <span class="muted"><Time date={a.created_at} /></span></div></div>
                    {/each}
                </div>
            </div>
        {/if}
    </aside>
</div>

<style>
    .vitals { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; }
    .n { font-family: var(--font-display); font-weight: 700; font-size: 1.8rem; line-height: 1; color: var(--accent); }
    .pulse { gap: 0.8rem; }
    .steps { margin: 0; padding-left: 1.2rem; }
    .plain { margin: 0; white-space: pre-wrap; font-family: var(--font); }
    .timeline { list-style: none; margin: 0; padding: 0 0 0 0.9rem; border-left: 2px solid var(--line); display: flex; flex-direction: column; gap: 0.7rem; }
    .timeline a { display: flex; flex-direction: column; color: var(--fg); position: relative; min-width: 0; }
    .timeline a::before { content: ''; position: absolute; left: -1.28rem; top: 0.5rem; width: 9px; height: 9px; border-radius: 50%; background: var(--blue); }
    .timeline a:hover { text-decoration: none; color: var(--accent); }
    .act { gap: 0.6rem; }
</style>
