<script lang="ts">
    import { LEGAL } from "#lib/legal.ts";
</script>

<footer>
    <a href="/tos">Terms</a>
    <span aria-hidden="true">·</span>
    <a href="/privacy">Privacy</a>
    <span aria-hidden="true">·</span>
    <a href="mailto:{LEGAL.contactEmail}">Contact</a>
</footer>

<style>
    footer {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.4rem 0.8rem;
        padding: 1.2rem 1rem 2rem;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 0.85rem;
    }
</style>