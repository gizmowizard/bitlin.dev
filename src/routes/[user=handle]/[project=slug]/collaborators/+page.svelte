<script lang="ts">
    import { enhance } from '$app/forms';
    import Meta from '../../../Meta.svelte';
    import Icon from '../../../Icon.svelte';
    import Avatar from '../../../Avatar.svelte';
    import { page } from '$app/state';
    import { can } from '#lib/access.ts';
    import { enhanceForm } from '#lib/forms.ts';
    import { userHref } from '#lib/util.ts';
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
    const p = $derived(data.project);
    const admin = $derived(can(data.role, 'admin'));
    const me = $derived(page.data.user);
    const roleText = { read: 'Can view', write: 'Can save snapshots', admin: 'Can manage settings' } as const;
</script>

<Meta title="People · {p.owner.username}/{p.name}" description="Who works on *{p.owner.username}/{p.name}." />

<div class="stack narrow" style="max-width: 760px">
    {#if admin}
        <form class="card row" method="POST" action="?/add" use:enhance={enhanceForm({ reset: true, success: 'Collaborator added' })}>
            <Icon name="user-plus" />
            <input class="input grow" style="min-width: 10rem" name="username" placeholder="*username" required />
            <select class="select" style="width: auto" name="role" aria-label="Role"><option value="write">Write</option><option value="read">Read</option><option value="admin">Admin</option></select>
            <button class="btn primary">Add</button>
        </form>
    {/if}
    <div class="list">
        <div class="item"><Avatar user={p.owner} size={32} /><div class="grow"><a href={userHref(p.owner.username)}><b>{p.owner.display_name}</b></a> <span class="muted mono">*{p.owner.username}</span></div><span class="chip solid">Owner</span></div>
        {#each data.people as c (c.user_id)}
            <div class="item">
                <Avatar user={c} size={32} />
                <div class="grow"><a href={userHref(c.username)}><b>{c.display_name}</b></a> <span class="muted mono">*{c.username}</span><div class="small muted">{roleText[c.role]}</div></div>
                {#if admin}
                    <form class="row" method="POST" action="?/add" use:enhance={enhanceForm({ success: 'Role updated' })}>
                        <input type="hidden" name="username" value={c.username} />
                        <select class="select" style="width: auto" name="role" onchange={(e) => e.currentTarget.form?.requestSubmit()} aria-label="Role for {c.username}">
                            {#each ['read', 'write', 'admin'] as r}<option value={r} selected={c.role === r}>{r}</option>{/each}
                        </select>
                    </form>
                    <form method="POST" action="?/remove" use:enhance={enhanceForm({ success: 'Removed' })}><input type="hidden" name="id" value={c.user_id} /><button class="btn sm ghost danger" aria-label="Remove {c.username}"><Icon name="x" size={14} /></button></form>
                {:else}<span class="chip">{c.role}</span>{/if}
            </div>
        {/each}
    </div>
    {#if me && data.people.some((c) => c.user_id === me.id)}
        <form method="POST" action="?/leave" use:enhance={enhanceForm()} onsubmit={(e) => !confirm('Leave this project?') && e.preventDefault()}><button class="btn danger sm">Leave project</button></form>
    {/if}
</div>
