<script lang="ts">
    import { clock } from "#lib/clock.svelte.ts";
    import { timeAgo } from "#lib/util.ts";

    let { date }: { date: Date | string } = $props();
    const d = $derived(new Date(date));
</script>

<time datetime={d.toISOString()} title={d.toLocaleString()}
    >{timeAgo(d, clock.now)}</time
>
