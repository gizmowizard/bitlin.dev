<script lang="ts">
    import Meta from "../Meta.svelte";
    import { LEGAL } from "#lib/legal.ts";
</script>

<Meta
    title="Privacy Policy"
    description="What data Bitlin collects, why, who can see it, and how long it is kept."
/>

<div class="page narrow">
    <article class="md">
        <h1>Privacy Policy</h1>
        <p class="muted">Effective {LEGAL.effective}</p>

        <p>
            This policy explains what personal data {LEGAL.service} ({LEGAL.site}) collects,
            why, who can see it, and how long it is kept. {LEGAL.service} is operated by
            {LEGAL.operator} (“we”, “us”). You can reach us at
            <a href="mailto:{LEGAL.contactEmail}">{LEGAL.contactEmail}</a>. Our
            <a href="/tos">Terms of Service</a> apply alongside this policy.
        </p>

        <h2>The short version</h2>
        <p><strong>Bitlin does:</strong></p>
        <ul>
            <li>Sign you in with GitHub, Google or Discord. There are no passwords.</li>
            <li>Store the profile you set up and the projects, files and history you create.</li>
            <li>
                Show public profiles and public projects to anyone on the internet, including
                search engines.
            </li>
            <li>Use your IP address briefly to rate-limit requests.</li>
            <li>Load a font from Google Fonts on every page.</li>
            <li>Set one login cookie, plus one short-lived cookie while you sign in.</li>
        </ul>
        <p><strong>Bitlin does not:</strong></p>
        <ul>
            <li>
                Ask for or store your email address, password, phone number, postal address or
                payment details.
            </li>
            <li>Run advertising, analytics, tracking pixels or tracking cookies.</li>
            <li>Sell your personal data or share it with advertisers.</li>
            <li>Send you email (we do not have your email address).</li>
            <li>Use your files or messages to train AI models.</li>
            <li>
                Encrypt the files in private projects at the application level. “Private” means
                access-controlled, not end-to-end encrypted (see section 2).
            </li>
        </ul>

        <h2>1. What we collect</h2>

        <h3>1.1 From your sign-in provider</h3>
        <p>
            When you click “Continue with…”, we ask the provider for the minimum needed to
            identify you. We use the access token the provider gives us once, to read your
            profile, and we do not store it.
        </p>
        <table>
            <thead>
                <tr><th>Provider</th><th>Permission requested</th><th>What we store</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td>GitHub</td>
                    <td><code>read:user</code></td>
                    <td>Your GitHub numeric ID, username, display name, avatar URL</td>
                </tr>
                <tr>
                    <td>Google</td>
                    <td><code>openid profile</code></td>
                    <td>
                        Your Google account ID, name, profile picture URL. Your first username is
                        derived from your name.
                    </td>
                </tr>
                <tr>
                    <td>Discord</td>
                    <td><code>identify</code></td>
                    <td>Your Discord numeric ID, username, display name, avatar URL</td>
                </tr>
            </tbody>
        </table>
        <p>
            We do not store any email address. We store the avatar’s URL, not a copy of the
            image; the image stays hosted by your provider. The provider learns that you signed in
            to Bitlin and handles that data under its own privacy policy.
        </p>

        <h3>1.2 Profile details you provide</h3>
        <p>
            Username, display name, bio (Markdown, up to 300 words), timezone, and an optional
            country or region. Your username, display name and timezone are required. Your bio
            and region are optional.
        </p>

        <h3>1.3 Content you create</h3>
        <p>
            Projects (name, description, visibility, ignore rules), the files you upload or edit,
            snapshots (file listing, message, timestamp, and your username recorded as the
            author), branches, tags and tag notes, proposals and comments, collaborator
            lists and roles, uncommitted staged changes, remote addresses, and an activity log
            of actions such as creating snapshots, branches, tags, proposals, forks and
            collaborator changes.
        </p>

        <h3>1.4 Account and security data</h3>
        <ul>
            <li>
                <strong>Sessions:</strong> a hash of your login token (not the token itself),
                your browser’s user-agent string (cut to 300 characters), and creation and
                expiry times.
            </li>
            <li>
                <strong>Access tokens you create:</strong> a hash of the token, the name you
                gave it, its first few characters (so you can recognise it), whether it can
                write, and when it was last used.
            </li>
            <li>
                <strong>Remote access tokens you enter</strong> when connecting a project to
                another Bitlin server. These are stored encrypted.
            </li>
        </ul>

        <h3>1.5 Technical data</h3>
        <ul>
            <li>
                <strong>IP address.</strong> Used to rate-limit requests. For signed-in users
                the limit is keyed to your account instead. IP-based counters are held in
                Redis and expire automatically, within at most one hour. While a live
                (WebSocket) connection is open, its IP is also held in server memory and
                discarded when the connection closes. Bitlin does not intentionally write IP
                addresses to its database or application logs.
            </li>
            <li>
                <strong>Error logs.</strong> When something fails, the server logs the request
                method, the page path and the error. It does not deliberately log request
                bodies.
            </li>
            <li>
                <strong>Infrastructure logs.</strong> Bitlin is served through Cloudflare (see
                section 4), which sees your IP address and request metadata and keeps its own
                logs.
            </li>
        </ul>

        <h3>1.6 Live activity</h3>
        <p>
            Open pages keep a WebSocket connection so updates appear without reloading. While
            you view a project, other people viewing the same project can see your username,
            display name and avatar in a “who’s here” list (signed-out visitors are counted
            but not named). If you type in a proposal’s comment box, others viewing that proposal
            may see a typing indicator.
        </p>

        <h3>1.7 What we do not collect</h3>
        <p>
            Email, passwords, payment information, phone number, precise location (your region
            is only what you choose to select), contacts, device identifiers, or any analytics
            or advertising profile.
        </p>

        <h2>2. Who can see what</h2>
        <ul>
            <li>
                <strong>Public to everyone, signed in or not:</strong> your username, display
                name, avatar, bio, region (if set), timezone and the current local time there,
                the month you joined, and your public projects. For a public project that
                includes its files, full history (including author usernames, messages and
                timestamps), branches, tags, proposals, comments and activity.
            </li>
            <li>
                <strong>Search engines:</strong> public profile and project pages may be
                indexed. Our sitemap lists public projects and the profiles of users who have at
                least one. Raw files, archives, uploads, the editor and settings pages are
                disallowed in our <code>robots.txt</code>, although well-behaved crawlers
                are the only ones that follow it.
            </li>
            <li>
                <strong>Public by default:</strong> the “New project” form has “public”
                pre-selected. Choose “private” if you want otherwise. You can change
                visibility later in project settings.
            </li>
            <li>
                <strong>Private projects</strong> are visible only to the owner and people the
                owner adds as collaborators. They are left out of Explore and our sitemap.
                Collaborators with any role can view and download the project and copy
                (fork) it into their own account. Private projects are protected by access
                control; their files are stored unencrypted in our object storage, so
                people with administrative access to our servers could technically read them.
                We will not access private project contents except to operate and secure the
                service, handle abuse reports, or comply with the law.
            </li>
            <li>
                <strong>Visible only to you (and to us as operators):</strong> your linked
                sign-in accounts, access tokens list, sessions, and IP-based rate-limit data.
            </li>
        </ul>

        <h2>3. How we use data</h2>
        <ul>
            <li>To run Bitlin: sign you in, store and serve your projects, and sync with remotes.</li>
            <li>To keep Bitlin secure: rate limiting, abuse prevention, and debugging errors.</li>
            <li>To show on-site notices (for example, when you are added to a project).</li>
            <li>To respond to legal requests and enforce our Terms.</li>
        </ul>
        <p>
            We do not use personal data for advertising, profiling, or automated decisions with
            legal effect. If the GDPR or UK GDPR applies to you, our legal bases are performing
            our contract with you (providing the service), our legitimate interests in
            security and abuse prevention, and compliance with legal obligations.
        </p>

        <h2>4. Cookies, local storage and third parties</h2>

        <h3>Cookies and local storage</h3>
        <table>
            <thead>
                <tr><th>Name</th><th>Purpose</th><th>Lifetime</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>bitlin_session</code> (cookie)</td>
                    <td>Keeps you signed in. HttpOnly, SameSite=Lax, Secure in production.</td>
                    <td>30 days, extended while you stay active; deleted when you sign out</td>
                </tr>
                <tr>
                    <td><code>bitlin_oauth</code> (cookie)</td>
                    <td>Protects the sign-in handshake with your provider. Signed, HttpOnly.</td>
                    <td>10 minutes, removed when sign-in completes</td>
                </tr>
                <tr>
                    <td><code>bitlin-theme</code> (local storage)</td>
                    <td>Remembers a light or dark theme choice on your device.</td>
                    <td>Until you choose “System” or clear your browser data</td>
                </tr>
            </tbody>
        </table>
        <p>
            All three are strictly necessary or purely functional. There are no analytics,
            advertising or cross-site tracking cookies.
        </p>

        <h3>Third parties that receive some of your data</h3>
        <table>
            <thead>
                <tr><th>Who</th><th>What they receive</th><th>Why</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td>GitHub, Google, Discord</td>
                    <td>The fact that you are signing in to Bitlin</td>
                    <td>Authentication, at your request</td>
                </tr>
                <tr>
                    <td>Cloudflare</td>
                    <td>All traffic between you and Bitlin, including IP addresses and request content</td>
                    <td>Cloudflare Tunnel delivers our site and terminates TLS</td>
                </tr>
                <tr>
                    <td>Google Fonts</td>
                    <td>Your IP address and browser details, when any page loads</td>
                    <td>Serves the Lexend typeface</td>
                </tr>
                <tr>
                    <td>Your provider’s image servers (GitHub, Google, Discord)</td>
                    <td>Your IP address and browser details, when someone views an avatar. We ask browsers not to send a referrer.</td>
                    <td>Hosts avatar images</td>
                </tr>
                <tr>
                    <td>Any website whose image is embedded in Markdown</td>
                    <td>The IP address and browser details of whoever views the page</td>
                    <td>Bios, comments and project documents can embed external https images</td>
                </tr>
                <tr>
                    <td>Remote Bitlin servers you connect</td>
                    <td>Requests from our server, including the access token you supplied and the project data being fetched or pushed</td>
                    <td>Remotes sync, only when you use it</td>
                </tr>
                <tr>
                    <td>Our hosting providers</td>
                    <td>Stored data, on servers that run the database, cache and file storage</td>
                    <td>Running the service</td>
                </tr>
            </tbody>
        </table>
        <p>
            We may also disclose data if required by law, to protect people or the service
            from harm, or as part of a merger or sale of the service. Those parties do not get
            data for advertising.
        </p>

        <h2>5. How long we keep data</h2>
        <table>
            <thead>
                <tr><th>Data</th><th>Retention</th></tr>
            </thead>
            <tbody>
                <tr><td>Profile, linked sign-in accounts, projects and all project content</td><td>Until you delete them or your account</td></tr>
                <tr><td>Login sessions</td><td>30 days from last activity; deleted when you sign out; expired ones are purged by a job that runs every six hours</td></tr>
                <tr><td>Access tokens</td><td>Until you revoke them or delete your account</td></tr>
                <tr><td>Uncommitted staged changes</td><td>Deleted automatically after 60 days without updates</td></tr>
                <tr><td>Files no project refers to any more</td><td>Removed by a cleanup job that runs every six hours; very recently uploaded files are kept up to two days first</td></tr>
                <tr><td>IP-based rate-limit counters</td><td>At most one hour</td></tr>
                <tr><td>Error logs</td><td>Kept only as long as needed to debug and secure the service</td></tr>
            </tbody>
        </table>
        <p>
            If we keep backups of our databases or storage, deleted data may remain in them until
            they rotate out.
        </p>

        <h3>What deleting your account does</h3>
        <p>
            In Settings → accounts → “Delete account” (you confirm by typing your username):
        </p>
        <ul>
            <li>
                <strong>Deleted:</strong> your profile, linked sign-in accounts, sessions, access
                tokens, every project you own (with its files, history, branches, tags,
                proposals, comments, remotes, collaborator list and activity), your staged
                changes, and your collaborator access to other people’s projects.
            </li>
            <li>
                <strong>Not deleted:</strong> things that exist in other people’s projects.
                Comments and proposals you wrote there stay, but are no longer linked to a
                profile. Snapshots you authored keep the author name (your old username) as plain
                text, because it is part of the snapshot’s content-derived ID. Activity entries may
                mention your old username. Copies others made by forking one of your projects
                before deletion are independent and remain, including your files and the
                author names in the history.
            </li>
            <li>
                <strong>Your username</strong> becomes available for someone else to register.
            </li>
        </ul>
        <p>
            You can also delete a single project (Project settings) or revoke access tokens
            without deleting your account.
        </p>

        <h2>6. Your choices and rights</h2>
        <p>
            You can edit your profile, linked accounts, project visibility and access tokens in
            Settings, and delete your data as described above. Depending on where you live
            (for example under the GDPR, UK GDPR or California law) you may also have the right
            to access, correct, delete, restrict or port your personal data, or to object to
            certain processing, and to complain to your local data protection authority. To
            exercise a right that the site doesn’t already let you do yourself, email
            <a href="mailto:{LEGAL.contactEmail}">{LEGAL.contactEmail}</a>. We may need you to
            sign in or otherwise prove the account is yours. Because we do not sell or share
            personal data for advertising, there is nothing to opt out of.
        </p>

        <h2>7. Security</h2>
        <p>
            Login and access tokens are stored only as hashes. Remote access tokens are
            encrypted with AES-256-GCM. Connections use HTTPS, and login cookies are not
            readable by page scripts. User-uploaded files are served with restrictive security
            headers so they cannot run as web pages. No system is perfectly secure, and we
            cannot guarantee that data will never be lost, accessed or disclosed without
            authorisation. If a breach affects you, we will tell you in the way the law
            requires, which may be a notice on the site.
        </p>

        <h2>8. Children</h2>
        <p>
            Bitlin is not for anyone under {LEGAL.minAge}, or older where your country’s law
            sets a higher age to use online services without a parent’s consent. If we learn we
            hold data from someone below that age, we will delete the account.
        </p>

        <h2>9. International transfers</h2>
        <p>
            Our servers, and the providers listed above, may be in countries other than yours.
            By using Bitlin you understand your data may be processed there. Where the law
            requires safeguards for such transfers, we rely on the ones available to us, such as
            standard contractual clauses used by our providers.
        </p>

        <h2>10. Changes</h2>
        <p>
            We may update this policy. We will change the effective date at the top and, for
            significant changes, post a notice on the site. Because we do not have your email
            address, that is our only way to notify you. Continuing to use Bitlin after a change
            means you accept it.
        </p>

        <h2>11. Contact</h2>
        <p>
            <a href="mailto:{LEGAL.contactEmail}">{LEGAL.contactEmail}</a>, {LEGAL.operator}.
        </p>
    </article>
</div>