<script lang="ts">
    import { enhance } from "$app/forms";
    import Meta from "../Meta.svelte";
    import Icon from "../Icon.svelte";
    import { enhanceForm } from "#lib/forms.ts";
    import { PROJECT_RE } from "#lib/util.ts";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();
    let name = $state("");
    let busy = $state(false);
    const valid = $derived(PROJECT_RE.test(name));
</script>

<Meta title="New project" noindex />
<div class="page narrow stack">
    <h1>new project</h1>
    <form
        class="card stack"
        method="POST"
        use:enhance={enhanceForm({ busy: (b) => (busy = b) })}
    >
        <div class="field">
            <label for="name">Project name</label>
            <input
                class="input"
                id="name"
                name="name"
                bind:value={name}
                maxlength="64"
                autocomplete="off"
                spellcheck="false"
                required
            />
            {#if name && !valid}<span class="err"
                    >allowed letters, numbers, “.”, “-” and “_”.</span
                >{/if}
        </div>
        <div class="field">
            <label for="description"
                >about <span class="muted">(optional.)</span></label
            >
            <input
                class="input"
                id="description"
                name="description"
                maxlength="300"
            />
        </div>
        <fieldset class="vis">
            <legend class="label">visibility</legend>
            <label class="opt"
                ><input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked
                /><span
                    ><Icon name="globe" /> <b>public</b><small class="muted"
                        >Anyone can view, even without an account.</small
                    ></span
                ></label
            >
            <label class="opt"
                ><input type="radio" name="visibility" value="private" /><span
                    ><Icon name="lock" /> <b>private</b><small class="muted"
                        >Only you and collaborators.</small
                    ></span
                ></label
            >
        </fieldset>
        <fieldset class="vis">
            <legend class="label">Ignore rules to start with</legend>
            <div class="row">
                {#each data.templates as t}<label class="chip"
                        ><input type="checkbox" name="templates" value={t} />
                        {t}</label
                    >{/each}
            </div>
            <span class="hint"
                >Files matching these patterns are skipped when you upload. Edit
                them any time.</span
            >
        </fieldset>
        <button
            class="btn primary"
            style="align-self: flex-start"
            disabled={busy || !valid}
            >{busy ? "…" : "Create!"}</button
        >
    </form>
</div>

<style>
    fieldset {
        border: 0;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-width: 0;
    }
    .opt {
        display: flex;
        gap: 0.7rem;
        align-items: flex-start;
        padding: 0.7rem 0.8rem;
        border: 1px solid var(--line);
        border-radius: 3px;
        cursor: pointer;
        background: var(--bg);
    }
    .opt:has(input:checked) {
        border-color: var(--blue);
        background: var(--surface-2);
    }
    .opt span {
        display: flex;
        flex-wrap: wrap;
        gap: 0.2rem 0.5rem;
        align-items: center;
    }
    .opt small {
        flex-basis: 100%;
    }
    .chip {
        cursor: pointer;
    }
    .chip:has(input:checked) {
        background: var(--blue);
        color: #fff;
    }
    .chip input {
        display: none;
    }
</style>
