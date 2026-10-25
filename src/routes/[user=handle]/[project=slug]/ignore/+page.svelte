<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import { can } from '#lib/access.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import { makeMatcher } from '#lib/ignore.ts';
    import { IGNORE_TEMPLATES } from '#lib/ignore-templates.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const writer = $derived(can(data.role, 'write'));
    // svelte-ignore state_referenced_locally
    let rules = $state(data.rules);
    let testPath = $state('');
    $effect(() => {
        rules = data.rules;
    });
    const matcher = $derived(makeMatcher(rules));
    const verdict = $derived(testPath.trim() ? matcher(testPath.trim().replace(/^\/+/, '')) : null);
    const dirty = $derived(rules !== data.rules);
    const addTemplate = (t: string) => (rules = `${rules.trimEnd()}${rules.trim() ? '\n\n' : ''}# ${t}\n${IGNORE_TEMPLATES[t]}`);
</script>

<Meta title="Ignore rules · {p.owner.username}/{p.name}" description="Files *{p.owner.username}/{p.name} deliberately doesn't track." />

<div class="two-col">
    <form class="stack" method="POST" action="?/save" use:enhance={enhanceForm({ success: 'Ignore rules saved' })}>
        <div class="row between"><h2>Ignore rules</h2>{#if writer}<button class="btn primary sm" disabled={!dirty}><Icon name="save" size={14} /> Save</button>{/if}</div>
        <p class="muted small">One pattern per line. <span class="kbd">#</span> starts a comment, <span class="kbd">*</span> matches within a folder, <span class="kbd">**</span> across folders, a trailing <span class="kbd">/</span> means folders only, and <span class="kbd">!</span> re-includes. Matching files are skipped on upload.</p>
        <textarea class="textarea code" name="rules" bind:value={rules} rows="18" readonly={!writer} spellcheck="false" aria-label="Ignore rules"></textarea>
        {#if writer}<div class="row">{#each Object.keys(IGNORE_TEMPLATES) as t}<button type="button" class="chip" onclick={() => addTemplate(t)}><Icon name="plus" size={12} /> {t}</button>{/each}</div>{/if}
    </form>

    <aside class="stack">
        <div class="card stack">
            <b>Test a path</b>
            <input class="input mono" bind:value={testPath} placeholder="node_modules/react/index.js" aria-label="Path to test" />
            {#if verdict !== null}<span class="chip {verdict ? 'red' : 'solid'}" style="align-self: flex-start">{verdict ? 'Ignored' : 'Tracked'}</span>{/if}
            <span class="hint">Always ignored: .git/, .bitlin/, .DS_Store, Thumbs.db</span>
        </div>
        {#if data.trackedButIgnored.length}
            <div class="card stack"><b>Already tracked</b><span class="small muted">These match a rule but are in the current snapshot. Ignore rules only affect new uploads.</span>
                {#each data.trackedButIgnored as f}<code class="small clip">{f}</code>{/each}</div>
        {/if}
    </aside>
</div>
