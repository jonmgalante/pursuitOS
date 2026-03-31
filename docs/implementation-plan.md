# Implementation Plan — Locked MVP First-Slice Sequence

## Summary

- Keep the current demo-first first slice runnable in file mode while layering in cleaner boundaries and optional production paths.
- Preserve the locked MVP defaults from `AGENTS.md`: Target-first, Grip-first, extension capture-only, HubSpot-first, Gmail-draft-first, provenance everywhere.
- Implement the prompt sequence in this order: Prompt 1, Prompt 2, Prompt 4, Prompt 8, Prompt 3, Prompt 5, Prompt 6, Prompt 7.
- Treat the current scaffold as the truth baseline: `pnpm typecheck` and `pnpm build` were green on 2026-03-31.

## Current Scaffold State

- The default first slice runs entirely through a file-backed store in `apps/web/lib/store.ts`.
- The web app is the canonical workspace, and the extension already captures visible Grip pages through `activeTab` and on-demand script injection.
- The demo flow already supports capture, target marking, encounter logging, draft generation, and mock-or-live HubSpot/Gmail sync.
- The Prisma schema already models the intended production shape, but the web app does not use it yet.
- The worker package is scaffold-only; matching, note structuring, and draft generation still run inline or deterministically in the web app.

## Locked Constraints

- Target remains the core object; do not reintroduce “lead” as the primary operating object.
- Grip remains the only portal in scope.
- The extension remains capture-only inside a live logged-in user session.
- Capture remains DOM-first with screenshot fallback only.
- HubSpot remains the only CRM target in v1.
- Gmail draft creation remains the only email sync target in v1 and must never send mail.
- Deterministic code continues to own auth, storage, sync, permissions, provenance, workflow state, and deterministic matching.
- Every capture and sync path must preserve provenance and auditability.
- No autonomous browsing, stored portal credentials, auto-send, auto-booking, Salesforce, multi-portal work, or native mobile work.

## Gaps

- The current first slice is demoable, but most behavior is concentrated in one large store module rather than a repository/service boundary.
- The extension-to-web capture contract is implicit rather than shared and explicitly typed.
- The extractor lacks fixture-based regression coverage.
- There is no deterministic smoke harness for the full first slice.
- Prisma mode is not implemented.
- There is no dedicated field-mode route for sub-15-second encounter capture.
- AI-backed note structuring and draft generation boundaries do not exist yet.
- HubSpot and Gmail sync paths are still thin and need explicit mock/live boundaries plus richer audit coverage.

## Milestones

### Prompt 1 — Repo baseline and Codex config

- Goal: add repo-local docs/config and a single baseline `pnpm check` command without changing product behavior.
- Likely changes: root docs/config files, `package.json`, `.env.example`, and `README.md`.
- Risks: doc drift, a wrapper command that masks failures, accidental runtime changes from setup edits.
- Validations: `pnpm typecheck`, `pnpm build`, `pnpm check`.
- Done: setup is explicit, Codex config is repo-scoped, and current behavior is unchanged.

### Prompt 2 — File store into repository + services

- Goal: split the monolithic file-backed workflow into explicit repository and service boundaries while preserving the demo flow exactly.
- Likely changes: `apps/web/lib`, API route handlers, and shared first-slice types.
- Risks: breaking provenance or audit writes, changing dedupe semantics, altering route behavior.
- Validations: `pnpm typecheck`, `pnpm build`.
- Done: first-slice operations flow through a clear repository/service interface and file mode still behaves the same.

### Prompt 4 — Harden the Grip capture pipeline

- Goal: make the extension-to-web capture contract explicit and harden Grip extraction without expanding permissions.
- Likely changes: `packages/portal-grip`, `apps/extension/src`, extension manifest, shared capture contracts, and capture API validation.
- Risks: selector regressions, permission creep, mismatched provenance fields between extension and server.
- Validations: `pnpm --filter @copilot/extension build`, `pnpm typecheck`, `pnpm build`, extractor tests.
- Done: typed shared contract, stronger page detection, better side-panel states, richer provenance, active-tab-only capture.

### Prompt 8 — Add a repeatable first-slice smoke test

