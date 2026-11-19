---
feature: 029-fleet-control-room
created: 2026-11-18
---

# Research — Terminal foundation for the Fleet view (US-8, FR-015)

> Evidence for ADR-004. Spike A is measured. **Spike B (Ink 7) was not built or measured**: this build ran
> with no network, so Ink could not be installed. What is said about Ink below comes from feature 006's recorded
> rejection and from facts that are checkable offline in this repo, and is marked as such.

## Contract check (T010, Phase 0)

Confirmed against the merged code, and pinned by `test/core/fleet-view-contract.test.ts`:

- **025:** `readRun`, `listRuns`, `fleetRoot`, `laneStatus`, `writeDirective`, `readDirective`, `directiveStatus`,
  `directivePath` exported from `src/core/fleet/`; `fleet.stallMinutes` (default 15) via `fleetSettings`; run.json has
  `stage`, `round`, `limit`, `needsDecision`, `gates[]`, `lanes[]` (written by `createRun`/`updateRun`).
- **019:** `ambykit fleet update` writes `stage`, `round`, `needsDecision` (`src/cli/fleet.ts`).
- **028:** `openGate` writes `gates[]` (state pending→approved) and `approveGate` is the function `ambykit run approve` calls
  (`src/core/run-gate-actions.ts`); approving writes no directive file.
- **Marker names:** `readMarkers` parses `<feature>.<agent>.json`; 025 changed it for `~<lane>` names, and 029 never re-parses
  (it calls `laneStatus`). Plan R3 is closed.

## Spike A — hand-rolled on the existing layer (measured)

Measured on a throwaway module (`displayWidth`, `fit`, `laneRow`, `layoutRows`), 10 lanes, 2000 frames per cell. The spike code and its
measure script were **removed after measuring** (T002); the numbers below are the record. The shipped renderer,
`src/cli/ui/dashboard/fleet-view.ts` (T032), was written fresh against the signed-off design and reuses 014/017's `panel`,
`truncateVisible` and `agentBadge` instead of the spike's own width helpers.

| Criterion | Result |
|---|---|
| Build cost | 45 non-comment source lines for width-aware fit/pad, three icon sets with a state word beside every glyph, a stalled label, and a scroll window. About half a day including measuring. |
| New dependencies | 0 (runtime dependencies stay `gray-matter` and `zod`). |
| Render cost | 0.005–0.008 ms per 10-lane frame at 120, 80 and 50 columns, in all three icon modes, so the frame budget is not a concern. |
| Row width | Every row is exactly the terminal width (cut with `…`, padded otherwise) in all nine icon × width cells. |
| Terminal restore | Unchanged: `fullscreen.ts` already restores the screen on quit, Ctrl-C, SIGINT and SIGTERM (feature 017, FR-016); the Fleet view is a pure renderer inside it. |
| Fallbacks | Plain/NO_COLOR and narrow layouts reuse the existing breakpoints; the ASCII set is `[>] [~] [x] [|] [v] [.] [?]` and needs no glyph support. |
| Icon width | The real risk, and it is the same for any foundation. Nerd Font glyphs are Private Use Area with *ambiguous* width (1 cell in most terminals, 2 in some), so the spike reserves two cells for them. `⏸` (U+23F8) is also drawn wide by some terminals though it is not in the wide table, so the unicode set should avoid it or reserve a cell (a design-token choice for T022/T030). A word beside every glyph keeps every state readable even when a glyph is wrong. |

## Spike B — Ink 7 (NOT measured)

Not built: no network, so no install, no install-size, no Node-22 run, no restore or icon-width measurement.
What can be said without measuring:

- Feature 006 (`specs/006-enhanced-tui/research.md`) evaluated Ink and **rejected it for footprint** ("React + reconciler +
  many transitive deps ... blows SC-006"). Nothing in 029 changes that calculation: the Fleet view is a list of rows, which
  spike A drew in 45 lines.
- Ink 7 needs Node 22 and React; this project's `engines` is Node >= 20 until 030 raises it (030 US-8).
- Adopting it would need an explicit exception to feature 006's dependency cap, recorded in the ADR.

If someone wants the comparison measured, it is `T003` and is the one open evidence gap; it does not change the default
(D1: hand-rolled unless it costs more than the dependency), because spike A cost almost nothing.

## Recommendation

**Hand-rolled** on the existing layer, promoting spike A's layout helpers into `src/cli/ui/dashboard/fleet-view.ts` when
T032 runs (after the T022 design sign-off). Reasons: zero dependencies, measured cost is tiny, restore is already solved
and tested, and the hard problem (icon width) is not helped by a framework.
