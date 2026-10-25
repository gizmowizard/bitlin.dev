# Hosting Bitlin at https://bitlin.dev

Bitlin runs as five containers on one Docker host: the app, Postgres, Redis, MinIO and `cloudflared`. Nothing is published on the host's network: Cloudflare Tunnel is the only way in, so you need no open ports, no reverse proxy and no TLS certificates to manage.

```
Browser ⇄ Cloudflare edge ⇄ cloudflared ⇄ app:3000 ⇄ postgres / redis / minio   (private Docker network)
```

## 1. Requirements

- A Linux host with Docker Engine 24+ and the Compose plugin (`docker compose version`). 2 vCPU / 4 GB RAM is plenty to start; disk grows with the files people upload.
- The domain `bitlin.dev` on a Cloudflare account (DNS managed by Cloudflare).
- OAuth apps for GitHub, Google and Discord (section 3). Any provider you leave blank is hidden from the sign-in page.

## 2. Get the code and configure

```bash
unzip bitlin.zip -d bitlin && cd bitlin
cp .env.example .env
```

Fill in `.env`:

| Variable | How to get it |
| --- | --- |
| `SECRET_KEY` | `openssl rand -base64 48`. Signs OAuth state and encrypts stored remote tokens. **Changing it later makes saved remote tokens unreadable.** |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` (hex avoids URL-escaping problems) |
| `REDIS_PASSWORD` | `openssl rand -hex 24` |
| `MINIO_ROOT_PASSWORD` | `openssl rand -hex 24` |
| `TUNNEL_TOKEN` | section 4 |
| `*_CLIENT_ID` / `*_CLIENT_SECRET` | section 3 |

`ORIGIN` and `CANONICAL_ORIGIN` already default to `https://bitlin.dev`.

## 3. OAuth applications

Every provider uses the callback `https://bitlin.dev/auth/<provider>/callback`.

**GitHub**: Settings → Developer settings → OAuth Apps → New.
Homepage `https://bitlin.dev`, callback `https://bitlin.dev/auth/github/callback`. Copy the client ID and generate a secret.

**Google**: Google Cloud Console → APIs & Services → OAuth consent screen (External, add your logo and domain) → Credentials → Create OAuth client ID → *Web application*.
Authorised redirect URI `https://bitlin.dev/auth/google/callback`. Scopes used: `openid`, `profile`. Publish the app to "In production" so any Google user can sign in.

**Discord**: Developer Portal → New Application → OAuth2 → Redirects → `https://bitlin.dev/auth/discord/callback`. Copy the client ID and secret. Scope used: `identify`.

## 4. Cloudflare Tunnel

1. Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** → *Cloudflared*.
2. Name it `bitlin`, choose **Docker** as the environment, and copy the long token from the shown command (`--token eyJ…`). Put it in `.env` as `TUNNEL_TOKEN`.
3. Under **Public hostnames** add:
   - Subdomain: *(empty)*, Domain: `bitlin.dev`
   - Service type **HTTP**, URL **`app:3000`**
   WebSockets work through tunnels automatically, with nothing to enable.
4. Optional but recommended: add `www.bitlin.dev` as a second public hostname and a Redirect Rule from `www` to the apex, so `https://bitlin.dev` stays the single canonical address.
5. In Cloudflare **SSL/TLS** set the mode to *Full*. Tunnel traffic is encrypted end to end already; this just keeps the dashboard consistent.

