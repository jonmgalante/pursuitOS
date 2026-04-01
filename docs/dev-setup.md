# Developer Setup

## Local Setup

1. Run `pnpm install`.
2. Copy `.env.example` to `.env`.
3. Run `pnpm db:generate`.
4. Run `pnpm check` to confirm the baseline build and typecheck pass.
5. Start the web app with `pnpm dev:web`.
6. Run `pnpm dev:worker` only if you want to inspect the current worker scaffold output. It prints placeholder jobs and exits.
7. Run `pnpm dev:extension` for watch mode, or `pnpm --filter @copilot/extension build` for a one-off build.

## Expected Environment Variables

- None are required for the default demo-first file-backed flow.
- `HUBSPOT_SYNC_MODE=live` plus `HUBSPOT_ACCESS_TOKEN` enables live HubSpot task creation. Leave `HUBSPOT_SYNC_MODE` unset or set it to `mock` for the default deterministic mock path.
- `GMAIL_SYNC_MODE=live` plus `GMAIL_ACCESS_TOKEN` enables live Gmail draft creation. Leave `GMAIL_SYNC_MODE` unset or set it to `mock` for the default deterministic mock path.
- `COPILOT_FIRST_SLICE_BACKEND=prisma` opts the web app into the Prisma-backed first-slice repository. Leave it unset for the default file-backed flow.
- `DATABASE_URL` is optional if you use the bundled `docker-compose.yml` Postgres defaults. It is required only when your local Postgres URL differs from `postgresql://copilot:copilot@localhost:5432/conference_copilot`.

No OAuth UI is implemented in this slice. Live sync tokens must come from env today or a future stub token provider.

## Optional Local Postgres For Prisma Mode

File mode remains the default and is what the smoke harness uses.

If you want to verify the Prisma-backed path locally:

1. Start Postgres with `docker compose up -d postgres`.
2. Set `COPILOT_FIRST_SLICE_BACKEND=prisma` in `.env`.
3. Set `DATABASE_URL` only if you are not using the bundled Postgres defaults.
4. Run `pnpm db:generate`.
5. Run `pnpm --filter @copilot/db prisma db push`.
6. Start the web app with `pnpm dev:web`.

In Prisma mode, page HTML artifacts still stay on local disk in `apps/web/.artifacts` unless you override `COPILOT_ARTIFACTS_DIR`, while the database stores the artifact metadata and references.

## Loading the Chrome Extension

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select `apps/extension/dist`.
5. Open the extension side panel from the toolbar.
6. Confirm the web app URL is `http://localhost:3000` and the workspace ID is `ws_demo_summit_2026`.
7. Use the capture action on a visible Grip demo page.
8. If you rebuild the extension while Chrome is open, click Reload on the extension before testing again.

## Demo Flow

1. Open `http://localhost:3000`.
2. Create or open the demo workspace.
3. Visit `/demo/grip/attendees` and capture the page from the extension.
4. Visit `/demo/grip/sessions` and capture that page too.
5. Return to `/workspaces/ws_demo_summit_2026`.
6. Mark targets, log an encounter, generate a follow-up draft, create a HubSpot task, and create a Gmail draft.

## Manual Live Sync Verification

Do not use live credentials for the required milestone validations. Keep `pnpm check` and `pnpm smoke:first-slice` in mock mode.

When you intentionally verify live sync later:

1. Set `HUBSPOT_SYNC_MODE=live` and `HUBSPOT_ACCESS_TOKEN=<token>` in `.env`.
2. Set `GMAIL_SYNC_MODE=live` and `GMAIL_ACCESS_TOKEN=<token>` in `.env`.
3. Restart `pnpm dev:web`.
4. Run the browser demo flow through draft generation.
5. Use Avery Chen or Jordan Kim so the HubSpot sync path has deterministic matched-contact metadata available.
6. Sync the HubSpot task and confirm the task exists in HubSpot and is associated to the matched contact when that contact id exists locally.
7. Sync the Gmail draft and confirm a draft appears in the connected Gmail mailbox.

Credential notes:

- The HubSpot token must be able to create CRM tasks.
- The Gmail token must permit draft creation. Gmail `users.drafts.create` accepts `https://www.googleapis.com/auth/gmail.compose`, `https://www.googleapis.com/auth/gmail.modify`, or `https://mail.google.com/`.
- Gmail remains draft-only in this code path. There is no send call and no OAuth UI in this slice.

## Automated Smoke Harness

Run `pnpm smoke:first-slice` from the repo root for the repeatable first-slice regression check.

The harness:

- runs in isolated file mode by default
- forces mock HubSpot and Gmail sync even if live sync mode env vars or access tokens are present
- captures the demo attendee and session pages with the current Grip extractor
- drives the current target, encounter, draft, and sync routes without manual browser clicking
- verifies the 25-record capture floor, met vs missed separation, and audit log coverage for capture and sync

If the smoke command fails, treat it as a broken first-slice path. The output tells you which step failed and what to inspect first.

## Troubleshooting

- If the extension side panel opens but capture fails, confirm the active tab is a demo Grip page and that the web app URL matches the local server.
- If capture requests do not reach the web app, keep the web app on `http://localhost:3000`; the extension manifest currently grants host access only for that origin.
- If the web app shows an empty workspace, seed the demo workspace again from the home page or `POST /api/demo/seed`.
- If extension code changes do not appear in Chrome, wait for the watch rebuild to finish and then reload the extension in `chrome://extensions`.
- If HubSpot or Gmail calls fail in live mode, remove the access token to fall back to deterministic mock behavior while debugging.
- If HubSpot or Gmail do not switch to live mode when you expect them to, confirm both the sync mode env var and the access token are set before restarting the web app.
- If Prisma mode fails to boot, confirm Postgres is running, `pnpm db:generate` has completed, and `pnpm --filter @copilot/db prisma db push` has been applied to the target database.

## Do Not Commit Generated Artifacts

- Do not commit `.env` or any local env variant other than `.env.example`.
- Do not commit `node_modules`, `.pnpm-store`, `coverage`, or debug logs.
- Do not commit generated app output such as `apps/web/.next`, `apps/web/.data`, `apps/web/.artifacts`, `apps/extension/dist`, or `apps/worker/dist`.
