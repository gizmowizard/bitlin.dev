# Bitlin

Version control, made friendly: a Git-style tool for the web. Projects, snapshots, history, restore, branches, merge, diff, remotes, collaboration, ignore rules and tags, all live-synced over WebSockets. Built with SvelteKit 3 + TypeScript on self-hosted Postgres, Redis and MinIO.

Canonical domain: **https://bitlin.dev**. See [HOSTING.md](./HOSTING.md) for deployment.

## Vocabulary

| Bitlin | Git equivalent |
| --- | --- |
| Project | repository |
| Snapshot | commit |
| Changes (staged files) | working tree + index |
| Restore | revert / checkout (adds a new snapshot, loses nothing) |
| Proposal | pull request |
| Remote, fetch, push | same |

## URLs

Users are `*username`, so there are no clashes with app routes:

```
/*alice                         profile
/*alice/demo                    project overview
/*alice/demo/files/src/a.ts?ref=dev
/*alice/demo/snapshots[/<id>]
/*alice/demo/compare?base=main&head=dev
/*alice/demo/merge?into=main&from=dev
/*alice/demo/branches  /tags[/<tag>]  /changes  /proposals[/<n>]
/*alice/demo/remotes  /collaborators  /ignore  /settings
```

`?ref=` accepts a branch, tag or snapshot id (8+ hex characters).

## Realtime architecture

- All WebSocket state (sockets, topics, presence) lives on `globalThis` (`src/lib/server/ws/hub.ts`), so every copy of the module that Vite/SvelteKit may create shares one set of connections. This is what fixes the "events from routes never reach sockets" bug.
- `server.js` contains no app logic. It only forwards HTTP upgrades to a function the SvelteKit bundle registers on `globalThis` (`Symbol.for('bitlin.ws.upgrade')`). In dev, `vite.config.ts` does the same through `ssrLoadModule`.
- Routes call `publish()` (`src/lib/server/events.ts`) which delivers locally and through Redis pub/sub for multi-instance setups.
- The client (`src/lib/ws.svelte.ts`) reconnects with backoff, resubscribes, and pages call `refresh('bitlin:...')` to invalidate only the affected loads.

## Development

```bash
cp .env.example .env      # fill in the values (or just run Postgres/Redis/MinIO locally)
npm install
npm run dev               # http://localhost:5173 (WebSocket at /ws)
npm run check             # svelte-check
npm run build && npm start
```

Defaults point at `localhost` Postgres (`bitlin:bitlin@bitlin`), Redis and MinIO (`minioadmin`). Migrations run automatically on boot (`src/lib/server/migrations/*.sql`).

## Remote protocol

Other Bitlin servers talk to `/api/sync/<owner>/<project>/…` (`refs`, `snapshots`, `blob/<hash>`, `push/begin|commit`) using a personal access token (Settings → Access tokens). Snapshot ids are content hashes and are re-verified on arrival, so history is tamper-evident.
