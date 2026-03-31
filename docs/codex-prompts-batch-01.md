# Codex prompts — batch 01

Use these in order. Start with Prompt 0 in Plan mode.

## Prompt 0 — plan only

```text
Read AGENTS.md first and follow it as binding.

Then read these files:
- README.md
- docs/build-charter.md
- docs/first-slice.md
- docs/repo-structure.md
- docs/revised-mvp.md
- packages/db/prisma/schema.prisma
- apps/web/lib/store.ts
- packages/portal-grip/src/extractor.ts
- apps/web/app/workspaces/[workspaceId]/page.tsx
- packages/connectors/src/hubspot.ts
- packages/connectors/src/gmail.ts

Task:
Create a planning document only. Do not change application code in this prompt.

Create docs/implementation-plan.md with:
1. a concise summary of the current scaffold state
2. the gaps between the current scaffold and the locked first slice / acceptance tests
3. 6–8 implementation milestones, each with:
   - goal
   - files likely to change
   - risks
   - validation commands
   - done criteria
4. assumptions you are making instead of asking me questions
5. a short risk section covering provenance, matching, live provider sync, and demo-vs-production persistence
6. a short “stop-and-fix” rule: if validation fails, fix before advancing

Constraints:
- preserve the locked MVP and hard boundaries from AGENTS.md
- Target remains the core object
- the extension remains capture-only
- do not expand scope beyond Grip-first, HubSpot-first, Gmail-draft-first MVP
- no code changes except docs

When done:
- summarize the plan in 8 bullets or fewer
- list files changed
- explicitly say that no runtime behavior changed
```

## Prompt 1 — repo baseline and Codex config

```text
Read AGENTS.md and docs/implementation-plan.md first.

Then read:
- package.json
- pnpm-workspace.yaml
- README.md
- .env.example
- apps/web/package.json
- apps/extension/package.json
- apps/worker/package.json

Task:
Create a clean repo baseline for local development and Codex use without changing product behavior.

Implement:
1. add a project-scoped .codex/config.toml tuned for this repo
2. add a root `pnpm check` script that runs the current build/typecheck validations in one command
3. improve README.md so a developer can:
   - install dependencies
   - run the web app
   - run the worker
   - build/watch the extension
   - load the extension in Chrome
   - complete the demo flow
4. add docs/dev-setup.md with:
   - local setup
   - expected env vars
   - Chrome extension loading steps
   - common troubleshooting notes
5. keep all behavior unchanged

Constraints:
- do not add new vendors
- do not restructure the app yet
- do not add OAuth flows yet
- keep scripts minimal and honest

Validation:
- pnpm typecheck
- pnpm build

When done:
- summarize what changed
- list files changed
- list commands run and whether they passed
- note any follow-up tasks, but do not implement them in this prompt
```

## Prompt 2 — refactor the file store into services + repository boundary

```text
Read AGENTS.md and docs/implementation-plan.md first.

Then read:
- apps/web/lib/store.ts
- all route handlers under apps/web/app/api
- packages/core/src/index.ts
- packages/core/src/types.ts
- packages/core/src/matching.ts
- packages/core/src/drafts.ts
- packages/core/src/ranking.ts

Task:
Refactor the current file-backed demo implementation into a clean service/repository architecture without changing visible behavior.

Implement:
1. introduce a repository interface for first-slice operations, including:
   - get workspace view
   - ingest capture batch
   - upsert/create target
   - update target status
   - create encounter
   - save generated draft
   - save sync task/draft results
   - read/write audit logs
   - read/write provenance/source-record metadata
2. move file-backed persistence into focused modules under apps/web/lib
3. split business logic into small service modules instead of one large store.ts
4. update API routes to call the service layer
5. preserve current demo behavior, audit logging, provenance, and dedupe logic

Constraints:
- do not wire Prisma yet
- do not change route URLs unless strictly necessary
- do not change the demo flow
- do not refactor unrelated UI code

Validation:
- pnpm typecheck
- pnpm build

When done:
- summarize the new architecture in a few bullets
- list files changed
- list validation commands run
- call out any behavior that intentionally stayed the same
```

