---
feature: 029-fleet-control-room
status: draft
created: 2026-11-16
---

# Implementation Plan — Dashboard fleet control room

> The HOW. First artifact where technology appears. Must satisfy every `FR-###` in `@spec.md` and
> honor `@../../.amby/constitution.md`. Reference spec by ID — do not restate it.
> **No `ui.md` yet:** the Fleet view's layout needs `/amby.design` sign-off (see Open decisions D2).
> Until then the view phases below are specified by acceptance criteria, not by pixels.

## Technical context

- **Stack:** TypeScript, Node ≥ 20, ESM (`.js` import suffixes), Vitest. No new runtime dependency unless the
  spike (Phase 1) says so (D1).
- **Existing code this extends (reuse, don't reinvent):**
  - `src/cli/ui/interactive/fullscreen.ts` — alt-screen host, raw mode, restore on quit/Ctrl-C/SIGINT/SIGTERM,
    in-place repaint, `resize`/`stop` hooks (017). Already satisfies **FR-016**; the plan only keeps its tests green.
  - `src/cli/ui/interactive/overview.ts` — pure reducer/renderer; views `overview`/`feature`, `?` help, `r` retry.
  - `src/cli/dashboard.ts` `interactive()` — data refresh via `readProjectFeatures`, `watchProject`, heartbeat,
    presence; the effect pattern (the wrapper's `reduce` runs side effects, the pure reducer does not).
  - `src/cli/ui/interactive/live.ts` `watchTargets` — fs watch + polling fallback; add the fleet dirs here.
  - `src/core/activity.ts` — marker parsing and presence classification (017); `src/cli/ui/capabilities.ts`
    `iconMode` + `--icons` handling in `dashboard.ts`; `src/cli/ui/dashboard/{live-tokens,agent-badge,panel}.ts`.
- **Consumed contracts (not defined here, Principle 4):** spec 025 owns ALL fleet state code under
  `src/core/fleet/*` (runs, directives, claims, notes, lane-status, types) and everything under
  `.amby/fleet/<run>/` in the primary checkout: the activity marker superset (`lane`, `state` incl. `paused`,
  `<feature>.<agent>~<lane>.json`), the directive file (`directives/<lane>.json` `{action, at}`, short lane form
  `lane-<p>-<k>` in file names), `writeDirective` / `ambykit directive`, run resolution, `laneStatus` (the one
  stall implementation, `fleet.stallMinutes` default 15), and the single `run.json` schema in 025 `data-model.md`:
  status active|paused|waiting-person|done, stage working|qa|architect, round, limit, needsDecision,
  `gates[{id, after, state pending|approved}]`, `lanes[{lane, assistant, tasks[]}]`, `approvals[]`,
  `escalations[]`. Spec 028 owns gates (`ambykit run approve|reject`, `approveGate`). 029 only reads this state
  and calls those functions. It never invents a file format, parses state files itself or writes a directive
  for an approval.
- **Constraints driving choices:** zero model tokens, local, no network (P3, FR-014); one-shot and `--json` stay
  within 1 s and keep every existing field (FR-012, FR-013); no user-level files (P7); config is hand-edited, the
  dashboard never writes it (FR-011); every FR gets a test and `npm run typecheck` + `npm test` pass (P5).
- **No prompt/template change:** this is CLI code only, so nothing to `ambykit sync` (P1) except docs.

## Architecture

Pure core, effects at the edges (as in 017):

```
src/core/fleet/*            OWNED BY SPEC 025 (state, directives, laneStatus, run.json); 029 imports, adds nothing here
src/core/fleet-view/types.ts   view-model only: LaneView, RunView, ReviewStage, GateView, DirectiveStatus, FleetView
src/core/fleet-view/derive.ts  pure mapping from 025's results to view rows (calls 025's `laneStatus`; no stall rule,
                               no parsing of state files). directiveStatus words come from 025's derivation
src/core/fleet-view/read.ts    edge: readFleet(checkouts, now) → FleetView | null via 025's readers (null ⇒ no run, FR-013)
src/cli/ui/icons.ts         pure: resolveIconMode({flag, env, config, caps}) — precedence per FR-011
src/cli/ui/dashboard/fleet-tokens.ts   icon/color tokens for lane states (mirror of design-tokens.json after D2)
src/cli/ui/dashboard/fleet-view.ts     pure renderer: FleetView + caps + selection → string
src/cli/ui/interactive/fleet.ts        pure reducer slice: cursor, selection, confirm dialog, intended action
src/cli/ui/interactive/fleet-actions.ts edge: pause/resume/stop → 025's `writeDirective`; approve → 028's `approveGate`
                                        (the same function as `ambykit run approve`), per lane or run
```

- **Data flow:** `readFleet` runs inside the existing refresh (`readProjectFeatures` → rebuild) and the 17-style
  heartbeat; its inputs are the primary checkout's `.amby/fleet/` plus each lane worktree's markers. `watchTargets`
  gains `.amby/fleet` (recursive) so a directive or state change refreshes without a manual reload (FR-002).
- **Reducer:** a new `view: "fleet"` in `OverviewTuiState`, entered with `l` from the overview and left with `esc`.
  The reducer only records an *intended action* (`{kind: pause|resume|stop|approve, target: lane|run}`); the
  `interactive()` wrapper's `reduce` performs the write through `fleet-actions.ts` and clears the intent, the same
  pattern already used for `r`. Keys avoid existing bindings (`r` is retry-live, `f`/`s` are filters).
- **Derived states** (mapped in `fleet-view/derive.ts`, rules owned by 025): lane `state` from the marker;
  review stage/round/limit/needs-decision from `run.json`; **stalled** comes from 025's `laneStatus` (state working
  AND now − max(last report, `tasks.md` mtime) > `fleet.stallMinutes`, default 15 min, separate from the 30-min
  idle limit; FR-005); **directive status** words use 025's derivation: pending = directive `at` newer than the
  lane's latest report; obeyed = the next report is dated after it; pause requested = pause directive exists and
  lane state is not `paused` (FR-007); lane data unreadable ⇒ `unknown` (FR-003); gates awaiting approval from
  `gates[]` in `run.json` (FR-009).
- **Icons:** `resolveIconMode` is pure and implements `--icons` > `AMBYKIT_ICONS` > `dashboard.icons` > auto-detect
  (FR-011). `config.ts` gains `dashboard.icons: nerd|unicode|ascii|auto` (zod) and `AmbyConfig` the same type.
  Every lane/state token carries a glyph for each of the three modes and a plain word, so no state depends on a glyph
  (FR-010); narrow (< 60 col) and `NO_COLOR` layouts reuse the existing breakpoints.
- **JSON/one-shot:** `--json --overview` gains an optional `fleet` object (run id, lanes with assistant, state,
  lastActivity, stage, stalled, directive status) **only when a run exists**; bare `--json` (a story array) and
  one-shot text are untouched. The fleet view itself loads only under `--interactive` (FR-012). Documented in
  `docs/cli-reference.md` and the existing dashboard JSON contract.
- **Heavy work stays out of one-shot:** `readFleet` is a handful of small JSON reads; it is gated by "run
  directory exists" so a project without a run does zero extra IO (FR-013, SC-005).

## Phased approach

- **Phase 0 — Research (before any code):** confirm the 025 fleet-state contract (built first in the 1.5
  integration batch), the 019 prompt that writes `stage`/`round`, and 028's gate writes exist as the schema
  says; fixtures follow that schema, never a private shape. Output: notes inside the spike's `research.md`.
  **Dependencies:** specs 025 and 028 (state, gates), 022 (the foundation ADR is recorded with `/amby.decide`).
- **Phase 1 — Foundation spike (US-8, FR-015), 1 working week:** build the Fleet view for 10 lanes on the existing
  layer extended with a small internal screen-buffer/layout module; measure build cost, terminal restore, fallbacks
  and icon width; compare with Ink 7 (Node 22, React, reconciler) on the same criteria. Decision recorded as an
  ADR through `/amby.decide` (spec 022) with the evidence in `research.md`. **Gate: no view task starts before it.**
  Default outcome: hand-rolled (D1).
- **Phase 2 — Foundational:** view-model types, pure mapping, read edge over 025's readers, icon resolution +
  config key, watcher targets, fixtures, and the person task **T022** (`/amby.design` sign-off, scheduled here so
  it completes before Phase 3). Two disjoint lanes: *fleet view-model* (types/derive/read/watch) and *icons*
  (config/icons/precedence).
- **Phase 3+ — Stories in priority order:** US-1 (lane list, refresh, unknown/no-run), US-2 (review stage),
  US-3 (stalled), US-4 (pause/resume/stop + confirmation + directive status), US-6 (icon modes/narrow/plain),
  US-7 (`--json` + budget), then US-5 (gates, P2). Polish: help overlay, docs, changelog, SC-007 dogfood run.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| US-1 / FR-001, FR-002, FR-003 | `readFleet` → `LaneView[]`; `fleet-view.ts` rows (assistant, state, quiet time); watcher on `.amby/fleet` + heartbeat refresh; unreadable lane ⇒ `unknown` row; no run ⇒ empty-state line |
| US-2 / FR-004 | `ReviewStage` + round/limit + `needsDecision` read from `run.json` `stage`/`round`/`limit`/`needsDecision` (025 schema, written by 019's prompt and 028); missing ⇒ stage `working` |
| US-3 / FR-005 | 025's `laneStatus` marks stalled; highlight with text label `STALLED 18m` (readable without color); clears on next report |
| US-4 / FR-006, FR-007, FR-008 | `fleet.ts` intent + `fleet-actions.ts` calling 025's `writeDirective` per lane (run-level = every lane, last write wins); directive-status words from 025's derivation; stop (and run-level pause) behind a confirm dialog |
| US-5 / FR-009 | Gate list from `gates[]` in `run.json`; approve ⇒ 028's `approveGate` (same as `ambykit run approve`), never a `continue` directive; not approved ⇒ lane stays paused (no write) |
| US-6 / FR-010, FR-011 | `resolveIconMode`, `fleet-tokens.ts` with three modes + word fallback; `dashboard.icons` config key, hand-edited |
| US-7 / FR-012, FR-013 | `fleet` field only in `--json --overview`, only with a run; perf test with 10 lanes; no-run output byte-identical |
| US-8 / FR-015 | Phase 1 spike + ADR; gate before Phase 3 |
| FR-014 | No network/IO beyond local files; tests assert no model/network call paths |
| FR-016 | Existing `runFullscreen` cleanup; regression test covers the new view (quit, Ctrl-C, SIGTERM, resize) |
| SC-001..SC-007 | SC-001/002/003 e2e on fake stdin (like `dashboard-live`), SC-004 renderer matrix, SC-005 perf + shape tests, SC-006 test-per-FR (tests name `029:FR-###`), SC-007 dogfood in Polish |

## Risks & decisions

- **R1 — Upstream contracts not built yet (025, 028).** 029 is 1.6; if 025/028 slip, build against fixtures and keep
  the read edge behind `FleetView` so only `read.ts` changes. Mitigation: Phase 2 task verifies the contract first.
- **R2 — Review stage and gate data: resolved.** 025's marker states do not carry QA/architect stage, round or
  gate; they come from `run.json` (025 `data-model.md` is the only schema: `stage`, `round`, `limit`,
  `needsDecision`, `gates[]`). 019's prompt writes stage/round, 028 writes gates. Residual risk: T010 must confirm
  those writers exist before view tasks rely on them.
- **R3 — Marker file naming vs the current parser.** `readMarkers` in `src/core/activity.ts` parses
  `<feature>.<agent>.json` with `(.+)\.([^.]+)\.json`; lane names contain dots (`NNN-slug.lane-1-2`) and 025 adds
  `~<lane>`. The 025 plan must change that parser; 029 consumes its result, never re-parses.
- **R4 — "Tab" vs view.** The spec says Fleet *tab*; tabs arrive with 032. 029 ships a full-screen *view* that 032
  re-hosts, keeping state/renderer split so the move is a re-wiring, not a rewrite.
- **R5 — Clock skew between worktrees** (spec edge case): last-activity is clamped to now (as `presenceOf` already
  does); directive-vs-report comparison uses the marker's own `at`, never file mtimes.
- **R6 — Performance:** 10-lane run must render and refresh well under a frame budget; repaint is the existing
  in-place frame; JSON path reads only when `.amby/fleet` exists.

## Open decisions (default chosen; confirm or change)

- **D1 — Terminal foundation:** default **hand-rolled** (extend the existing layer). Real outcome comes from the
  Phase 1 spike; switch to Ink 7 only if hand-rolling costs more than the dependency (feature 006 capped
  dependencies at three small ones; adopting Ink needs an explicit exception recorded in the ADR).
- **D2 — UI design sign-off via `/amby.design`:** produce `ui.md` + `design-tokens.json` for the Fleet view (the
  roadmap's sketch is the starting point). It is the explicit person task **T022**, scheduled before Phase 3.
  View-rendering tasks that depend on layout (T030, T032) are gated on it; model and derivation tasks are not.
- **D3 — Key bindings:** default `l` open Fleet view, `esc` back, `↑↓` select lane, `p` pause, `c` continue/resume,
  `x` stop, `a` approve, `⇧` + action = whole run. Confirm during design sign-off (`r` is already "retry live").
- **D4 — Run-state contract for review stage/round and gates:** *resolved* — the single `run.json` schema in 025
  `data-model.md`; fixtures copy it exactly and `fleet-view/read.ts` is the only consumer in 029.
- **D5 — Stall limit setting:** *resolved* — `fleet.stallMinutes` (default 15) in the single `fleet` config object
  owned by 025 T010, used only through 025's `laneStatus`.
- **D6 — Directive writer location:** *resolved* — import `writeDirective` from 025's `src/core/fleet/directives.ts`;
  approvals go through 028's `approveGate` instead.
- **D7 — `--json` placement:** default `fleet` only under `--json --overview` (bare `--json` is a story array and
  must not change shape).
- **D8 — Confirmation scope:** default confirm for `stop` (FR-008) and for any run-level pause/stop.
