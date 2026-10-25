<script lang="ts">
    import { toasts, dismiss } from "#lib/toast.svelte.ts";
    import Icon from "./Icon.svelte";
</script>

<div class="toasts" role="status" aria-live="polite">
    {#each toasts as t (t.id)}
        <div class="toast {t.kind}">
            <Icon
                name={t.kind === "error"
                    ? "circle-alert"
                    : t.kind === "success"
                      ? "check"
                      : "info"}
            />
            {#if t.href}<a href={t.href} onclick={() => dismiss(t.id)}
                    >{t.text}</a
                >{:else}<span>{t.text}</span>{/if}
            <button aria-label="Dismiss" onclick={() => dismiss(t.id)}
                ><Icon name="x" size={14} /></button
            >
        </div>
    {/each}
</div>

<style>
    .toasts {
        position: fixed;
        right: 1rem;
        bottom: 1rem;
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-width: min(92vw, 380px);
    }
    .toast {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.7rem 0.8rem;
        border-radius: 3px;
        border: 1px solid var(--edge);
        box-shadow: var(--raised);
        background: var(--fg);
        color: var(--bg);
        font-size: 0.88rem;
        animation: in 0.18s ease-out;
    }
    .toast.error {
        background: var(--red);
        color: #fff;
    }
    .toast.success {
        background: var(--blue);
        color: #fff;
    }
    .toast :global(svg) {
        flex: none;
        margin-top: 0.2rem;
    }
    .toast a,
    .toast span {
        flex: 1;
        color: inherit;
        overflow-wrap: anywhere;
    }
    .toast button {
        all: unset;
        cursor: pointer;
        opacity: 0.7;
        padding: 0.15rem;
    }
    .toast button:hover,
    .toast button:focus-visible {
        opacity: 1;
    }
    /* `all: unset` above strips the focus ring, so put one back. */
    .toast button:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
        border-radius: 4px;
    }
    @keyframes in {
        from {
            transform: translateY(8px);
            opacity: 0;
        }
    }
</style>
