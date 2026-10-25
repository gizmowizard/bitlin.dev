<script lang="ts">
    interface Props {
        user: { username: string; display_name?: string; avatar_url?: string | null } | null;
        size?: number;
    }
    let { user, size = 28 }: Props = $props();
    const initial = $derived((user?.display_name || user?.username || '?').trim().charAt(0).toUpperCase());
</script>

{#if user?.avatar_url}
    <img class="av" src={user.avatar_url} alt="" width={size} height={size} loading="lazy" referrerpolicy="no-referrer" style:width="{size}px" style:height="{size}px" />
{:else}
    <span class="av ph" style:width="{size}px" style:height="{size}px" style:font-size="{size * 0.45}px">{initial}</span>
{/if}

<style>
    .av { border-radius: 22%; flex: none; display: inline-block; object-fit: cover; background: var(--surface-2); }
    .ph { display: inline-flex; align-items: center; justify-content: center; background: var(--blue); color: #fff; font-weight: 500; }
</style>
