<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../../Meta.svelte';
    import Icon from '../../../../Icon.svelte';
    import Time from '../../../../Time.svelte';
    import { can } from '#lib/access.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import { plainText, projectHref, shortId } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const t = $derived(data.tag);
    const base = $derived(projectHref(p.owner.username, p.name));
    const writer = $derived(can(data.role, 'write'));
    let editing = $state(false);
</script>

<Meta title="{t.name} · {p.owner.username}/{p.name}" description={[t.message, plainText(t.notes, 180), `Tagged ${new Date(t.created_at).toLocaleDateString()} in *${p.owner.username}/${p.name}`].filter(Boolean).join(' · ')} path="{base}/tags/{t.name}" type="article" published={t.created_at} />

<div class="stack">
    <div class="card stack">
        <div class="row between"><div class="row"><Icon name="tag" size={22} /><h2>{t.name}</h2></div><span class="small muted">Tagged <Time date={t.created_at} /></span></div>
        {#if t.message}<p>{t.message}</p>{/if}
        {#if data.info}<p class="small muted">At <a class="mono" href="{base}/snapshots/{data.info.id}">{shortId(data.info.id)}</a> · {data.info.message.split('\n')[0]}</p>{/if}
        <div class="row">
            <a class="btn sm" href="{base}/files/?ref={encodeURIComponent(t.name)}"><Icon name="folder-open" size={14} /> Browse files</a>
            <a class="btn sm" href="{base}/archive?ref={encodeURIComponent(t.name)}" data-sveltekit-reload><Icon name="download" size={14} /> Download ZIP</a>
            {#if writer}<button class="btn sm" onclick={() => (editing = !editing)}><Icon name="pencil" size={14} /> Edit notes</button>
                <form method="POST" action="?/delete" use:enhance={enhanceForm()} onsubmit={(e) => !confirm(`Delete tag “${t.name}”?`) && e.preventDefault()}><button class="btn sm danger"><Icon name="trash-2" size={14} /> Delete</button></form>{/if}
        </div>
    </div>
    {#if editing}
        <form class="card stack" method="POST" action="?/update" use:enhance={enhanceForm({ success: 'Saved', after: () => (editing = false) })}>
            <input class="input" name="message" value={t.message} maxlength="200" placeholder="Title" />
            <textarea class="textarea" name="notes" rows="8">{t.notes}</textarea>
            <button class="btn primary" style="align-self: flex-start">Save</button>
        </form>
    {:else if t.notes}<div class="card flat md">{@html data.html}</div>{/if}
</div>
