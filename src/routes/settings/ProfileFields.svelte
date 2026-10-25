<script lang="ts">
    import { regionOptions } from '#lib/regions.ts';
    import { BIO_MAX_WORDS, wordCount } from '#lib/util.ts';
    import { api } from '#lib/forms.ts';

    interface Props {
        profile: { username: string; display_name: string; bio: string; timezone: string; region: string | null };
        compact?: boolean;
    }
    let { profile, compact = false }: Props = $props();

    // Initial values only: the form owns the state after mount.
    // svelte-ignore state_referenced_locally
    let username = $state(profile.username);
    // svelte-ignore state_referenced_locally
    let displayName = $state(profile.display_name);
    // svelte-ignore state_referenced_locally
    let bio = $state(profile.bio);
    // svelte-ignore state_referenced_locally
    let tz = $state(profile.timezone);
    // svelte-ignore state_referenced_locally
    let region = $state(profile.region ?? '');
    let preview = $state('');
    let showPreview = $state(false);

    const zones: string[] = (Intl as any).supportedValuesOf?.('timeZone') ?? ['UTC'];
    if (!zones.includes('UTC')) zones.unshift('UTC');
    const regions = regionOptions();
    const words = $derived(wordCount(bio));

    let timer: ReturnType<typeof setTimeout>;
    $effect(() => {
        const text = bio;
        if (!showPreview) return;
        clearTimeout(timer);
        timer = setTimeout(async () => {
            preview = text.trim() ? (await api<{ html: string }>('/api/markdown', { method: 'POST', body: JSON.stringify({ text }) }).catch(() => ({ html: '' }))).html : '';
        }, 250);
        return () => clearTimeout(timer);
    });

    const detect = () => (tz = Intl.DateTimeFormat().resolvedOptions().timeZone);
</script>

<div class="field">
    <label for="username">Username</label>
    <div class="row" style="flex-wrap: nowrap"><span class="muted mono">*</span><input class="input" id="username" name="username" bind:value={username} maxlength="32" autocomplete="off" spellcheck="false" required /></div>
    <span class="hint">Lowercase letters, numbers, “-” and “_”. Your profile lives at /*{username || 'username'}</span>
</div>
<div class="field">
    <label for="display_name">Display name</label>
    <input class="input" id="display_name" name="display_name" bind:value={displayName} maxlength="50" required />
</div>
{#if !compact}
    <div class="field">
        <div class="row between">
            <label for="bio">Bio <span class="muted">(markdown)</span></label>
            <button type="button" class="btn ghost sm" onclick={() => (showPreview = !showPreview)}>{showPreview ? 'Edit' : 'Preview'}</button>
        </div>
        {#if showPreview}
            <div class="card flat md" style="min-height: 6rem">{@html preview || '<span class="muted">Nothing to preview yet.</span>'}</div>
        {/if}
        <textarea class="textarea" id="bio" name="bio" bind:value={bio} rows="5" hidden={showPreview} placeholder="A few words about you…"></textarea>
        <span class="hint" class:err={words > BIO_MAX_WORDS}>{words} / {BIO_MAX_WORDS} words</span>
    </div>
{/if}
<div class="two">
    <div class="field">
        <div class="row between"><label for="timezone">Timezone</label><button type="button" class="btn ghost sm" onclick={detect}>Detect</button></div>
        <select class="select" id="timezone" name="timezone" bind:value={tz}>
            {#each zones as z}<option value={z}>{z.replaceAll('_', ' ')}</option>{/each}
        </select>
    </div>
    <div class="field">
        <label for="region">Region</label>
        <select class="select" id="region" name="region" bind:value={region}>
            <option value="">Not set</option>
            {#each regions as r}<option value={r.code}>{r.name}</option>{/each}
        </select>
    </div>
</div>

<style>
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 560px) { .two { grid-template-columns: 1fr; } }
</style>