## Prompt 3 — add an optional Prisma-backed path for the first slice

```text
Read AGENTS.md and docs/implementation-plan.md first.

Then read:
- packages/db/prisma/schema.prisma
- packages/db/prisma.config.ts
- packages/db/src/index.ts
- packages/db/README.md
- the repository/service modules created in Prompt 2
- .env.example
- docker-compose.yml

Task:
Add an optional Prisma-backed persistence path for the first slice while keeping the current file-backed mode as the default.

Implement:
1. a usable Prisma client wrapper in packages/db
2. a Prisma repository implementation for the first-slice workflows only:
   - workspace/event bootstrap
   - capture ingestion
   - person/company/session upserts
   - target creation and status changes
   - encounter creation
   - draft persistence
   - task persistence
   - audit log persistence
   - source-record/provenance metadata persistence
3. backend selection via env, with file mode as the default and Prisma mode opt-in
4. docs updates for local Postgres usage and required env vars
5. minimal migrations only if the existing schema needs adjustment for the first slice

Constraints:
- do not attempt OAuth in this prompt
- do not move artifacts into cloud storage yet
- local artifact files on disk are acceptable in dev, but persist their metadata/provenance references through the repository path
- preserve the demo flow in file mode

Validation:
- pnpm db:generate
- pnpm typecheck
- pnpm build

If a local Postgres instance is available, do a minimal manual smoke check in Prisma mode and report exactly what worked.
When done:
- summarize the file mode vs Prisma mode behavior
- list files changed
- list commands run and results
```

## Prompt 4 — harden the Grip capture pipeline

```text
Read AGENTS.md and docs/implementation-plan.md first.

Then read:
- packages/portal-grip/src/extractor.ts
- packages/portal-grip/src/selectors.ts
- packages/portal-grip/src/index.ts
- apps/extension/src/background.ts
- apps/extension/src/content.ts
- apps/extension/src/sidepanel.ts
- apps/extension/manifest.json
- apps/web/app/api/capture/route.ts
- docs/first-slice.md
- docs/revised-mvp.md

Task:
Harden the capture pipeline and make the extension-to-web payload contract explicit.

Implement:
1. shared typed message/capture contracts used by the extension and the web app
2. robust page-type detection for:
   - attendee list
   - attendee profile
   - session list
   - session detail if feasible from current scaffold
3. strict active-tab, on-demand capture only
4. better side-panel validation and user-facing success/error/loading states
5. provenance fields that include:
   - page URL
   - page title
   - page type
   - captured timestamp
   - HTML snapshot
   - stable visible-text summary
6. extractor tests or fixture-based tests using current demo Grip pages or saved HTML fixtures

Constraints:
- keep DOM-first extraction
- screenshot fallback only in principle; do not build a screenshot-heavy path here
- no autonomous browsing
- no stored portal credentials
- no broad permission creep if active-tab is enough

Validation:
- pnpm --filter @copilot/extension build
- pnpm typecheck
- run any new extractor tests you add

When done:
- summarize the capture contract
- list files changed
- list validation commands run
- note any known selector assumptions that should be revisited against real Grip pages later
```

## Prompt 5 — build the in-event field mode

```text
Read AGENTS.md and docs/implementation-plan.md first.

Then read:
- apps/web/app/workspaces/[workspaceId]/page.tsx
- apps/web/app/api/encounters/route.ts
- apps/web/app/api/targets/route.ts
- packages/core/src/types.ts
- current encounter/target service modules
- docs/revised-mvp.md

Task:
Create a dedicated mobile-responsive in-event field mode route optimized for logging an encounter in under 15 seconds.

Implement:
1. a new route at /workspaces/[workspaceId]/field
2. a fast UI for:
   - selecting a person/target quickly
   - logging a short encounter note
   - one-tap tags
   - marking met or missed
   - optionally attaching a quick session/speaker note
3. success feedback that keeps the rep in field mode after save
4. a recent activity section so the rep can confirm what was just captured
5. links between the main workspace and field mode
6. preserve traceability from note -> person/target/session when data exists

Constraints:
- no native app work
- no offline sync
- no auto-send
- prioritize speed and low friction over visual polish
- keep terminology aligned with AGENTS.md and the MVP spec

Validation:
- pnpm typecheck
- pnpm build

Also add a short manual smoke-test checklist that demonstrates how a rep can log one encounter quickly.
When done:
- summarize the field-mode UX
- list files changed
- list validations run
```

