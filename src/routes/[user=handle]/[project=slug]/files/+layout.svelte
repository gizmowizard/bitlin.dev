<script lang="ts">
    import { page } from '$app/state';
    import Icon from '../../../Icon.svelte';
    import RefPicker from '../RefPicker.svelte';
    import { fileIcon } from '../../../fileicon.ts';
    import { projectHref, withRef } from '#lib/util.ts';
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    const current = $derived(page.params.path ?? '');

    interface Row { path: string; name: string; depth: number; dir: boolean }
    let collapsed = $state(new Set<string>());
    let showTree = $state(false);

    // Flatten the path list into visible rows, skipping children of collapsed folders.
    const rows = $derived.by(() => {
        const out: Row[] = [];
        const seen = new Set<string>();
        for (const path of data.paths) {
            const parts = path.split('/');
            for (let i = 0; i < parts.length; i++) {
                const sub = parts.slice(0, i + 1).join('/');
                const dir = i < parts.length - 1;
                if (dir && !seen.has(sub)) {
                    seen.add(sub);
                    out.push({ path: sub, name: parts[i], depth: i, dir: true });
                }
                if (dir && collapsed.has(sub)) break;
                if (!dir) out.push({ path, name: parts[i], depth: i, dir: false });
            }
        }
        return out;
    });

    const toggle = (path: string) => {
        const next = new Set(collapsed);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        collapsed = next;
    };
    const href = (path: string) => withRef(`${base}/files/${path}`, data.ref.name, p.default_branch);
</script>

<div class="explorer">
    <aside class:open={showTree}>
        <div class="row between" style="margin-bottom: 0.5rem">
            <RefPicker branches={data.branches} tags={[]} current={data.ref.name} kind={data.ref.kind} defaultBranch={p.default_branch} />
        </div>
        <div class="tree">
            {#each rows as r (r.path + (r.dir ? '/' : ''))}
                {#if r.dir}
                    <button class="node" style:padding-left="{r.depth * 14 + 6}px" onclick={() => toggle(r.path)}>
                        <Icon name={collapsed.has(r.path) ? 'folder' : 'folder-open'} size={14} /><span class="clip">{r.name}</span>
                    </button>
                {:else}
                    <a class="node" class:on={r.path === current} style:padding-left="{r.depth * 14 + 6}px" href={href(r.path)}>
                        <Icon name={fileIcon(r.path)} size={14} /><span class="clip">{r.name}</span>
                    </a>
                {/if}
            {:else}
                <p class="muted small" style="padding: 0.5rem">No files in this version.</p>
            {/each}
        </div>
    </aside>
    <section class="main">
        <button class="btn sm toggle" onclick={() => (showTree = !showTree)}><Icon name="folder-open" size={14} /> {showTree ? 'Hide' : 'Show'} file tree</button>
        {@render children()}
    </section>
</div>

<style>
    .explorer { display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: 1.25rem; align-items: start; }
    aside { position: sticky; top: 4.2rem; max-height: calc(100dvh - 5rem); display: flex; flex-direction: column; }
    .tree { overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius); padding: 0.3rem; background: var(--bg); }
    .node { display: flex; align-items: center; gap: 0.4rem; width: 100%; border: 0; background: none; font: inherit; font-size: 0.875rem; font-weight: 400; color: var(--fg); padding: 0.28rem 0.4rem; border-radius: 6px; cursor: pointer; text-align: left; }
    .node:hover { background: var(--item-hover); text-decoration: none; }
    .node.on { background: var(--blue); color: #fff; }
    .main { min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
    .toggle { display: none; align-self: flex-start; }
    @media (max-width: 820px) {
        .explorer { grid-template-columns: 1fr; }
        aside { display: none; position: static; max-height: 60dvh; }
        aside.open { display: flex; }
        .toggle { display: inline-flex; }
    }
</style>
