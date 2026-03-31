# Developer Setup

## Local Setup

1. Run `pnpm install`.
2. Copy `.env.example` to `.env`.
3. Run `pnpm check` to confirm the baseline build and typecheck pass.
4. Start the web app with `pnpm dev:web`.
5. Run `pnpm dev:worker` if you want to inspect the current worker scaffold output. It prints placeholder jobs and exits.
6. Build the extension with `pnpm dev:extension` for watch mode or `pnpm --filter @copilot/extension build` for a one-off build.

## Expected Environment Variables

- None are required for the default demo-first file-backed flow.
- `HUBSPOT_ACCESS_TOKEN` enables live HubSpot task creation instead of mock mode.
- `GMAIL_ACCESS_TOKEN` enables live Gmail draft creation instead of mock mode.
- `DATABASE_URL` is only needed for `packages/db` Prisma tooling and is not part of the current web demo flow.

## Loading the Chrome Extension

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select `apps/extension/dist`.
5. Open the extension side panel from the toolbar.
6. Confirm the web app URL is `http://localhost:3000`.
7. Confirm the workspace ID is `ws_demo_summit_2026`.
8. Use the capture action on a visible Grip demo page.
9. If you rebuild the extension while Chrome is open, click Reload on the extension before testing again.

## Demo Flow

1. Open `http://localhost:3000`.
2. Create or open the demo workspace.
3. Visit `/demo/grip/attendees` and capture the page from the extension.
4. Visit `/demo/grip/sessions` and capture that page too.
5. Return to `/workspaces/ws_demo_summit_2026`.
6. Mark targets, log an encounter, generate a follow-up draft, create a HubSpot task, and create a Gmail draft.

## Troubleshooting

- If `pnpm check` fails, fix that baseline issue before starting the demo flow.
- If the extension side panel opens but capture fails, confirm the active tab is a demo Grip page and that the web app URL matches the local server.
- If capture requests do not reach the web app, keep the web app on `http://localhost:3000`; the extension manifest currently grants host access only for that origin.
- If the web app shows an empty workspace, seed the demo workspace again from the home page or `POST /api/demo/seed`.
- If extension code changes do not appear in Chrome, wait for the watch rebuild to finish and then reload the extension in `chrome://extensions`.
- If HubSpot or Gmail calls fail in live mode, remove the access token to fall back to deterministic mock behavior while debugging.

## Do Not Commit Generated Artifacts

- Do not commit `.env` or any local env variant other than `.env.example`.
- Do not commit `node_modules`, `.pnpm-store`, `coverage`, or debug logs.
- Do not commit generated app output such as `apps/web/.next`, `apps/web/.data`, `apps/web/.artifacts`, `apps/extension/dist`, or `apps/worker/dist`.
