# Grip Selector Notes

This repo keeps Grip capture DOM-first and visible-only.

## Current selector assumptions

- attendee cards expose either stable card attributes such as `data-grip-card-type="attendee"` / `data-attendee-name` or text fields close to the current demo fixtures
- session cards expose `data-grip-card-type="session"` or equivalent `data-session-*` attributes, with speaker names available either in `data-speakers` or visible speaker pills
- page-level type detection prefers explicit `data-grip-page` markers when they exist, then falls back to URL/path heuristics plus visible card counts
- the extractor stores the page HTML snapshot plus a normalized page text summary; it does not depend on screenshots in this slice

## Known limitations to verify on real Grip pages later

- session-detail detection is currently heuristic unless a page-level marker such as `data-grip-page="session-profile"` is present
- speaker list/profile detection is supported by selector heuristics, but the repo does not yet include real Grip speaker fixtures
- hidden or virtualized list items are intentionally ignored; only visibly rendered DOM nodes are captured
- if a real Grip page stops exposing mailto links or stable `data-*` fields, the fallback text selectors will need verification against live portal HTML
