<script lang="ts">
    import { page } from "$app/state";
    import Avatar from "./Avatar.svelte";
    import Icon from "./Icon.svelte";
    import { ws } from "#lib/ws.svelte.ts";
    import { userHref } from "#lib/util.ts";

    let {
        user,
    }: {
        user: {
            username: string;
            display_name: string;
            avatar_url: string | null;
        } | null;
    } = $props();
    let menu: HTMLDetailsElement | undefined = $state();
    $effect(() => {
        page.url.pathname;
        if (menu) menu.open = false;
    });
</script>

<header>
    <div class="bar">
        <a
            class="brand"
            href={user ? "/dashboard" : "/"}
            aria-label="Bitlin home"
        >
            <img src="/bitlin.png" alt="" width="28" height="28" />
            <span>Bitlin</span>
        </a>
        <a class="navlink" href="/explore"
            ><Icon name="compass" /> <span class="hide-sm">explore</span></a
        >
        <span class="grow"></span>
        {#if user}
            <a class="btn sm primary" href="/new"
                ><Icon name="plus" size={15} />
                <span class="hide-sm">New</span></a
            >
            <details bind:this={menu}>
                <summary aria-label="Account menu"
                    ><Avatar {user} size={30} /></summary
                >
                <div class="menu">
                    <a href={userHref(user.username)}
                        ><Icon name="user" /> *{user.username}</a
                    >
                    <a href="/dashboard"><Icon name="house" /> Dashboard</a>
                    <a href="/settings"><Icon name="settings" /> Settings</a>
                    <form method="POST" action="/auth/logout">
                        <button><Icon name="log-out" /> Sign out</button>
                    </form>
                </div>
            </details>
        {:else}
            <a class="btn sm primary" href="/#signin">Sign in</a>
        {/if}
    </div>
</header>

<style>
    header {
        border-bottom: 1px solid var(--line);
        background: var(--bg);
        position: sticky;
        top: 0;
        z-index: 20;
    }
    .bar {
        max-width: 1120px;
        margin: 0 auto;
        padding: 0.6rem 1rem;
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    .brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--fg);
        font-family: var(--font-display);
        font-size: 1.6rem;
        line-height: 1;
    }
    .brand img {
        border-radius: 22%;
    }
    .brand:hover {
        text-decoration: none;
    }
    .navlink {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--muted);
        font-weight: 400;
    }
    .navlink:hover {
        color: var(--fg);
        text-decoration: none;
    }
    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--red);
        transition: background 0.3s;
    }
    .dot.on {
        background: var(--blue);
    }
    details {
        position: relative;
    }
    summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        border-radius: 8px;
    }
    summary::-webkit-details-marker {
        display: none;
    }
    .menu {
        position: absolute;
        right: 0;
        top: calc(100% + 0.5rem);
        min-width: 200px;
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 0.35rem;
        display: flex;
        flex-direction: column;
    }
    .menu a,
    .menu button {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.5rem 0.65rem;
        border-radius: 7px;
        color: var(--fg);
        background: none;
        border: 0;
        font: inherit;
        font-weight: 300;
        cursor: pointer;
        width: 100%;
        text-align: left;
    }
    .menu a:hover,
    .menu button:hover {
        background: var(--surface-2);
        text-decoration: none;
    }
    @media (max-width: 560px) {
        .hide-sm {
            display: none;
        }
    }
</style>
