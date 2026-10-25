<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import Icon from "../../Icon.svelte";
    import { withRef } from "#lib/util.ts";

    interface Props {
        branches: { name: string; tracking: string | null }[];
        tags?: string[];
        current: string;
        kind: string;
        defaultBranch: string;
        /** Query param to write; defaults to `ref`. */
        param?: string;
        label?: string;
    }
    let {
        branches,
        tags = [],
        current,
        kind,
        defaultBranch,
        param = "ref",
        label,
    }: Props = $props();
    let el: HTMLDetailsElement | undefined = $state();
    let filter = $state("");

    const own = $derived(
        branches.filter((b) => !b.tracking && b.name.includes(filter)),
    );
    const remote = $derived(
        branches.filter((b) => b.tracking && b.name.includes(filter)),
    );
    const tagList = $derived(tags.filter((t) => t.includes(filter)));

    function pick(name: string) {
        const u = new URL(page.url.href);
        if (name === defaultBranch && param === "ref")
            u.searchParams.delete(param);
        else u.searchParams.set(param, name);
        if (el) el.open = false;
        filter = "";
        void goto(u);
    }

    function onWindowClick(e: MouseEvent) {
        if (el?.open && !el.contains(e.target as Node)) el.open = false;
    }
    function onWindowKey(e: KeyboardEvent) {
        if (e.key === "Escape" && el?.open) {
            el.open = false;
            el.querySelector("summary")?.focus();
        }
    }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKey} />

<details bind:this={el} class="picker">
    <summary class="btn sm">
        <Icon
            name={kind === "tag"
                ? "tag"
                : kind === "snapshot"
                  ? "git-commit-horizontal"
                  : "git-branch"}
            size={14}
        />
        {#if label}<span class="muted">{label}</span>{/if}<span
            class="clip name">{current}</span
        ><Icon name="chevron-down" size={14} />
    </summary>
    <div class="pop glass">
        <input
            class="input"
            placeholder="Filter…"
            bind:value={filter}
            aria-label="Filter refs"
        />
        <div class="scroll">
            {#each own as b (b.name)}<button
                    class:on={b.name === current}
                    onclick={() => pick(b.name)}
                    ><Icon name="git-branch" size={14} /> {b.name}</button
                >{/each}
            {#if remote.length}<div class="hd">Remote</div>
                {#each remote as b (b.name)}<button
                        class:on={b.name === current}
                        onclick={() => pick(b.name)}
                        ><Icon name="cloud-download" size={14} />
                        {b.name}</button
                    >{/each}{/if}
            {#if tagList.length}<div class="hd">Tags</div>
                {#each tagList as t (t)}<button
                        class:on={t === current}
                        onclick={() => pick(t)}
                        ><Icon name="tag" size={14} /> {t}</button
                    >{/each}{/if}
            {#if !own.length && !remote.length && !tagList.length}<div
                    class="hd"
                >
                    Nothing matches
                </div>{/if}
        </div>
    </div>
</details>

<style>
    .picker {
        position: relative;
    }
    summary {
        list-style: none;
        cursor: pointer;
        max-width: 260px;
    }
    summary::-webkit-details-marker {
        display: none;
    }
    .name {
        max-width: 150px;
        font-weight: 500;
    }
    .pop {
        position: absolute;
        z-index: 30;
        top: calc(100% + 0.4rem);
        left: 0;
        width: 280px;
        max-width: 86vw;
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .scroll {
        max-height: 260px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }
    .scroll button {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.55rem;
        border: 0;
        background: none;
        font: inherit;
        font-weight: 400;
        color: var(--fg);
        text-align: left;
        border-radius: 2px;
        cursor: pointer;
        overflow-wrap: anywhere;
    }
    .scroll button:hover {
        background: var(--bar);
        color: var(--on-bar);
    }
    .scroll button.on {
        color: var(--accent);
        font-weight: 500;
    }
    .scroll button.on:hover {
        color: var(--on-bar);
    }
    .hd {
        font-family: var(--font-ui);
        font-weight: 700;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted);
        padding: 0.5rem 0.55rem 0.2rem;
    }
</style>
