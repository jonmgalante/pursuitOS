# AGENTS.md

This repo is for the **conference rep copilot locked MVP**.  
Every agent and contributor must treat the decisions below as **hard defaults**, not suggestions.

## Product truth

The core object is **Target**, not lead.

A Target is someone the rep wants to meet, may or may not meet, and needs to follow up with either way.

The product must always answer five questions:

1. Who should I meet?
2. Where should I be?
3. What just happened?
4. What should I do next?
5. What should I send?

## Locked decisions

Do not change these without an ADR and explicit owner approval.

- Portal: **Grip first**
- Access model: **Chrome extension inside a live logged-in user session**
- Portal architecture: **DOM-first / browser-automation-first; screenshot fallback only**
- CRM: **HubSpot first**
- Email: **Gmail drafts first**
- Surfaces: **Chrome extension + web app + mobile-responsive web/PWA**
- AI scope: **extraction cleanup, note structuring, ranking, draft generation**
- Deterministic code owns: **auth, storage, sync, permissions, provenance, workflow state, deterministic matching**
- Vendor-managed models/tokens by default; BYO only later as an enterprise exception

## Hard v1 boundaries

Never introduce these in v1:

- autonomous mass crawling
- stored portal usernames or passwords
- unattended background browsing
- auto-send outreach
- auto-booking meetings
- Salesforce support
- multi-portal support
- native mobile app work

## Security and trust rules

Every change must preserve these:

- capture only what the logged-in user can visibly access
- no credential storage for the conference portal
- provenance on every saved record
- audit log for every capture and sync
- encrypted CRM/email tokens in the real integration path
- delete/export capability per event/workspace

## Matching policy

Always follow this order:

1. deterministic matching first
   - exact email
   - email domain
   - company name
   - known contact mapping
2. fuzzy company matching second
3. AI-assisted disambiguation only when needed
4. human review before risky merges

Do not skip directly to AI matching when deterministic evidence exists.

## Repo intent by area

### `apps/extension`
Owns the in-portal experience.

Rules:
- keep capture DOM-first
- only capture visible records
- save page-level provenance with each capture
- never assume site-wide host permissions are acceptable if `activeTab` can do the job
- prefer page snapshot artifacts over screenshots when DOM extraction succeeds

### `apps/web`
Owns the operator workspace.

Rules:
- stage the workspace around pre-event / in-event / post-event flows
- make the Target Board the canonical operating view
- keep encounter logging extremely fast
- every follow-up draft must trace back to a person and, when possible, an encounter or session note

### `apps/worker`
Owns asynchronous work once the production path is wired.

Expected job families:
- extraction cleanup
- transcription
- deterministic + fuzzy matching
- draft generation

For the current scaffold, some logic still runs inline in the web app. Move it here when the Postgres-backed path is wired.

### `packages/core`
Pure domain logic only.
No framework code, no network calls, no direct token handling.

### `packages/connectors`
External provider adapters only.
Hide provider quirks behind stable internal interfaces.

### `packages/db`
Schema, migrations, and database access scaffolding.
No business logic.

## Definition of done

A change is not done unless:

- types are explicit
- provenance is preserved
- audit log coverage exists for capture/sync changes
- risky merges still require review
- the demo slice still works
- the first slice path is not broken:
  - capture attendees from Grip
  - mark targets
  - log encounter
  - generate follow-up draft
  - sync HubSpot task
  - sync Gmail draft

## UI rules

- prioritize speed over visual flourish
- reduce taps/clicks in field mode
- use language reps already understand:
  - Target
  - Met
  - Missed
  - Speaker
  - Follow-up
- never label the primary operating object as “lead” in the MVP UI

## AI usage rules

Allowed:
- extraction cleanup
- note structuring
- session ranking explanation
- draft generation
- disambiguation assistance when deterministic methods are insufficient

Not allowed:
- hidden autonomous action
- silent contact merges
- silent sending
- silent booking
- replacing provenance with inferred values

## Testing expectations

At minimum, keep these flows healthy:

- capture a visible attendee page
- capture a visible session page
- dedupe the same person captured twice
- mark a person as must meet / nice to meet / backup
- log an encounter in one pass
- generate a usable draft from the encounter
- separate met vs missed
- create a HubSpot task
- create a Gmail draft

## File and naming guidance

- use explicit names: `target-service.ts`, `capture-batch.ts`, `hubspot.ts`
- avoid vague buckets like `helpers.ts` or `misc.ts`
- colocate route handlers with routes
- keep domain functions pure where possible
- use `why` / `reasons` arrays where the UI must explain ranking or follow-up suggestions

## What to avoid

- burying provenance inside opaque blobs with no stable access path
- coupling UI labels directly to third-party API fields
- introducing Salesforce-specific abstractions now
- overbuilding multi-event collaboration before the first single-rep slice works
- replacing deterministic control paths with agentic orchestration
