# Conference Rep Copilot MVP

This repository is the locked MVP scaffold for a conference rep copilot:

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

## Current scaffold status

- The first slice is demoable now through a file-backed store in `apps/web/lib/store.ts`.
- The extension captures visible Grip demo pages from the active tab into the web workspace.
- HubSpot task creation and Gmail draft creation run in mock mode unless you set access tokens in `.env`.
- The worker and Prisma/Postgres paths are scaffolded and are not required for the current demo flow.

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm check
```

`.env` can stay empty for the default demo-first flow. Add `HUBSPOT_ACCESS_TOKEN` or `GMAIL_ACCESS_TOKEN` only if you want live sync instead of deterministic mock behavior. `DATABASE_URL` is only for `packages/db` tooling and is not needed for the local demo.

## Run the apps

```bash
pnpm dev:web

# worker scaffold; prints placeholder jobs and exits
pnpm dev:worker

# extension watch build
pnpm dev:extension
```

Use `pnpm --filter @copilot/extension build` if you only want a one-off extension build.

## Load the extension in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select `apps/extension/dist`.
5. Open the side panel from the toolbar and keep the web app URL at `http://localhost:3000`.
6. Use workspace ID `ws_demo_summit_2026`.

If you are running `pnpm dev:extension`, Chrome will still need an extension reload after each rebuilt change.

## First local demo flow

1. Open `http://localhost:3000`.
2. Click **Create or open demo workspace**.
3. Open `http://localhost:3000/demo/grip/attendees` and capture the page from the extension side panel.
4. Open `http://localhost:3000/demo/grip/sessions` and capture that page too.
5. Return to `http://localhost:3000/workspaces/ws_demo_summit_2026`.
6. Mark three people as Targets.
7. Log one encounter.
8. Generate one follow-up draft.
9. Create one HubSpot task and one Gmail draft.

The default sync mode is mock. Gmail remains draft-only even when a live token is present.

## Baseline validation

```bash
pnpm check
```

`pnpm check` runs the current baseline validations only: `pnpm typecheck` and `pnpm build`.

## Automated smoke harness

Run the first-slice smoke harness with:

```bash
pnpm smoke:first-slice
```

The smoke harness runs entirely in isolated file mode with mock HubSpot and Gmail sync. It does not require manual browser clicking, Chrome, real OAuth, or external network access.

It covers the current first slice end to end:

- seed the demo workspace
- capture the demo Grip attendee page
- capture the demo Grip session page
- verify at least 25 attendee/speaker/session source records
- mark 3 people as targets
- log 1 encounter through the current route/service path
- generate 1 follow-up draft through the current non-live path
- create 1 mock HubSpot task
- create 1 mock Gmail draft
- verify met vs missed separation
- verify audit log coverage for capture and sync

A smoke failure means the existing first-slice regression path is broken somewhere in capture, target workflow, encounter logging, draft generation, sync, provenance, or audit logging. The command prints the failing step and a targeted hint for where to look first.

## Generated local artifacts

Do not commit local runtime/build output such as:

- `apps/web/.data`
- `apps/web/.artifacts`
- `apps/web/.next`
- `apps/extension/dist`
- `apps/worker/dist`
- `.env`

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