- Goal: lock the current first slice into a deterministic local smoke harness before alternate persistence and later UX/service work.
- Likely changes: root smoke script, test/support modules, README/docs.
- Risks: bypassing real service paths, overfitting to mock data, depending on manual browser steps.
- Validations: `pnpm smoke:first-slice`, `pnpm typecheck`, `pnpm build`.
- Done: one command seeds a workspace, captures demo pages, verifies 25+ records, marks targets, logs an encounter, generates a draft, creates mock sync outputs, and verifies audit coverage.

### Prompt 3 — Add optional Prisma-backed persistence

- Goal: implement Prisma mode as an opt-in first-slice backend while keeping file mode as the default.
- Likely changes: `packages/db`, repository implementations, backend-selection env handling, and local Postgres docs.
- Risks: breaking file mode, schema/repository mismatch, losing artifact or provenance links.
- Validations: `pnpm db:generate`, `pnpm typecheck`, `pnpm build`, smoke verification in file mode, optional local Prisma-mode smoke.
- Done: file mode stays default and green; Prisma mode can execute the first-slice workflows through the same repository/service contract.

### Prompt 5 — Build the in-event field mode

- Goal: add a dedicated fast field-mode route for encounter capture without disturbing the canonical workspace view.
- Likely changes: `/workspaces/[workspaceId]/field`, encounter/target services, and cross-links from the main workspace.
- Risks: duplicated workflow logic, broken note-to-target traceability, extra friction in the capture path.
- Validations: `pnpm typecheck`, `pnpm build`, manual field-mode smoke checklist.
- Done: reps can stay in field mode, log a note quickly, mark met/missed, add tags, optionally add session/speaker context, and see recent activity.

### Prompt 6 — Add the OpenAI-backed note structuring + draft path

- Goal: introduce an AI service boundary for note structuring and draft generation while keeping a deterministic fallback path.
- Likely changes: generation services, worker-facing boundaries, API/service wiring, env docs, audit/debug metadata.
- Risks: silent output changes, unclear fallback behavior, provider logic leaking into `packages/core`.
- Validations: `pnpm typecheck`, `pnpm build`, fallback verification with no `OPENAI_API_KEY`.
- Done: live vs fallback is explicit, generation metadata is recorded, and the system remains draft-only.

### Prompt 7 — Harden HubSpot/Gmail sync boundaries

- Goal: keep mock/live mode but make sync contracts explicit, typed, auditable, and safe.
- Likely changes: `packages/connectors`, sync services, sync routes, env/config docs, audit logging.
- Risks: token leakage, accidental send semantics on Gmail, drift between mock and live behavior.
- Validations: `pnpm typecheck`, `pnpm build`, smoke harness in mock mode.
- Done: sync interfaces are stable and typed, mock/live selection is explicit, audit logs capture attempt/success/failure, and Gmail only creates drafts.

## Regression Protection

- Stop-and-fix rule: if a required validation fails at a milestone, fix that failure before moving to the next milestone.
- The default demo path must keep working: capture -> target -> encounter -> draft -> HubSpot task -> Gmail draft.
- Target terminology, met/missed state handling, extension capture-only behavior, file-mode default behavior, provenance storage, artifact saving, and mock provider operation must not regress.
- Commands that must remain green:
  - always: `pnpm typecheck`, `pnpm build`
  - from Prompt 1 onward: `pnpm check`
  - from Prompt 4 onward: `pnpm --filter @copilot/extension build` plus extractor tests
  - from Prompt 8 onward: `pnpm smoke:first-slice`
  - from Prompt 3 onward: `pnpm db:generate`

## Assumptions

- The prompt definitions in `docs/codex-prompts-batch-01.md` remain authoritative, but the sequence above is the locked execution order.
- The demo Grip pages remain the canonical extractor fixtures and smoke-test inputs until real Grip HTML is introduced.
- File mode remains the default runtime even after Prisma mode is added.
- Live HubSpot/Gmail verification stays manual and env-driven; OAuth UI/token storage remains out of scope for this phase.
- The main workspace route remains the canonical operating view, and field mode is additive rather than a replacement.

## Focused Risks

- Provenance: do not flatten source traceability when moving logic into repositories or Prisma.
- Matching: preserve deterministic precedence and keep risky merges reviewable.
- Mock vs live providers: keep mock mode deterministic while making live mode explicit and auditable.
- File mode vs Prisma mode: both backends must behave the same through the shared contract.
- Extension permissions: stay within the current `activeTab`-first model unless a later real requirement proves otherwise.
