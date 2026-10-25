<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../Meta.svelte';
    import Icon from '../../Icon.svelte';
    import Time from '../../Time.svelte';
    import { enhanceForm } from '#lib/forms.ts';
    import { toast } from '#lib/toast.svelte.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    let fresh = $state<string | null>(null);
    const copy = async (t: string) => {
        await navigator.clipboard?.writeText(t);
        toast('Copied', 'success');
    };
</script>

<Meta title="Access tokens" noindex />
<h1>Access tokens</h1>
<p class="muted">Tokens let another Bitlin server push to your projects (see a project’s Remotes tab). Treat them like passwords.</p>

<form class="card stack" method="POST" action="?/create" use:enhance={enhanceForm({ reset: true, after: (d) => (fresh = d?.token ?? null) })}>
    <div class="field"><label for="name">Token name</label><input class="input" id="name" name="name" maxlength="60" placeholder="Laptop, CI server…" required /></div>
    <label class="row small"><input type="checkbox" name="write" checked /> Allow pushing (write access)</label>
    <button class="btn primary" style="align-self: flex-start"><Icon name="plus" /> Create token</button>
</form>

{#if fresh}
    <div class="card stack">
        <b>Copy your new token now. It won’t be shown again.</b>
        <div class="row"><code class="grow clip">{fresh}</code><button class="btn sm" onclick={() => copy(fresh!)}><Icon name="copy" /> Copy</button></div>
    </div>
{/if}

{#if data.tokens.length}
    <div class="list">
        {#each data.tokens as t (t.id)}
            <div class="item">
                <Icon name="key-round" />
                <div class="grow"><b>{t.name}</b> <span class="chip plain">{t.can_write ? 'read + write' : 'read only'}</span>
                    <div class="small muted mono">{t.prefix}… · created <Time date={t.created_at} />{#if t.last_used_at} · used <Time date={t.last_used_at} />{/if}</div></div>
                <form method="POST" action="?/revoke" use:enhance={enhanceForm({ success: 'Token revoked' })}><input type="hidden" name="id" value={t.id} /><button class="btn danger sm">Revoke</button></form>
            </div>
        {/each}
    </div>
{/if}
