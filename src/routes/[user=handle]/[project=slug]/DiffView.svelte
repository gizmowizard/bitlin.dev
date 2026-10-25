<script lang="ts">
    import Icon from '../../Icon.svelte';
    import { formatBytes } from '#lib/util.ts';
    import type { DiffLine, FileDiff } from '#lib/types.ts';

    interface Props {
        files: FileDiff[];
        /** Optional per-file extras (e.g. a Discard button) rendered in the header. */
        actions?: import('svelte').Snippet<[FileDiff]>;
    }
    let { files, actions }: Props = $props();

    let split = $state(false);
    const total = $derived(files.reduce((a, f) => ({ add: a.add + f.additions, del: a.del + f.deletions }), { add: 0, del: 0 }));

    type Row = { l: DiffLine | null; r: DiffLine | null; meta?: string };

    // Pair runs of removals with the additions that follow them for side-by-side display.
    function toRows(lines: DiffLine[]): Row[] {
        const rows: Row[] = [];
        let dels: DiffLine[] = [];
        let adds: DiffLine[] = [];
        const flush = () => {
            for (let i = 0; i < Math.max(dels.length, adds.length); i++) rows.push({ l: dels[i] ?? null, r: adds[i] ?? null });
            dels = [];
            adds = [];
        };
        for (const ln of lines) {
            if (ln.k === 'd') dels.push(ln);
            else if (ln.k === 'a') adds.push(ln);
            else {
                flush();
                if (ln.k === 'm') rows.push({ l: null, r: null, meta: ln.t });
                else rows.push({ l: ln, r: ln });
            }
        }
        flush();
        return rows;
    }

    const label = { added: 'Added', removed: 'Removed', modified: 'Modified', renamed: 'Renamed' } as const;
</script>

<div class="stack">
    <div class="row between">
        <span class="small muted">{files.length} file{files.length === 1 ? '' : 's'} changed · <b class="plus">+{total.add}</b> <b class="minus">−{total.del}</b></span>
        <div class="row" style="gap: 0.25rem">
            <button class="btn sm" class:primary={!split} onclick={() => (split = false)} aria-label="Unified view"><Icon name="rows-2" size={14} /></button>
            <button class="btn sm" class:primary={split} onclick={() => (split = true)} aria-label="Split view"><Icon name="columns-2" size={14} /></button>
        </div>
    </div>

    {#each files as f (f.path)}
        <details class="file" open={files.length < 12}>
            <summary>
                <Icon name="chevron-right" size={14} class="chev" />
                <span class="chip {f.status === 'removed' ? 'red' : f.status === 'added' ? 'solid' : ''}">{label[f.status]}</span>
                <span class="grow clip mono">{f.from ? `${f.from} → ` : ''}{f.path}</span>
                {#if !f.binary && !f.skipped}<span class="small mono"><span class="plus">+{f.additions}</span> <span class="minus">−{f.deletions}</span></span>{/if}
                {#if actions}<span role="presentation" onclick={(e) => e.stopPropagation()}>{@render actions(f)}</span>{/if}
            </summary>
            {#if f.binary}
                <p class="note muted">Binary file · {f.oldSize !== null ? formatBytes(f.oldSize) : '—'} → {f.newSize !== null ? formatBytes(f.newSize) : '—'}</p>
            {:else if f.skipped}
                <p class="note muted">Too large to show inline ({formatBytes(Math.max(f.oldSize ?? 0, f.newSize ?? 0))}).</p>
            {:else if !f.hunks.length}
                <p class="note muted">{f.status === 'renamed' ? 'Renamed without content changes.' : 'No visible changes (empty file or whitespace only).'}</p>
            {:else}
                <div class="scroll">
                    {#each f.hunks as h, hi (hi)}
                        <div class="hh">{h.header}</div>
                        {#if split}
                            <table class="split">
                                <tbody>
                                    {#each toRows(h.lines) as r, ri (ri)}
                                        {#if r.meta}
                                            <tr><td colspan="4" class="meta">{r.meta}</td></tr>
                                        {:else}
                                            <tr>
                                                <td class="num">{r.l?.o ?? ''}</td>
                                                <td class="code {r.l?.k === 'd' ? 'd' : ''}">{r.l?.t ?? ''}</td>
                                                <td class="num">{r.r?.n ?? ''}</td>
                                                <td class="code {r.r?.k === 'a' ? 'a' : ''}">{r.r?.t ?? ''}</td>
                                            </tr>
                                        {/if}
                                    {/each}
                                </tbody>
                            </table>
                        {:else}
                            <table>
                                <tbody>
                                    {#each h.lines as ln, li (li)}
                                        {#if ln.k === 'm'}
                                            <tr><td colspan="3" class="meta">{ln.t}</td></tr>
                                        {:else}
                                            <tr class={ln.k}>
                                                <td class="num">{ln.o ?? ''}</td>
                                                <td class="num">{ln.n ?? ''}</td>
                                                <td class="code"><span class="sign">{ln.k === 'a' ? '+' : ln.k === 'd' ? '−' : ' '}</span>{ln.t}</td>
                                            </tr>
                                        {/if}
                                    {/each}
                                </tbody>
                            </table>
                        {/if}
                    {/each}
                </div>
            {/if}
        </details>
    {:else}
        <div class="empty"><p>No differences.</p></div>
    {/each}
</div>

<style>
    .plus { color: var(--accent); }
    .minus { color: var(--danger); }
    .file { border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg); overflow: hidden; }
    summary { display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 0.8rem; background: var(--surface); cursor: pointer; list-style: none; flex-wrap: wrap; }
    summary::-webkit-details-marker { display: none; }
    details[open] > summary :global(.chev) { transform: rotate(90deg); }
    summary :global(.chev) { transition: transform 0.12s; flex: none; }
    .note { padding: 0.8rem 1rem; margin: 0; font-size: 0.88rem; }
    .scroll { overflow-x: auto; }
    .hh { padding: 0.25rem 0.8rem; background: var(--surface-2); color: var(--muted); font-family: var(--mono); font-size: 0.75rem; }
    table { border-collapse: collapse; width: 100%; font-family: var(--mono); font-size: 0.8rem; line-height: 1.5; }
    .split { table-layout: fixed; }
    td { padding: 0 0.5rem; vertical-align: top; }
    .num { width: 3.2rem; min-width: 3.2rem; text-align: right; color: var(--muted); user-select: none; border-right: 1px solid var(--line); font-size: 0.72rem; }
    .code { white-space: pre-wrap; overflow-wrap: anywhere; }
    .sign { display: inline-block; width: 1.2ch; color: var(--muted); user-select: none; }
    tr.a, td.a { background: var(--add-bg); }
    tr.d, td.d { background: var(--del-bg); }
    tr.a .num { background: var(--add-strong); color: var(--fg); }
    tr.d .num { background: var(--del-strong); color: var(--fg); }
    .meta { color: var(--muted); font-style: italic; padding-left: 1rem; }
</style>
