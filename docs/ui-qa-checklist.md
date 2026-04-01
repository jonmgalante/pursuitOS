# UI QA Checklist

Use this pass after PursuitOS visual-system changes:

## Home Page

1. Open `http://localhost:3000`.
2. Confirm the Midnight shell, Steel route panel, and Sand working cards all render together.
3. Confirm primary actions stay Orange and secondary links/buttons stay Steel or Sand.
4. Confirm the five-question overview cards remain readable and the route links show a visible focus state.

## Workspace

1. Open `http://localhost:3000/workspaces/ws_demo_summit_2026`.
2. Confirm the summary strip answers who to meet, where to go, what happened, what to do next, and what to send.
3. Confirm Target cards still show text labels for `Targeted`, `Met`, `Missed`, and follow-up state.
4. Confirm the queue, session intelligence, and intake sections keep Aqua limited to insight context only.
5. Confirm empty states, borders, badges, and action buttons feel consistent across sections.

## Field Mode

1. Open `http://localhost:3000/workspaces/ws_demo_summit_2026/field`.
2. Confirm person search, quick picks, outcome buttons, tags, and save controls are comfortably tappable on a narrow viewport.
3. Confirm the sticky save bar stays visible and the outcome, tags, and context summary remain readable.
4. Confirm `Met`, `Missed`, `No action`, and session context are always labeled with text.

## Extension Side Panel

1. Load `apps/extension/dist` in Chrome and open the side panel.
2. Confirm settings actions, capture action, status panel, and last-capture summary use the same token system and spacing rhythm.
3. Confirm loading, success, and error states read clearly without relying on color alone.
4. Confirm buttons, inputs, and summary links show visible focus states.

## Smoke Flow

1. Seed the demo workspace.
2. Capture `/demo/grip/attendees` from the extension.
3. Capture `/demo/grip/sessions` from the extension.
4. Mark Targets, log an encounter, generate a draft, sync a HubSpot task, and sync a Gmail draft.
5. Confirm the recent activity, follow-up queue, and audit surfaces still update as expected.

## Contrast, Status, And Focus

1. Confirm Orange is not used as a page background.
2. Confirm Aqua is not used as the primary CTA.
3. Confirm signal fills use Midnight text or icons for contrast.
4. Confirm all status meaning is present in text, not only in color.
5. Confirm keyboard focus remains visible on buttons, links, cards that act as links, and form controls.
