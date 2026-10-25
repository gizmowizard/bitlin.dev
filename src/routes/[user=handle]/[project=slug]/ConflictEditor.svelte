<script lang="ts">
    import Icon from '../../Icon.svelte';
    import { formatBytes } from '#lib/util.ts';

    interface C { path: string; kind: string; ours: { s: number } | null; theirs: { s: number } | null; markers: string | null }
    let { conflicts, oursLabel, theirsLabel, complete = $bindable(false) }: { conflicts: C[]; oursLabel: string; theirsLabel: string; complete?: boolean } = $props();

    // svelte-ignore state_referenced_locally
    let choice = $state<string[]>(conflicts.map(() => ''));
    // svelte-ignore state_referenced_locally
    let text = $state<string[]>(conflicts.map((c) => c.markers ?? ''));
    $effect(() => {
        complete = choice.every((c) => c);
    });

    const kinds: Record<string, string> = {
        content: 'Both sides edited the same lines',
        'both-added': 'Both sides added this file with different content',
        'modify-delete': 'One side edited it, the other deleted it',
        binary: 'Binary file changed on both sides'
    };
</script>

<div class="stack">
    {#each conflicts as c, i (c.path)}
        <fieldset class="card stack">
            <input type="hidden" name="p_{i}" value={c.path} />
            <div class="row"><Icon name="git-merge-conflict" class="danger" /><b class="mono clip grow">{c.path}</b></div>
            <span class="small muted">{kinds[c.kind] ?? c.kind}</span>
            <div class="opts">
                <label class="opt"><input type="radio" name="c_{i}" value="ours" bind:group={choice[i]} /> Keep <b>{oursLabel}</b>{c.ours ? ` (${formatBytes(c.ours.s)})` : ' (deleted)'}</label>
                <label class="opt"><input type="radio" name="c_{i}" value="theirs" bind:group={choice[i]} /> Take <b>{theirsLabel}</b>{c.theirs ? ` (${formatBytes(c.theirs.s)})` : ' (deleted)'}</label>
                {#if c.markers !== null}<label class="opt"><input type="radio" name="c_{i}" value="custom" bind:group={choice[i]} /> Edit by hand</label>{/if}
            </div>
            {#if choice[i] === 'custom'}
                <textarea class="textarea code" name="t_{i}" bind:value={text[i]} rows="14" spellcheck="false" aria-label="Merged contents of {c.path}"></textarea>
                {#if text[i].includes('<<<<<<<') || text[i].includes('>>>>>>>')}<span class="hint">Conflict markers (&lt;&lt;&lt;&lt;&lt;&lt;&lt; … &gt;&gt;&gt;&gt;&gt;&gt;&gt;) are still in the text. Remove them unless you mean to keep them.</span>{/if}
            {/if}
        </fieldset>
    {/each}
</div>

<style>
    fieldset { margin: 0; min-width: 0; }
    .opts { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .opt { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.7rem; border: 1px solid var(--line); border-radius: 8px; cursor: pointer; background: var(--bg); font-size: 0.88rem; }
    .opt:has(input:checked) { border-color: var(--blue); background: var(--surface-2); }
    :global(.danger) { color: var(--danger); }
</style>
