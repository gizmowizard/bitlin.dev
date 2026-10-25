<script lang="ts">
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import Avatar from '../../../Avatar.svelte';
    import Time from '../../../Time.svelte';
    import RefPicker from '../RefPicker.svelte';
    import { projectHref, shortId, withRef } from '#lib/util.ts';
    import { toast } from '#lib/toast.svelte.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    const refQ = $derived(withRef('', data.ref.name, p.default_branch));
    const pageHref = (n: number) => `${base}/snapshots?${new URLSearchParams({ ...(refQ ? { ref: data.ref.name } : {}), page: String(n) })}`;

    const groups = $derived.by(() => {
        const out: { day: string; items: typeof data.snapshots }[] = [];
        for (const s of data.snapshots) {
            const day = new Date(s.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
            if (out.at(-1)?.day === day) out.at(-1)!.items.push(s);
            else out.push({ day, items: [s] });
        }
        return out;
    });
    const copy = async (id: string) => {
        await navigator.clipboard?.writeText(id);
        toast('Snapshot id copied', 'success');
    };
</script>

<Meta title="History · {p.owner.username}/{p.name}" description="Snapshot history of *{p.owner.username}/{p.name} on {data.ref.name}." />

<div class="row between"><div class="row"><h2>History</h2><RefPicker branches={data.branches} current={data.ref.name} kind={data.ref.kind} defaultBranch={p.default_branch} /></div>
    <span class="small muted">{data.historyDepth} snapshot{data.historyDepth === 1 ? '' : 's'} on this line</span></div>

{#each groups as g (g.day)}
    <div class="stack" style="gap: 0.5rem">
        <div class="day small muted">{g.day}</div>
        <ol class="spine">
            {#each g.items as s (s.id)}
                <li>
                    <a class="msg" href="{base}/snapshots/{s.id}{refQ}">{s.message.split('\n')[0]}</a>
                    <div class="row small muted">
                        <Avatar user={s.author ?? { username: s.author_name }} size={18} />
                        <span>*{s.author?.username ?? s.author_name}</span><span>·</span><Time date={s.created_at} />
                        {#if s.parents.length > 1}<span class="chip"><Icon name="git-merge" size={12} /> merge</span>{/if}
                        {#each data.labels[s.id]?.branches ?? [] as b}<span class="chip solid"><Icon name="git-branch" size={12} /> {b}</span>{/each}
                        {#each data.labels[s.id]?.tags ?? [] as t}<a class="chip" href="{base}/tags/{t}"><Icon name="tag" size={12} /> {t}</a>{/each}
                        <span class="grow"></span>
                        <button class="chip plain mono" title="Copy full id" onclick={() => copy(s.id)}>{shortId(s.id)}</button>
                        <a class="btn ghost sm" href="{base}/files/?ref={s.id.slice(0, 12)}" title="Browse files at this snapshot"><Icon name="folder-open" size={14} /></a>
                    </div>
                </li>
            {/each}
        </ol>
    </div>
{:else}
    <div class="empty"><h3>No snapshots yet</h3><p>Save your first snapshot from the Changes tab.</p></div>
{/each}

<div class="row between">
    {#if data.page > 1}<a class="btn" href={pageHref(data.page - 1)}><Icon name="arrow-left" /> Newer</a>{:else}<span></span>{/if}
    {#if data.more}<a class="btn" href={pageHref(data.page + 1)}>Older <Icon name="arrow-right" /></a>{/if}
</div>

<style>
    .day { text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.72rem; }
    .spine { list-style: none; margin: 0; padding: 0 0 0 1.1rem; border-left: 2px solid var(--line); display: flex; flex-direction: column; gap: 0.3rem; }
    .spine li { position: relative; padding: 0.55rem 0.8rem; border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg); }
    .spine li::before { content: ''; position: absolute; left: -1.62rem; top: 1.05rem; width: 10px; height: 10px; border-radius: 50%; background: var(--blue); border: 2px solid var(--bg); }
    .spine li:hover { background: var(--surface); }
    .msg { color: var(--fg); font-weight: 400; display: block; overflow-wrap: anywhere; }
</style>
