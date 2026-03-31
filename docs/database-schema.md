# Database Schema Notes

The canonical schema lives at:

`packages/db/prisma/schema.prisma`

## Why the schema is shaped this way

### Event + Workspace
`Event` is the shared conference object.  
`Workspace` is the rep-operating context for that event.

This keeps room for future multi-user collaboration without polluting the MVP surface.

### CaptureBatch + SourceRecord + Artifact
These three tables are the provenance spine.

- `CaptureBatch` = one page capture action
- `SourceRecord` = one extracted visible record from that page
- `Artifact` = saved page HTML / screenshot / audio / transcript

This lets every person/session/company record trace back to:
- page URL
- page type
- capture timestamp
- extraction method
- saved artifact

### Person / Company / Session
These are the normalized workspace objects after capture.

### Target
This is the operating object and should remain lightweight:
- priority: must meet / nice to meet / backup
- status: targeted / met / missed
- why: explanation array for the rep

### Encounter + SessionNote
These are the in-event memory objects:
- quick human-written note
- optional voice/transcript artifacts
- structured summary JSON for downstream use

### FollowUpDraft + Task
These hold the outbound next steps:
- Gmail draft sync id
- HubSpot task sync id
- sync state
- source linkage back to person / target / encounter

### CrmMatch
Separates CRM matching state from the base person record so risky or uncertain matches can be reviewed.

### AuditLog
Every capture and sync path should write here.

## Production note

The current web demo uses a file-backed store for the first slice.  
The Prisma schema is the target production shape and already reflects the locked MVP object model.
