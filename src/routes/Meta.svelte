<script lang="ts">
    import { page } from "$app/state";

    interface Props {
        title: string;
        description?: string;
        image?: string | null;
        type?: "website" | "profile" | "article";
        path?: string;
        noindex?: boolean;
        published?: Date | string | null;
        imageAlt?: string;
    }
    let {
        title,
        description = "Bitlin - git but better",
        image = null,
        type = "website",
        path,
        noindex = false,
        published = null,
        imageAlt,
    }: Props = $props();

    const origin = $derived(page.data.origin as string);
    const url = $derived(origin + (path ?? page.url.pathname));
    const img = $derived(image ?? `${origin}/og-image.png`);
    const full = $derived(title === "Bitlin" ? title : `${title} - Bitlin`);
    const desc = $derived(
        description.length > 280
            ? `${description.slice(0, 277)}…`
            : description,
    );
</script>

<svelte:head>
    <title>{full}</title>
    <meta name="description" content={desc} />
    <link rel="canonical" href={url} />
    {#if noindex}<meta name="robots" content="noindex" />{/if}
    <meta property="og:site_name" content="Bitlin" />
    <meta property="og:type" content={type} />
    <meta property="og:title" content={full} />
    <meta property="og:description" content={desc} />
    <meta property="og:url" content={url} />
    <meta property="og:image" content={img} />
    <meta property="og:image:alt" content={imageAlt ?? title} />
    {#if !image}<meta property="og:image:width" content="1200" /><meta
            property="og:image:height"
            content="630"
        />{/if}
    {#if published}<meta
            property="article:published_time"
            content={new Date(published).toISOString()}
        />{/if}
    <meta
        name="twitter:card"
        content={image ? "summary" : "summary_large_image"}
    />
    <meta name="twitter:title" content={full} />
    <meta name="twitter:description" content={desc} />
    <meta name="twitter:image" content={img} />
    <meta name="theme-color" content="#5a5cff" />
</svelte:head>