The app relies on two headers Cloudflare adds: `X-Forwarded-Proto` (to build the correct `https://` origin for form protection) and `CF-Connecting-IP` (the visitor's real IP for rate limiting). Because the app container has **no published ports**, nobody can reach it in a way that lets them spoof those headers. Don't add a `ports:` section to `app`.

## 5. Start it

```bash
docker compose up -d --build
docker compose logs -f app
```

Wait for `[boot] bitlin ready`. Migrations run automatically and the MinIO bucket is created on first boot. Visit https://bitlin.dev, sign in with a provider, pick your `*username`, and create a project.

Useful checks:

```bash
docker compose ps                         # app should be "healthy"
curl -sI https://bitlin.dev/robots.txt    # 200
curl -s https://bitlin.dev/sitemap.xml    # sitemap index
```

WebSocket check: open the site in two tabs on the same project, save a snapshot in one, and watch the other update immediately. The small dot in the header is blue when the socket is live.

## 6. Day-two operations

**Updating**
```bash
git pull   # or unzip a new release over the folder
docker compose up -d --build app
```
Schema changes are applied automatically at startup (new files in `src/lib/server/migrations`, run once, in order).

**Backups** (Postgres holds history and metadata, MinIO holds file contents; you need both)
```bash
# database
docker compose exec -T postgres pg_dump -U bitlin -Fc bitlin > backup-$(date +%F).dump
# object storage: stop writes briefly, or use the MinIO client against the volume
docker run --rm -v bitlin_miniodata:/data -v "$PWD":/out alpine tar czf /out/minio-$(date +%F).tgz -C /data .
```
Restore the database with `pg_restore -U bitlin -d bitlin --clean` into a fresh container, and untar the MinIO data into an empty `miniodata` volume. Redis only holds rate-limit counters and pub/sub, so it needs no backup.

**Logs**: `docker compose logs -f app`. Errors include the method and path.

**Maintenance** runs every 6 hours in the app: expired sessions are removed, stale drafts older than 60 days are dropped, and file blobs no project references (abandoned uploads, deleted projects) are deleted from MinIO after a 2-day grace period.

**Limits** can be tuned in `.env`: `MAX_FILE_MB` (25), `MAX_FILES` (5000 per snapshot), `MAX_UPLOAD_MB` (60 per request; the browser sends big uploads in batches), `MAX_UNZIP_MB` (150). `BODY_SIZE_LIMIT` in `docker-compose.yml` must stay above `MAX_UPLOAD_MB`.

**Rate limits** (Redis, per user or IP) are defined in `src/lib/server/ratelimit.ts`. If Redis is unreachable the app falls back to per-process counters instead of failing.

## 7. Remotes between servers

On the receiving project owner's account: Settings → Access tokens → create a token. On the project that will push or fetch: Remotes → Add, with the URL `https://bitlin.dev/*user/project` and the token. Public projects can be fetched without a token. Remote URLs pointing at private/internal IP ranges are refused to prevent SSRF; for a Bitlin on your LAN set `ALLOW_PRIVATE_REMOTES=true` on the app.

## 8. SEO and link previews

- `static/sitemap.xml` is a sitemap index pointing to `sitemap-pages.xml` (static pages) and `/sitemap-projects.xml`, which is generated from the database on every request (cached 15 min) and lists public profiles and projects. Submit `https://bitlin.dev/sitemap.xml` in Google Search Console.
- Every page sets Open Graph and Twitter tags (title, description with stats, canonical URL, image). Pages without their own image use `static/og-image.png`; profiles use the user's avatar. Paste a project link in Discord to check the embed. If Discord shows a stale preview, append `?x=1` to the link once.

## 9. Scaling and caveats

- One app container is the supported setup. You can run several: sessions, data and rate limits are shared, and events fan out through Redis. **Presence** ("who is viewing") is tracked per process, so with several replicas each only sees its own viewers.
- Rate limiting needs the real client IP: keep `ADDRESS_HEADER`/`IP_HEADER` as `cf-connecting-ip`.
- Not included: a command-line client (the sync API under `/api/sync` is ready for one), e-mail notifications, and generated per-project preview images.

## 10. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "Cross-site POST form submissions are forbidden" | The app sees the wrong origin. Make sure requests come through the tunnel and `PROTOCOL_HEADER=x-forwarded-proto` is set (it is in the compose file). |
| Header dot stays red / no live updates | The tunnel isn't forwarding `/ws`: confirm the public hostname service is plain `HTTP` → `app:3000`. Check `docker compose logs app` for `[ws]` lines. |
| Sign-in button missing | That provider's client ID/secret are blank in `.env`. |
| OAuth "redirect_uri mismatch" | The callback registered at the provider must exactly equal `https://bitlin.dev/auth/<provider>/callback`. |
| App never turns healthy | `docker compose logs app`: it retries Postgres and MinIO for about a minute and prints what it's waiting for. |
| Uploads fail with 413 | Raise `BODY_SIZE_LIMIT` and `MAX_UPLOAD_MB`, or upload fewer files at once. |
| Everyone is rate limited | The app is seeing one shared IP; verify the `CF-Connecting-IP` header reaches it. |
