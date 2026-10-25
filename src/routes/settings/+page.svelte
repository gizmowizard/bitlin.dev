<script lang="ts">
    import { enhance } from "$app/forms";
    import Meta from "../Meta.svelte";
    import ProfileFields from "./ProfileFields.svelte";
    import { enhanceForm } from "#lib/forms.ts";
    import { userHref } from "#lib/util.ts";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();
    let busy = $state(false);
</script>

<Meta title="settings" noindex />
<h1>Profile</h1>
<form
    class="card stack"
    method="POST"
    use:enhance={enhanceForm({
        busy: (b) => (busy = b),
        success: "Profile saved",
    })}
>
    <ProfileFields profile={data.profile} />
    <div class="row">
        <button class="btn primary" disabled={busy}
            >{busy ? "…" : "Save profile"}</button
        >
        <a class="btn" href={userHref(data.profile.username)}>see profile</a>
    </div>
</form>
