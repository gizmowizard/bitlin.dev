<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import { can } from '#lib/access.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const owner = $derived(can(data.role, 'owner'));
    let confirm = $state('');
</script>

<Meta title="Settings · {p.owner.username}/{p.name}" noindex />
<div class="stack narrow" style="max-width: 680px">
    <form class="card stack" method="POST" action="?/save" use:enhance={enhanceForm({ success: 'Settings saved' })}>
        <h3>General</h3>
        <div class="field"><label for="d">Description</label><input class="input" id="d" name="description" value={p.description} maxlength="300" /></div>
        <div class="field"><label for="v">Visibility</label>
            <select class="select" id="v" name="visibility"><option value="public" selected={p.visibility === 'public'}>Public: anyone can view</option><option value="private" selected={p.visibility === 'private'}>Private: collaborators only</option></select></div>
        <button class="btn primary" style="align-self: flex-start">Save</button>
    </form>

    {#if owner}
        <form class="card stack" method="POST" action="?/rename" use:enhance={enhanceForm()}>
            <h3>Rename</h3>
            <p class="small muted">Links to the old name will stop working.</p>
            <div class="row"><input class="input grow" name="name" value={p.name} required /><button class="btn">Rename</button></div>
        </form>

        <form class="card stack danger-zone" method="POST" action="?/delete" use:enhance={enhanceForm()}>
            <h3>Delete project</h3>
            <p class="small">This permanently deletes every snapshot, branch, tag and proposal. Type <b>{p.name}</b> to confirm.</p>
            <div class="row"><input class="input grow" name="confirm" bind:value={confirm} autocomplete="off" /><button class="btn danger" disabled={confirm !== p.name}><Icon name="trash-2" size={14} /> Delete</button></div>
        </form>
    {/if}
</div>

<style>
    .danger-zone > h3:first-child { background: var(--red); }
    .danger-zone { border-color: color-mix(in srgb, var(--red) 45%, var(--bg)); background: var(--bg); }
</style>
