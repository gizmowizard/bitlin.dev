<script lang="ts">
    import Meta from "../Meta.svelte";
    import { LEGAL } from "#lib/legal.ts";
</script>

<Meta
    title="Terms of Service"
    description="The rules for using Bitlin, what the service does and doesn't do, and who is responsible for what."
/>

<div class="page narrow">
    <article class="md">
        <h1>Terms of Service</h1>
        <p class="muted">Effective {LEGAL.effective}</p>

        <p>
            These terms are an agreement between you and {LEGAL.operator} (“we”, “us”), who
            operates {LEGAL.service} at {LEGAL.site}. By signing in to or using {LEGAL.service}
            you agree to them and to our <a href="/privacy">Privacy Policy</a>. If you do not
            agree, do not use the service.
        </p>

        <h2>1. What Bitlin is, and what it is not</h2>
        <p>
            {LEGAL.service} is a web service for storing and sharing source code and other
            files with version history. It lets you create projects; upload or edit files; save
            snapshots; work with branches and tags; compare and merge changes; open proposals
            (requests to merge changes) with comments; invite collaborators; fork other
            people’s projects; connect projects to remote Bitlin servers; and use a sync API
            with personal access tokens.
        </p>
        <p>It is not:</p>
        <ul>
            <li>
                <strong>Git.</strong> It uses its own snapshot model and its own sync
                protocol. It does not currently offer a Git-format import or export.
            </li>
            <li>
                <strong>A backup service.</strong> Keep your own copies of anything you
                cannot afford to lose (section 9).
            </li>
            <li>
                <strong>An encrypted vault.</strong> Private projects are access-controlled,
                not end-to-end encrypted (see the Privacy Policy, section 2).
            </li>
            <li>
                <strong>A guaranteed or paid service.</strong> It is provided free of charge,
                with no uptime commitment or support commitment.
            </li>
            <li>
                <strong>Affiliated</strong> with Git, GitHub, Google or Discord. Those names
                belong to their owners.
            </li>
        </ul>
        <p>
            Bitlin does not review content before it is posted, does not endorse any user’s
            content, and does not run your code. Files you upload are stored and shown or
            downloaded only as inert data.
        </p>

        <h2>2. Who may use it</h2>
        <p>
            You must be at least {LEGAL.minAge} years old, or older if your country sets a
            higher minimum age to use online services without a parent’s consent. You must be
            allowed to use the service under the law that applies to you, and you must not
            have been removed from Bitlin before. If you use Bitlin for an organisation, you
            confirm you can bind that organisation to these terms.
        </p>

        <h2>3. Your account</h2>
        <ul>
            <li>
                You sign in only through GitHub, Google or Discord. There are no passwords on
                Bitlin. You are responsible for securing those accounts.
            </li>
            <li>
                One person per account. You are responsible for everything done through your
                account and through access tokens you create, so treat tokens like passwords
                and revoke any that leak.
            </li>
            <li>
                Usernames are 2–32 characters (lowercase letters, numbers, “-” and “_”). Some
                names are reserved. You may not pick a name to impersonate someone else, and
                we may change or remove names that do.
            </li>
            <li>
                You can delete your account yourself in Settings. What that removes, and what
                it does not, is described in the Privacy Policy, section 5.
            </li>
        </ul>

        <h2>4. Your content and what you allow</h2>
        <p>
            You keep ownership of everything you upload or write (“your content”). Bitlin does
            not claim to own it and does not pick a licence for it. If you do not want people to
            have it, make the project private.
        </p>
        <p>
            You give us a worldwide, non-exclusive, royalty-free licence to host, store, copy,
            process, transmit and display your content, only as needed to run and secure the
            service, for as long as it is on Bitlin. That includes, for example: showing a
            public project to anyone, letting it be indexed by search engines, building ZIP
            downloads, serving raw files, storing identical files once and sharing that copy
            between projects, and sending data to and from remote servers you connect.
        </p>
        <p><strong>When you make something visible, you allow others to use it that way:</strong></p>
        <ul>
            <li>
                A <strong>public</strong> project can be viewed and downloaded by anyone,
                signed in or not, and can be forked (copied, with its full history and author
                names) by any signed-in user.
            </li>
            <li>
                Any collaborator on a <strong>private</strong> project can view and download
                it and can also fork it. Only add people you trust with a full copy.
            </li>
            <li>
                A fork is an independent copy. If you later delete or privatise your project,
                existing forks are not deleted or changed.
            </li>
            <li>
                What others may do with your code beyond using these features is governed by
                whatever licence you put in your project, not by us.
            </li>
        </ul>
        <p>
            The “New project” form pre-selects <strong>public</strong>. Check the setting each
            time. Comments and proposals you post on someone else’s project are visible to anyone
            who can see that project, and that project’s owner controls it.
        </p>
        <p>
            You promise that you have the rights needed to upload your content and to give the
            permissions above, and that it does not break these terms or the law. Do not upload
            secrets (passwords, keys, tokens) you do not want others to see: in a public project
            they are public, and removing them later does not remove them from history or
            from forks.
        </p>

        <h2>5. Acceptable use</h2>
        <p>You may not use Bitlin to:</p>
        <ul>
            <li>
                Store or share content that is illegal, or that sexually exploits or endangers
                children, or that incites violence or harassment, or that exposes other
                people’s private information.
            </li>
            <li>
                Infringe someone’s copyright, trademark or other rights, or share material you
                are not allowed to share.
            </li>
            <li>
                Host malware, phishing pages or tools made to attack systems you do not have
                permission to test. Good-faith security research and educational examples
                that are clearly labelled are fine.
            </li>
            <li>
                Attack, overload or probe Bitlin or anyone else, for example by evading rate
                limits, scraping beyond them, scanning for vulnerabilities without our
                permission, or using the remotes feature to reach private or internal networks
                (the service blocks such addresses and you must not try to get around that).
            </li>
            <li>
                Create accounts in bulk or by automation, share accounts, or access
                projects you have not been given access to.
            </li>
            <li>Impersonate others or misrepresent your connection to a person or project.</li>
        </ul>
        <p>
            <strong>Limits.</strong> To keep the service running, default limits apply, which we may
            change: files up to 25 MB each, up to 5,000 files per snapshot, uploads up to 60 MB,
            unpacked ZIP uploads up to 150 MB, and up to 200 projects per user. Requests are
            rate-limited per user or IP address.
        </p>

        <h2>6. API, access tokens and remotes</h2>
        <p>
            You may use the sync API and personal access tokens for your own projects and for
            projects you have access to, within the limits above. Tokens act as you. A read-only
            token cannot write. If you connect a project to a remote server, you are
            responsible for having permission to do so and for that server’s terms. The token you
            supply is stored encrypted and sent to that remote server when syncing.
        </p>

        <h2>7. Reporting, removal and suspension</h2>
        <p>
            We do not monitor content in advance, but we may remove or disable any content,
            project or account, with or without notice, if we reasonably believe it breaks these
            terms or the law, puts the service or others at risk, or if we are required to. We
            may also change or end the service, or any feature, at any time.
        </p>
        <p>
            To report content or send a copyright notice, email
            <a href="mailto:{LEGAL.contactEmail}">{LEGAL.contactEmail}</a> with: the URL of the
            content; what is wrong with it; for copyright, the work you own and a statement,
            made in good faith, that the use is unauthorised, plus a statement that your notice
            is accurate and that you are the owner or authorised to act for the owner; and your
            contact details. We may pass the notice to the user who posted the content. We
            may end the accounts of users who repeatedly infringe.
        </p>

        <h2>8. Ending your use</h2>
        <p>
            You can stop using Bitlin at any time and may delete your account in Settings. We may
            suspend or end your access under section 7. Sections that by nature should
            survive (including 4 for existing forks, 9, 10, 11 and 12) continue afterwards.
        </p>

        <h2>9. No warranty — keep your own backups</h2>
        <p>
            Bitlin is provided <strong>“as is” and “as available”</strong>, without
            warranties of any kind, to the fullest extent the law allows. We do not promise that
            it will be uninterrupted, error-free, secure, or that your data will never be lost
            or corrupted. You can download a ZIP of the files in any snapshot from that snapshot’s
            page; do this, or keep a copy elsewhere, for anything important.
        </p>

        <h2>10. Limitation of liability</h2>
        <p>
            To the fullest extent the law allows, we are not liable for indirect, incidental,
            special, consequential or punitive damages, or for lost profits, lost data or lost
            goodwill, arising from your use of Bitlin. Our total liability for any claim is
            limited to US$100. Nothing in these terms limits liability that cannot be limited
            by law, and some places do not allow the limits above, so they may not apply to
            you in full.
        </p>
        <p>
            You are responsible for your content and your use of Bitlin. You agree to
            reimburse us for losses and reasonable costs arising from a third-party claim
            that your content or your breach of these terms caused, to the extent the law allows.
        </p>

        <h2>11. Governing law and disputes</h2>
        <p>
            These terms are governed by {LEGAL.governingLaw}, without regard to its conflict-of-law
            rules. Any dispute will be brought in {LEGAL.courts}, unless mandatory consumer law
            where you live gives you the right to use your local courts.
        </p>

        <h2>12. General</h2>
        <p>
            These terms and the Privacy Policy are the whole agreement between us about
            Bitlin. If part of them is unenforceable, the rest stays in force. If we do not
            enforce something, that is not a waiver. You may not transfer your rights under
            these terms. We may transfer ours, for example in a sale of the service. We may
            update these terms; we will change the effective date and, for significant changes,
            post a notice on the site, and continuing to use Bitlin after that means you accept
            the update.
        </p>

        <h2>13. Contact</h2>
        <p>
            <a href="mailto:{LEGAL.contactEmail}">{LEGAL.contactEmail}</a>, {LEGAL.operator}.
        </p>
    </article>
</div>