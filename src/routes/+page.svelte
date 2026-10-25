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
    <div class="shapes" aria-hidden="true"><i class="s1"></i><i class="s2"></i></div>
    <img src="/bitlin.png" alt="Bitlin logo" width="160" height="160" />
    <h1>bitlin.dev</h1>
    <p class="tag">{tagline}</p>

    <div class="signin" id="signin">
        <i class="orb" aria-hidden="true"></i>
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
        <p class="legal">
            By continuing you agree to the <a href="/tos">Terms of Service</a>
            and acknowledge the <a href="/privacy">Privacy Policy</a>.
        </p>
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
        --shape-1: #cfd2ff;
        --shape-2: #bfc2ff;
        --shape-hi: rgba(255, 255, 255, 0.55);
        --shape-lo: rgba(40, 44, 140, 0.16);
        position: relative;
        isolation: isolate;
        overflow: clip;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 2rem;
        text-align: center;
    }
    /* Flat, solid "bricks" behind the content. Kept pale so text on top
       stays readable; the bevel is just two crisp inset lines. */
    .shapes {
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
    }
    .shapes i {
        position: absolute;
        display: block;
        border-radius: 4px;
        aspect-ratio: 1;
        box-shadow:
            inset 4px 4px 0 var(--shape-hi),
            inset -4px -4px 0 var(--shape-lo);
    }
    .s1 {
        width: min(42vw, 380px);
        left: -8vw;
        top: -6vh;
        background: var(--shape-1);
        transform: rotate(-9deg);
    }
    .s2 {
        width: min(34vw, 300px);
        right: -8vw;
        bottom: -5vh;
        background: var(--shape-2);
        transform: rotate(12deg);
    }
    .orb {
        position: absolute;
        z-index: -1;
        right: -30px;
        top: 4px;
        width: 64px;
        aspect-ratio: 1;
        border-radius: 4px;
        background: var(--blue);
        box-shadow:
            inset 3px 3px 0 #9fa1ff,
            inset -3px -3px 0 #3434b0;
        transform: rotate(14deg);
        pointer-events: none;
    }
    :global(:root[data-theme="dark"]) main {
        --shape-1: #15153a;
        --shape-2: #1d1d52;
        --shape-hi: rgba(255, 255, 255, 0.07);
        --shape-lo: rgba(0, 0, 0, 0.45);
    }
    img {
        width: clamp(112px, 22vw, 160px);
        height: auto;
        border-radius: 4px;
        border: 2px solid var(--edge);
        margin-bottom: 1rem;
    }
    h1 {
        font-size: clamp(2.25rem, 9vw, 4.25rem);
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
        position: relative;
        isolation: isolate;
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
    .legal {
        margin-top: 0.4rem;
        font-size: 0.78rem;
        line-height: 1.5;
        color: var(--muted);
    }
    .legal a {
        text-decoration: underline;
        text-underline-offset: 2px;
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