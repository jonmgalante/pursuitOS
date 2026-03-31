# Build Charter — Conference Rep Copilot MVP

## 1. Product mission

Build a stage-based rep copilot that works inside an authorized conference portal session, unifies attendees / speakers / sessions into one workspace, helps the rep decide who to meet and where to go, captures what happened during the event, and turns that into fast follow-up.

## 2. Primary user

A quota-carrying rep attending an event who needs one operating system for:

- pre-event planning
- in-event capture
- post-event follow-up

## 3. Core object

The core object is **Target**, not lead.

A Target is someone the rep wants to meet, may or may not meet, and needs to follow up with either way.

This choice drives the whole product:

- pre-event: build the target list
- in-event: update targeted → met / missed
- post-event: generate follow-up for both met and missed targets

## 4. Product promise

The product must reliably answer:

1. Who should I meet?
2. Where should I be?
3. What just happened?
4. What should I do next?
5. What should I send?

## 5. Locked MVP scope

### In scope, in priority order

1. **Event Workspace + Portal Agent**
   - Grip first
   - capture visible attendee, speaker, and session records
   - save search results pages and profile pages
   - attach provenance to every saved record

2. **Target Board**
   - dedupe people
   - CRM match
   - mark must meet / nice to meet / backup
   - track targeted / met / missed

3. **Session Planner**
   - rank sessions by rep relevance
   - highlight target speakers
   - show why each session matters

4. **Pre-event Outreach Drafting**
   - draft-only in v1
   - no auto-send

5. **In-event Mobile Field Mode**
   - quick encounter note
   - quick session/speaker note
   - voice note + transcript
   - one-tap tags

6. **Post-event Follow-up Console**
   - met queue
   - missed queue
   - speaker follow-up queue
   - summaries, next steps, drafts

7. **CRM + Email Sync**
   - HubSpot first
   - Gmail drafts first
   - Salesforce later

### Out of scope for v1

- autonomous mass crawling
- stored conference credentials
- unattended background browsing
- auto-send outreach
- auto-booking meetings
- Salesforce
- multi-portal support
- native mobile app

## 6. Locked technical/product decisions

- Portal: **Grip first**
- Access model: **browser extension inside a live user session**
- Portal architecture: **DOM-first / browser-automation-first; screenshot fallback only**
- CRM: **HubSpot first**
- Email: **Gmail drafts first**
- Surfaces: **Chrome extension + web app + mobile-responsive web/PWA**
- Models/tokens: **vendor-managed by default**
- AI scope: **cleanup, note structuring, ranking, draft generation**
- Deterministic code owns: **auth, storage, sync, permissions, provenance, workflow state, deterministic matching**

## 7. Core principles

### Human-in-the-loop
The rep always chooses what to capture, who becomes a target, what gets sent, and what gets synced.

### Trust through provenance
Every saved record must retain where it came from:
- portal
- page URL
- page type
- capture time
- extraction method
- page artifact

### Deterministic workflow state
Anything that changes customer state or system state must be deterministic and auditable.

### Draft-first communications
All outreach is reviewable before anything leaves the system.

### Stage-based UX
The product should feel different in pre-event, in-event, and post-event mode.

## 8. Success criteria

The MVP is not working until it can:

- capture 25 visible attendee / speaker / session records from Grip
- create targets from those records
- match a useful share to HubSpot
- log an encounter note in under 15 seconds
- generate a usable follow-up draft from that note
- separate people into met vs missed
- create a HubSpot task and Gmail draft successfully

## 9. First end-to-end slice

Build this first:

**Capture 10 attendees from Grip → mark 3 as targets → log 1 encounter note → generate 1 follow-up draft → sync 1 task to HubSpot and 1 draft to Gmail**

Why this slice first:

- it validates the core object (Target)
- it proves provenance capture
- it proves the pre → in → post loop
- it forces CRM and email integration without overbuilding scheduling or automation

## 10. Architecture for the MVP

### User surface
- Chrome extension for in-portal capture
- Next.js web app for workspace + console
- mobile-responsive web/PWA for field use

### Core systems
- Postgres for system of record
- file/object storage for artifacts
- background worker for extraction cleanup, transcription, matching, draft generation

### Capture path
1. rep is logged into Grip
2. extension captures visible DOM records
3. page artifact + provenance are saved
4. records land in the workspace
5. records are deduped and matched
6. rep marks targets and operates from the Target Board

## 11. Key risks and mitigations

### Risk: Grip DOM volatility
Mitigation:
- adapter isolation
- selector versioning
- provenance on every capture
- screenshot fallback only when DOM fails

### Risk: bad merges
Mitigation:
- deterministic match first
- human review for risky merges
- audit log for merge-affecting actions

### Risk: user trust
Mitigation:
- no hidden sending
- no hidden booking
- provenance everywhere
- draft-only outbound in v1

### Risk: field friction
Mitigation:
- optimize for <15 second encounter capture
- one-tap tags
- short-path forms
- stage-aware UI

## 12. Build sequence

### Phase 0 — foundation
- repo scaffold
- build charter
- AGENTS.md
- schema
- demo capture pages
- extension + web shell

### Phase 1 — workspace capture
- capture batches
- source records
- provenance + artifacts
- visible record ingestion

### Phase 2 — target workflow
- dedupe
- CRM match
- target board
- met vs missed state

### Phase 3 — in-event notes
- quick encounter notes
- speaker/session notes
- tags
- transcript placeholders

### Phase 4 — follow-up
- draft generation
- met queue / missed queue / speaker queue
- HubSpot task sync
- Gmail draft sync

## 13. Definition of shipped MVP

The MVP is ready for first real users when a rep can use it at one real Grip-backed event and finish the conference with:

- a clean target list
- clear met vs missed status
- encounter notes tied to people
- usable follow-up drafts
- at least one real HubSpot task and one real Gmail draft created from the workflow
