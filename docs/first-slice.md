# First End-to-End Slice

## Goal

Prove the narrowest possible loop:

**Capture 10 attendees from Grip → mark 3 as targets → log 1 encounter note → generate 1 follow-up draft → sync 1 HubSpot task + 1 Gmail draft**

## Included in this scaffold

### Demo Grip attendee page
`/demo/grip/attendees`

- 10 visible attendee cards
- each card has DOM data attributes for deterministic extraction
- records include name, title, company, email, and external key

### Demo Grip attendee profile page
`/demo/grip/attendees/avery-chen`

- single-person profile page example
- useful for provenance + page artifact handling on profile pages

### Demo Grip session page
`/demo/grip/sessions`

- 5 visible session cards
- each session includes speakers
- capture emits:
  - 5 session records
  - 10 speaker person records
- across both demo pages, the scaffold can produce at least 25 visible records total

### Web workspace
`/workspaces/[workspaceId]`

- captured people list
- target board
- encounter logging
- draft generation
- task + draft sync controls
- session ranking scaffold
- audit log preview

### Extension side panel
`apps/extension`

- capture current page from the active tab
- save workspace id + app URL in extension storage
- inject content script only on demand
- send a versioned capture envelope to the web app with extracted records, page provenance, a stable visible-text summary, and the page HTML snapshot

## Demo flow

1. Create the demo workspace on the home page.
2. Open the attendee demo page.
3. Use the extension side panel to capture the current page.
4. Open the session demo page.
5. Use the extension again to capture the current page.
6. Return to the workspace.
7. Mark any 3 people as targets.
8. Log one encounter note for one target.
9. Generate one follow-up draft.
10. Sync one HubSpot task.
11. Sync one Gmail draft.

## What is real vs scaffolded

### Real in this repo
- extension capture flow
- page snapshot artifact saving
- provenance attachment
- dedupe logic
- target status workflow
- encounter note persistence
- draft generation logic
- mock/live connector adapters
- audit log entries

### Scaffolded next
- Prisma-backed persistence
- OAuth token storage
- production object storage
- background worker queue execution
- real Grip selector hardening
- real transcription

## Acceptance mapping

This scaffold is designed to map directly to the acceptance tests:

- **capture 25 visible records from Grip**  
  Demo attendee + session pages together produce 25 visible attendee/speaker/session records.

- **create targets from those records**  
  Workspace target controls are in place.

- **match a useful share to HubSpot**  
  Demo deterministic matching uses seeded HubSpot directory records.

- **log an encounter note in under 15 seconds**  
  Single form with tags and target select.

- **generate a usable follow-up draft**  
  Draft uses encounter + person + event context.

- **separate met vs missed**  
  Target status controls support targeted / met / missed.

- **create a HubSpot task and Gmail draft**  
  Mock by default; live if access tokens are present.
