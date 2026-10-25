<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../Meta.svelte';
    import Brand from '../../Brand.svelte';
    import { enhanceForm } from '#lib/forms.ts';
    import type { PageProps } from './$types';

    let { data, }: PageProps = $props();
    const linked = $derived(new Set(data.identities.map((i) => i.provider)));
    let confirm = $state('');
</script>

<Meta title="Sign-in accounts" noindex />
<h1>Sign-in accounts</h1>
<p class="muted">Link several providers to the same Bitlin account so you can sign in any way you like.</p>
<div class="list">
    {#each data.providers as p}
        {@const identity = data.identities.find((i) => i.provider === p.id)}
        <div class="item">
            <Brand name={p.id as 'github' | 'google' | 'discord'} size={20} />
            <div class="grow"><b>{p.label}</b>{#if identity}<div class="small muted">{identity.login}</div>{/if}</div>
            {#if identity}
                <form method="POST" action="?/unlink" use:enhance={enhanceForm({ success: 'Account unlinked' })}>
                    <input type="hidden" name="provider" value={p.id} />
                    <button class="btn sm" disabled={linked.size < 2}>Unlink</button>
                </form>
            {:else}
                <a class="btn sm" href="/auth/{p.id}?link=1" data-sveltekit-reload>Link</a>
            {/if}
        </div>
    {/each}
</div>

<h2>Delete account</h2>
<form class="card stack" method="POST" action="?/delete" use:enhance={enhanceForm()}>
    <p class="small">This permanently removes your profile and every project you own. This cannot be undone.</p>
    <div class="field"><label for="c">Type your username to confirm</label><input class="input" id="c" name="confirm" bind:value={confirm} autocomplete="off" /></div>
    <button class="btn danger" disabled={!confirm}>Delete my account</button>
</form>
