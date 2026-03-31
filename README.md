# Conference Rep Copilot MVP

This repository is a starter monorepo for the locked MVP:

- a Chrome extension that works inside an authorized conference portal session
- a Next.js web app for the event workspace
- a worker scaffold for extraction, transcription, matching, and drafts
- a Postgres-first database schema
- a demo-first end-to-end slice that can run without external services

## What is already included

- **Build Charter** in `docs/build-charter.md`
- **AGENTS.md** at the repo root
- **Repo structure** in `docs/repo-structure.md`
- **Prisma/Postgres schema** in `packages/db/prisma/schema.prisma`
- **Chrome extension scaffold** in `apps/extension`
- **Next.js workspace scaffold** in `apps/web`
- **Worker scaffold** in `apps/worker`
- **First end-to-end demo slice**:
  - create a demo workspace
  - open demo Grip attendee and session pages
  - capture visible records with the extension
  - mark targets
  - log an encounter
  - generate a follow-up draft
  - sync a HubSpot task and Gmail draft in mock mode by default

## Important implementation note

The first slice is intentionally split into two layers:

1. **Demo-runnable layer**  
   The web app uses a file-backed store in `apps/web/lib/store.ts` so the first slice works immediately without Postgres or OAuth.

2. **Production schema + connector layer**  
   The Prisma schema, worker app, and HubSpot/Gmail connector modules are scaffolded for the production path, but they are not fully wired into the web app yet.

That means the repo is honest about what is complete today:
- the end-to-end flow is demoable now
- the production persistence and auth token flows are scaffolded next

## Quick start

```bash
pnpm install
cp .env.example .env

# optional: for the future Postgres-backed path
docker compose up -d postgres

# web app
pnpm dev:web

# worker scaffold
pnpm dev:worker

# extension build
pnpm dev:extension
```

Then:

1. open `http://localhost:3000`
2. create the demo workspace
3. open:
   - `http://localhost:3000/demo/grip/attendees`
   - `http://localhost:3000/demo/grip/sessions`
4. load `apps/extension/dist` as an unpacked extension in Chrome
5. set the workspace id in the side panel
6. click **Capture current page**
7. return to the workspace page and complete the target / encounter / draft / sync flow

## Repo principles

- Target is the core object, not lead
- DOM-first capture, screenshot fallback only
- no stored portal credentials
- no unattended browsing
- provenance on every record
- audit log on every capture and sync
- deterministic matching first
- draft-only outreach in v1
- HubSpot first, Gmail drafts first, Salesforce later
