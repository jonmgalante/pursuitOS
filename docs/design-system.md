# PursuitOS Design System

This foundation establishes a single token source for app-owned UI in the web app and the Chrome extension sidepanel.

The intent is tactical and field-first:

- dark shell framing for navigation and command context
- sand working surfaces for readable task execution
- orange reserved for next actions and must-meet signals
- aqua reserved for insights, session intelligence, and secondary emphasis

## Raw palette

- `Midnight` `#15181D`: mission-control shell and high-contrast foreground on signal fills
- `Steel` `#323944`: shell panels, separators, hover structure, and secondary dark framing
- `Sand` `#F4EFE8`: main working surface
- `Wayfinding Orange` `#F97316`: primary CTA, must-meet, next-action signal
- `Aqua` `#67E8F9`: insight and analytics accent
- `Met` `#22C55E`: positive outcome
- `Missed` `#F59E0B`: missed outcome
- `Neutral` `#9CA3AF`: no-action or passive state

Support tints for borders, raised surfaces, code backgrounds, and status surfaces derive from these raw colors inside the shared token file so product UI does not scatter standalone hex values.

## Semantic token map

The semantic layer lives in [`apps/web/app/pursuit-theme.css`](/Users/jongalante/Desktop/pursuitOS/apps/web/app/pursuit-theme.css).

- `--shell-background`: Midnight shell backdrop
- `--shell-panel`: Steel shell panel
- `--shell-text`: Sand shell text
- `--surface-main`: Sand working surface
- `--surface-raised`: lighter raised surface for nested cards, inputs, and lists
- `--border-subtle`: everyday separators
- `--border-strong`: emphasized borders for secondary actions and empty states
- `--text-primary`: main reading text
- `--text-secondary`: structured support text
- `--text-muted`: tertiary text and annotations
- `--cta-primary`: Orange CTA fill
- `--cta-primary-foreground`: Midnight text/icon on Orange
- `--accent-insight`: Aqua insight fill
- `--accent-insight-foreground`: Midnight text/icon on Aqua
- `--focus-ring`: orange-derived accessible focus halo
- `--status-success`: Met
- `--status-missed`: Missed
- `--status-follow-up`: Needs follow-up
- `--status-neutral`: No action

Status surfaces and borders are exposed as helper tokens so buttons, badges, and banners can use the same semantic family without introducing new raw color values.

## Usage ratios

- Keep neutrals at roughly `70–75%` of the interface.
- Keep orange at roughly `10–15%` and reserve it for primary action, must-meet emphasis, and follow-up prompts.
- Keep aqua near `5%` for insight moments only.

Orange is a signal, not a canvas. Aqua is supportive, never the primary CTA.

## Status semantics

- `Met`: use the success family with explicit `Met` labeling.
- `Missed`: use the missed family with explicit `Missed` labeling.
- `Needs follow-up`: use the follow-up family when the next action matters.
- `No action`: use the neutral family for passive or unresolved states.

Status UI must always pair color with text and, where practical, an icon or marker. The shared badge pattern includes a dot plus a label so state is never color-only.

## Guardrails

Never let orange become the background. Use it on buttons, pills, focused segments, or small signal surfaces only.

Do use Midnight text or icons on Orange, Aqua, Green, and Amber fills. The system is intentionally biased away from white-on-signal fills.

Do use Sand and raised-surface neutrals for the working canvas so dense operational screens stay readable in field conditions.

Do not turn every accent into a CTA. If a surface is informational or analytical, prefer Aqua or neutral structure over Orange.

Do not use raw palette hex values directly in product screens when a semantic token already exists. Extend the shared token file first, then consume the semantic role.