## Prompt 6 — add an OpenAI-backed note structuring + draft generation path

```text
Read AGENTS.md and docs/implementation-plan.md first.

Then read:
- packages/core/src/drafts.ts
- packages/core/src/types.ts
- apps/web/app/api/drafts/generate/route.ts
- apps/worker/src/jobs/generate-draft.ts
- current encounter, target, and workspace service modules
- .env.example

Task:
Introduce an AI service boundary for note structuring and follow-up draft generation.

Implement:
1. an OpenAI-backed service using the official Node SDK
2. use the Responses API and request structured JSON output for:
   - normalized encounter summary
   - suggested follow-up draft fields
3. keep provider-specific code out of packages/core
4. keep a deterministic fallback path when OPENAI_API_KEY is missing or the API call fails
5. save useful metadata about generation runs for audit/debugging, such as:
   - live vs fallback mode
   - timestamp
   - model name if live
6. keep generation grounded in event + person + target + encounter context
7. keep output draft-only; never send anything

Constraints:
- do not use AI for matching in this prompt
- do not silently overwrite a human-authored note
- do not add hidden autonomous actions
- keep prompts and outputs transparent enough to debug

Validation:
- pnpm typecheck
- pnpm build
- verify fallback mode works with no OPENAI_API_KEY

When done:
- summarize the service boundary
- list files changed
- list validations run
- state exactly what happens in fallback mode vs live mode
```

## Prompt 7 — harden HubSpot/Gmail sync boundaries

```text
Read AGENTS.md and docs/implementation-plan.md first.

Then read:
- packages/connectors/src/types.ts
- packages/connectors/src/hubspot.ts
- packages/connectors/src/gmail.ts
- apps/web/app/api/sync/hubspot/task/route.ts
- apps/web/app/api/sync/gmail/draft/route.ts
- current service/repository modules
- docs/first-slice.md
- .env.example

Task:
Keep mock/live mode, but harden the HubSpot and Gmail sync boundaries for the first slice.

Implement:
1. stable internal interfaces for:
   - HubSpot task creation
   - Gmail draft creation
2. explicit mock vs live mode selection
3. typed provider config/token inputs
4. redacted logging and clearer error handling
5. audit log entries for sync attempt, success, and failure
6. HubSpot task creation should use matched contact metadata when available
7. Gmail path must only create a draft and must never send

Constraints:
- do not build OAuth UI in this prompt
- assume access tokens/config arrive from env or a stub token provider
- no auto-send
- no silent retries that hide failures

Validation:
- pnpm typecheck
- pnpm build

When done:
- summarize the sync contract
- list files changed
- list validations run
- document the exact env vars/manual steps needed for future live verification
```

## Prompt 8 — add a repeatable first-slice smoke test

```text
Read AGENTS.md and docs/implementation-plan.md first.

Then read:
- docs/first-slice.md
- docs/revised-mvp.md
- README.md
- demo Grip pages under apps/web/app/demo/grip
- current API routes and service modules
- current connector modules

Task:
Add a repeatable local smoke test harness for the first slice.

Implement either a script or a test flow that can deterministically do the following without real OAuth:
1. create or seed a workspace
2. capture the demo attendee page
3. capture the demo session page
4. verify at least 25 records were captured
5. mark 3 people as targets
6. log 1 encounter
7. generate 1 follow-up draft
8. create 1 mock HubSpot task
9. create 1 mock Gmail draft
10. verify met vs missed separation and audit log entries

Deliverables:
- a root script such as `pnpm smoke:first-slice`
- clear test output
- README/docs updates explaining how to run it and interpret failures

Constraints:
- prefer deterministic local execution
- do not require real provider credentials
- do not depend on manual browser clicking for the smoke harness

Validation:
- run the new smoke command
- run pnpm typecheck
- run pnpm build

When done:
- summarize what the smoke test covers
- list files changed
- list commands run and results
```
