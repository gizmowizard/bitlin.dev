<script lang="ts">
    import Meta from "./Meta.svelte";
    import Brand from "./Brand.svelte";
    import Icon from "./Icon.svelte";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();
    const tagline =
        "Git but if it was better. A parody made by GizmoWizard, with a fully functional api and source control.";
</script>

<Meta title="Bitlin" description={tagline} />

<main>
    <img src="/bitlin.png" alt="Bitlin logo" width="160" height="160" />
    <h1>bitlin.dev</h1>
    <p class="tag">{tagline}</p>

    <div class="signin" id="signin">
        {#if data.error}<p class="err">Sign-in was cancelled.</p>{/if}
        {#each data.providers as p (p.id)}
            <a
                class="btn"
                href="/auth/{p.id}{data.next
                    ? `?next=${encodeURIComponent(data.next)}`
                    : ''}"
                data-sveltekit-reload
            >
                <Brand name={p.id as "github" | "google" | "discord"} /> Continue
                with {p.label}
            </a>
        {:else}
            <p class="muted small">No sign-in providers are configured yet.</p>
        {/each}
        <a class="explore" href="/explore"
            ><Icon name="compass" /> explore projects</a
        >
    </div>

    <ul class="feats">
        <li><Icon name="stack" /> snapshots</li>
        <li><Icon name="git-branch" />branches</li>
        <li><Icon name="git-merge" /> merges</li>
        <li><Icon name="git-compare" /> diffs</li>
        <li><Icon name="tag" /> tags</li>
        <li><Icon name="server" /> remotes</li>
    </ul>
</main>

<style>
    main {
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 2rem;
        text-align: center;
    }
    img {
        width: clamp(112px, 22vw, 160px);
        height: auto;
        border-radius: 22%;
        margin-bottom: 1rem;
    }
    h1 {
        font-size: clamp(3.5rem, 12vw, 6rem);
        line-height: 1;
        color: var(--accent);
    }
    .tag {
        max-width: 40ch;
        font-size: clamp(1rem, 2.5vw, 1.2rem);
        line-height: 1.6;
    }
    .signin {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        margin-top: 1.5rem;
        width: min(100%, 300px);
    }
    .signin .btn {
        padding: 0.75rem 1rem;
        font-size: 0.95rem;
    }
    .explore {
        display: inline-flex;
        gap: 0.4rem;
        align-items: center;
        justify-content: center;
        margin-top: 0.4rem;
        font-size: 0.9rem;
    }
    .feats {
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1.2rem;
        justify-content: center;
        padding: 0;
        margin: 2rem 0 0;
        color: var(--muted);
        font-size: 0.88rem;
    }
    .feats li {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
    }
</style>
