<script lang="ts">
    import { page } from "$app/state";
    import Avatar from "./Avatar.svelte";
    import Icon, { type IconName } from "./Icon.svelte";
    import { userHref } from "#lib/util.ts";
    import { theme, setTheme, type ThemePref } from "#lib/theme.svelte.ts";

    const THEMES: { id: ThemePref; label: string; icon: IconName }[] = [
        { id: "light", label: "Light", icon: "sun" },
        { id: "dark", label: "Dark", icon: "moon" },
        { id: "system", label: "System", icon: "monitor" },
    ];

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

    function onWindowClick(e: MouseEvent) {
        if (menu?.open && !menu.contains(e.target as Node)) menu.open = false;
    }
    function onWindowKey(e: KeyboardEvent) {
        if (e.key === "Escape" && menu?.open) {
            menu.open = false;
            menu.querySelector("summary")?.focus();
        }
    }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKey} />

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
            <a class="btn sm" href="/new"
                ><Icon name="plus" size={15} />
                <span class="hide-sm">New</span></a
            >
            <details bind:this={menu}>
                <summary aria-label="Account menu"
                    ><Avatar {user} size={30} /></summary
                >
                <div class="menu glass">
                    <a href={userHref(user.username)}
                        ><Icon name="user" /> *{user.username}</a
                    >
                    <a href="/dashboard"><Icon name="house" /> Dashboard</a>
                    <a href="/settings"><Icon name="settings" /> Settings</a>
                    <div class="sep" role="separator"></div>
                    <div class="theme" role="group" aria-label="Theme">
                        <span class="theme-label">Theme</span>
                        <div class="seg">
                            {#each THEMES as t (t.id)}
                                <button
                                    type="button"
                                    class:on={theme.pref === t.id}
                                    aria-pressed={theme.pref === t.id}
                                    aria-label={t.label}
                                    title={t.label}
                                    onclick={() => setTheme(t.id)}
                                    ><Icon name={t.icon} size={15} /></button
                                >
                            {/each}
                        </div>
                    </div>
                    <div class="sep" role="separator"></div>
                    <form method="POST" action="/auth/logout">
                        <button class="signout"
                            ><Icon name="log-out" /> Sign out</button
                        >
                    </form>
                </div>
            </details>
        {:else}
            <a class="btn sm" href="/#signin">Sign in</a>
        {/if}
    </div>
</header>

<style>
    /* Solid brand-blue forum bar. Opaque on purpose: a backdrop-filter here
       would become the "backdrop root" for the menu inside it and stop the
       menu from blurring the page behind it. */
    header {
        border-bottom: 3px solid var(--bar-edge);
        background: var(--bar);
        position: sticky;
        top: 0;
        z-index: 50;
    }
    /* the global blue focus ring would vanish on the blue bar */
    header :global(:focus-visible) {
        outline-color: var(--on-bar);
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
        color: var(--on-bar);
        font-family: var(--font-display);
        font-size: 1.35rem;
        font-weight: 700;
        letter-spacing: -0.02em;
        line-height: 1;
    }
    .brand img {
        border-radius: 3px;
        border: 1px solid var(--on-bar);
    }
    .brand:hover {
        text-decoration: none;
    }
    .navlink {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--on-bar-soft);
        font-family: var(--font-ui);
        font-weight: 700;
        font-size: 0.85rem;
    }
    .navlink:hover {
        color: var(--on-bar);
        text-decoration: underline;
        text-underline-offset: 3px;
    }
    details {
        position: relative;
    }
    summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        padding: 1px;
        background: var(--bg);
        border: 1px solid var(--bar-edge);
        border-radius: 3px;
    }
    summary::-webkit-details-marker {
        display: none;
    }
    .menu {
        position: absolute;
        right: 0;
        top: calc(100% + 0.5rem);
        min-width: 210px;
        padding: 0.35rem;
        display: flex;
        flex-direction: column;
    }
    .menu a,
    .menu .signout {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.5rem 0.7rem;
        border-radius: 2px;
        color: var(--fg);
        background: none;
        border: 0;
        font: inherit;
        font-weight: 400;
        cursor: pointer;
        width: 100%;
        text-align: left;
    }
    .menu a:hover,
    .menu .signout:hover {
        background: var(--bar);
        color: var(--on-bar);
        text-decoration: none;
    }
    .sep {
        height: 1px;
        background: var(--line);
        margin: 0.3rem 0.4rem;
    }
    .theme {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.3rem 0.35rem 0.3rem 0.7rem;
    }
    .theme-label {
        font-family: var(--font-ui);
        font-weight: 700;
        font-size: 0.8rem;
    }
    .seg {
        display: flex;
        gap: 2px;
        padding: 2px;
        border-radius: 3px;
        background: var(--surface);
        border: 1px solid var(--edge);
        box-shadow: var(--sunken);
    }
    .seg button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.35rem 0.5rem;
        border: 1px solid transparent;
        border-radius: 2px;
        background: none;
        color: var(--muted);
        cursor: pointer;
    }
    .seg button:hover {
        color: var(--fg);
        background: var(--face-hover);
    }
    .seg button.on {
        background: var(--blue);
        border-color: var(--bar-edge);
        color: #fff;
        box-shadow: inset 1px 1px 0 #3434b0, inset -1px -1px 0 #9fa1ff;
    }
    @media (max-width: 560px) {
        .hide-sm {
            display: none;
        }
    }
</style>
