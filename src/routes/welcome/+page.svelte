<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../Meta.svelte';
    import Avatar from '../Avatar.svelte';
    import ProfileFields from '../settings/ProfileFields.svelte';
    import { enhanceForm } from '#lib/forms.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    let busy = $state(false);
</script>

<Meta title="Welcome" noindex />
<div class="page narrow stack">
    <div class="row"><Avatar user={data.profile} size={56} /><div><h1>Welcome to Bitlin</h1><p class="muted">Pick how you appear. You can change all of this later.</p></div></div>
    <form class="card stack" method="POST" use:enhance={enhanceForm({ busy: (b) => (busy = b) })}>
        <ProfileFields profile={data.profile!} compact />
        <button class="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Continue'}</button>
    </form>
</div>
