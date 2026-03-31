Conference Rep Copilot — Revised MVP
Product definition

A stage-based rep copilot for conferences that helps a rep decide who to meet before the event, capture what happened during the event, and generate fast follow-up after the event.

The primary product is a web workspace. A lightweight browser capture companion is used only when the rep is already inside an authorized conference portal. During the event, the rep uses a fast mobile-responsive field mode for notes and follow-up capture.

Core design principle

The core object is Target, not lead.

A Target is someone the rep wants to meet, may or may not meet, and needs to follow up with either way.

Product modes
Pre-event mode

Answer:

Who should I meet?
Where should I be?
What should I send before the event?
In-event mode

Answer:

What just happened?
Who did I meet?
What do I need to remember before the next interaction?
Post-event mode

Answer:

Who did I meet?
Who did I miss?
What should I do next?
What should I send?
Primary surfaces
1. Web app

The web app is the main product surface and the canonical workspace.

It is where the rep:

views the event workspace
manages the target board
reviews session recommendations
sees met vs missed queues
generates follow-up summaries, tasks, and drafts
2. Browser capture companion

A Chrome extension side panel is used only for authorized in-session capture from Grip.

It:

works inside the rep’s live logged-in portal session
captures only what the user can currently see
saves visible attendees, speakers, sessions, results pages, and profile pages
attaches provenance to every captured record

It does not:

store conference usernames or passwords
browse autonomously
crawl in the background
act outside the active user session
3. Mobile-responsive field mode / PWA

This is the in-event surface.

It is optimized for:

quick encounter notes
quick speaker/session notes
voice note + transcript
one-tap tags
fast post-meeting follow-up capture
Locked MVP

The MVP is a conference rep copilot that:

captures visible attendee, speaker, and session records from Grip into one workspace
helps the rep decide who to meet and where to go
lets the rep quickly log what happened during the event
turns those notes into fast follow-up
syncs tasks to HubSpot and drafts to Gmail
Locked default decisions
Portal: Grip first
Access model: on-demand capture companion inside a live user session
Primary product surface: web app first
In-event surface: mobile-responsive web / PWA
Browser role: capture companion only, not the primary workspace
Portal architecture: DOM-first, browser-automation-first on the active page; screenshot fallback only
CRM: HubSpot first
Email: Gmail drafts first
Salesforce: later
Models/tokens: vendor-managed by default; BYO only later as an enterprise exception
AI scope: extraction cleanup, note structuring, ranking, summarization, and draft generation
Deterministic code handles: auth, storage, sync, permissions, provenance, workflow state, and deterministic matching
In-scope MVP features, in priority order
1. Grip Capture Companion + Event Workspace
capture visible attendee, speaker, and session records from Grip
save search results pages and profile pages
store all captured records in an event workspace
attach provenance to every record
preserve source artifacts for auditability
2. Target Board
dedupe people
CRM match
mark must meet / nice to meet / backup
track targeted / met / missed
3. Session Planner
rank sessions by rep relevance
highlight target speakers
show why each session matters
4. Pre-event Outreach Drafting
draft-only in v1
no auto-send
5. In-event Field Mode
quick encounter note
quick session note
quick speaker note
voice note + transcript
one-tap tags
note capture in under 15 seconds
6. Post-event Follow-up Console
met queue
missed queue
speaker follow-up queue
generate summaries, next steps, tasks, and drafts
7. CRM + Email Sync
HubSpot first
Gmail drafts first
Salesforce later
Out of scope for v1
no autonomous mass crawling
no stored conference credentials
no unattended background browsing
no auto-send outreach
no auto-booking meetings
no Salesforce in v1
no multi-portal support in v1
no native mobile app in v1
Core objects
Event
Person
Company
Session
Target
Encounter
SessionNote
FollowUpDraft
Task
SourceRecord
Provenance
Matching policy
deterministic matching first: email, domain, company name, known contact
fuzzy company matching second
AI-assisted disambiguation only when needed
human review before risky merges
Security and trust rules
no stored portal usernames or passwords
capture only what the logged-in user can see
provenance on every saved record
audit log for every capture and sync
encrypted CRM and email tokens
delete/export capability per event workspace
First end-to-end slice to build

Build this first:

From a live Grip session, capture 10 attendees into an event workspace
Mark 3 of them as targets
Log 1 encounter note in field mode
Generate 1 follow-up draft from that note
Sync 1 task to HubSpot
Save 1 draft to Gmail
Acceptance tests

The MVP is not working until it can:

capture 25 visible attendee, speaker, or session records from Grip
create targets from captured records
match a useful share of those people to HubSpot
log an encounter note in under 15 seconds
generate a usable follow-up draft from that note
separate people into met vs missed
create a HubSpot task successfully
create a Gmail draft successfully
Technical defaults
TypeScript monorepo
Next.js web app
Chrome extension in TypeScript for capture only
mobile-responsive web / PWA for field mode
Postgres
background worker for extraction, transcription, matching, and draft generation
object/file storage for source artifacts and transcripts
Product framing

This is a stage-based conference rep copilot with three operating modes:

Pre-event workspace
In-event field mode
Post-event follow-up console

The product must reliably answer:

Who should I meet?
Where should I be?
What just happened?
What should I do next?
What should I send?
One-line positioning

A conference rep copilot that uses an authorized portal capture companion for intake, a web workspace for planning and follow-up, and a fast field mode for real-time event notes.

The biggest change here is that the extension is no longer “the product.” It is just the compliant capture layer. That makes the behavior much more natural for reps while keeping your Grip ingestion path intact.
