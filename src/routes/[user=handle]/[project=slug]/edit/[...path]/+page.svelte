<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../../Meta.svelte';
    import Icon from '../../../../Icon.svelte';
    import { enhanceForm } from '#lib/forms.ts';
    import { projectHref, withRef } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const base = $derived(projectHref(p.owner.username, p.name));
    // svelte-ignore state_referenced_locally
    let path = $state(data.path);
    // svelte-ignore state_referenced_locally
    let content = $state(data.content);
    let busy = $state(false);

    // Tab inserts spaces instead of leaving the field.
    function onKey(e: KeyboardEvent) {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        const el = e.currentTarget as HTMLTextAreaElement;
        const { selectionStart: s, selectionEnd: en } = el;
        content = `${content.slice(0, s)}    ${content.slice(en)}`;
        queueMicrotask(() => el.setSelectionRange(s + 4, s + 4));
    }
</script>

<Meta title="Edit · {p.owner.username}/{p.name}" noindex />
<form class="stack" method="POST" use:enhance={enhanceForm({ busy: (b) => (busy = b) })}>
    <input type="hidden" name="original" value={data.isNew ? '' : data.path} />
    <div class="row between">
        <h2>{data.isNew ? 'New file' : 'Edit file'}</h2>
        <div class="row">
            <a class="btn" href="{base}/changes{withRef('', data.ref.name, p.default_branch)}">Cancel</a>
            <button class="btn primary" disabled={busy || !path}><Icon name="check" /> Stage change</button>
        </div>
    </div>
    <div class="field"><label for="path">Path</label><input class="input mono" id="path" name="path" bind:value={path} placeholder="folder/file.txt" autocomplete="off" spellcheck="false" required /></div>
    <textarea class="textarea code" name="content" bind:value={content} onkeydown={onKey} rows="26" spellcheck="false" aria-label="File contents"></textarea>
    <p class="hint">Changes are staged first. Review them on the Changes tab, then save a snapshot.</p>
</form>
