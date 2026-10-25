<script lang="ts">
    import { page } from '$app/state';
    import Meta from './Meta.svelte';
</script>

<Meta title={String(page.status)} noindex />
<div class="page narrow" style="text-align: center; padding-top: 5rem">
    <img src="/bitlin.png" alt="" width="72" height="72" style="border-radius: 22%" />
    <h1 style="font-size: 4rem; color: var(--accent); margin-top: 1rem">{page.status}</h1>
    <p class="muted" style="margin: 0.6rem 0 1.5rem">{page.error?.message}</p>
    <a class="btn primary" href="/">Back to Bitlin</a>
</div>
