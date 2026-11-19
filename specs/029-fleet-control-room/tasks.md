---
feature: 029-fleet-control-room
created: 2026-11-16
---

# Tasks — Dashboard fleet control room

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes. **Extra gates:** (1) Phase 1 spike decision
> (US-8, FR-015) before any Phase 3+ task; (2) `/amby.design` sign-off, the person task T022 (plan D2), before
> T030 and T032; (3) the fleet-state contract of spec 025, plus 019's stage/round writes and 028's gate writes
> (T010); (4) spec 022 shipped, because T005 records the ADR with `/amby.decide`. Dependencies: specs 025, 028,
> 022. 029 imports `src/core/fleet/*` from 025 and adds only the view-model layer. Tests name what they cover as
> `029:FR-###`.
> Story order: US-8 (gate) → US-1 → US-2, US-3, US-4 (each depends-on US-1) → US-6 → US-7 → US-5 (depends-on US-4).
> Within a phase, tasks run in file order unless marked `[P]` (disjoint files, no sibling dependency).

## Phase 1 — Setup: foundation spike  (US-8, gates Phase 3)

- [x] [T001] [US8] Fleet fixture helper: temp project with a run, N lanes (worktrees), 025-shape markers, directives, and a `run.json` copied exactly from 025's `data-model.md` schema (test/helpers/fleet-fixture.ts)
- [x] [T002] [P] [US8] Spike A: Fleet view for 10 lanes on the existing layer plus a small internal screen-buffer/layout module (src/cli/ui/interactive/spike/fleet-spike.ts) ↪ DEVIATION: spike code and its measure script were removed after measuring (T032 wrote the renderer fresh on 014/017's helpers); the numbers are kept in research.md
- [ ] [T003] [P] [US8] Spike B: same view on Ink 7 in a scratch dir outside `src/`; measure install size, Node 22 need, restore, fallbacks, icon width (specs/029-fleet-control-room/spike/) ⚠ BLOCKED: no network in this build, so Ink 7 could not be installed or measured (research.md records spike B as not measured)
- [x] [T004] [US8] Write findings: measured effort and trade-offs for both options, recommendation (specs/029-fleet-control-room/research.md)
- [x] [T005] [US8] Record the foundation decision with the evidence via `/amby.decide` (.amby/decisions/) ↪ DEVIATION: ADR-004 written by hand in the /amby.decide record format (the prompt cannot run inside a worker), index row added in .amby/decisions/README.md
- **Verify:** research.md has measurements for both options against build cost, restore, fallbacks and icon width, plus a recommendation; an ADR for the decision exists; spike code is either promoted by later tasks or removed. ? unverified: spike B (Ink 7) not measured because T003 is blocked (no network); spike A is measured, the recommendation and ADR-004 are done, and the spike code was removed
- **Checkpoint:** foundation decided (US-8). Phase 3 may start.

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Contract check: confirm spec 025 provides lane/state (incl. `paused`) markers, `writeDirective`, run resolution, `laneStatus` and the `fleet.stallMinutes` config; confirm spec 019's prompt writes `stage`/`round` to `run.json` and spec 028 writes `gates[]` (`approveGate`); record deviations under Open decisions (specs/029-fleet-control-room/plan.md) ↪ DEVIATION: pinned by a new test, test/core/fleet-view-contract.test.ts; notes are in research.md
- [x] [T011] View-model types only: LaneView, RunView, ReviewStage, GateView, DirectiveStatus, FleetView, built from spec 025's types (src/core/fleet-view/types.ts)
- [x] [T012] [P] Pure mapping from 025's results to view rows: lane state, stalled flag from 025's `laneStatus`, directive-status word from 025's derivation, unknown on bad data; no stall logic and no state parsing here (src/core/fleet-view/derive.ts)
- [x] [T013] [P] Tests for the mapping: stalled rows follow `laneStatus` (waiting/done never stalled), directive vs report times, clock skew, unknown — 029:FR-003, FR-005, FR-007 (test/core/fleet-derive.test.ts)
- [x] [T014] [P] `readFleet(checkouts, now)` over 025's readers: markers + directives + `run.json`; null when no run; unreadable lane ⇒ unknown (src/core/fleet-view/read.ts)
- [x] [T015] [P] Tests for readFleet incl. no-run null and corrupt files — 029:FR-003, FR-013 (test/core/fleet-read.test.ts)
- [x] [T016] [P] `watchTargets` adds `.amby/fleet` (recursive) in the primary checkout (src/cli/ui/interactive/live.ts) ↪ DEVIATION: added as separate `fleetWatchTargets`/`liveTargets` so `watchTargets` and its exact-list test stay unchanged; dashboard.ts arms `liveTargets`
- [x] [T017] [P] Test: fleet dir change triggers refresh; polling fallback covers it — 029:FR-002 (test/ui/live-fleet.test.ts)
- [x] [T018] [P] Config: `dashboard.icons` nerd|unicode|ascii|auto (zod + `AmbyConfig`), never written by the dashboard (src/core/config.ts, src/core/types.ts)
- [x] [T019] [P] Pure `resolveIconMode({flag, env, config, caps})` with precedence flag > env > config > auto (src/cli/ui/icons.ts)
- [x] [T020] [P] Tests: precedence matrix, invalid config value, non-TTY — 029:FR-011 (test/ui/icons.test.ts, test/core/config-icons.test.ts)
- [x] [T021] Wire `resolveIconMode` into the dashboard command, keeping `--icons` validation as today (src/cli/dashboard.ts) ↪ DEVIATION: `applyIcons` now takes the project root and leaves caps untouched when the resolved mode equals the detected one, so output without `dashboard.icons` is unchanged
- [x] [T022] PERSON: `/amby.design` sign-off for the Fleet view (`ui.md` + `design-tokens.json`, starting from the roadmap sketch); must complete before T030 and T032 (specs/029-fleet-control-room/ui.md) ↪ DEVIATION: signed off 2026-11-18 with five decisions recorded in ui.md (continue is u/U; review state header-only; every whole-run action confirms; newest run plus '+N more runs'; Nerd glyphs keep the plan default, not asked)
- **Verify:** `npm run typecheck` and `npx vitest run test/core/fleet-derive.test.ts test/core/fleet-read.test.ts test/ui/live-fleet.test.ts test/ui/icons.test.ts test/core/config-icons.test.ts` pass; no existing dashboard test changes. ✓ passed
- **Checkpoint:** view-model, read edge, watcher and icon resolution done, and the design sign-off (T022) recorded; no UI yet.

## Phase 3 — User story US-1  (priority: P1)

- [x] [T030] [P] [US1] Fleet tokens: state glyphs in nerd/unicode/ascii plus a word for every state, from signed-off design tokens (src/cli/ui/dashboard/fleet-tokens.ts) ↪ DEVIATION: the tokens mirror is generated by resolving the 029 tokens against 014 + 017 + 029; test/ui/fleet-tokens.test.ts keeps it in sync
- [x] [T031] [P] [US1] Reducer slice: `view: "fleet"`, lane cursor, scroll, enter/leave (src/cli/ui/interactive/fleet.ts) ↪ DEVIATION: standalone slice with `back` and `quit` flags; hooking it into the overview reducer is T035 (gated by T022)
- [x] [T032] [US1] Fleet renderer: rows (assistant badge, state, time since last activity), distinct rows for same assistant, no-run line, unknown lane, scroll in a short terminal (src/cli/ui/dashboard/fleet-view.ts) ↪ DEVIATION: the renderer is written fresh on 014/017's panel, truncateVisible and agentBadge (the spike code was removed); gates sit in the same frame under a GATES line, not a second panel; it also exports the FleetViewApi that overview.ts receives
- [x] [T033] [P] [US1] Renderer tests: wide/narrow/plain, NO_COLOR, unknown, empty, many lanes — 029:FR-001, FR-003 (test/ui/fleet-view.test.ts) ↪ DEVIATION: extra renderer tests in test/ui/fleet-directive-view.test.ts (directive words and the confirm dialog) and test/ui/fleet-overview.test.ts (the overview wiring)
- [x] [T034] [P] [US1] Reducer tests: open/close, cursor bounds, scroll — 029:FR-001 (test/ui/fleet-reducer.test.ts)
- [x] [T035] [US1] Hook the Fleet view into the overview reducer/renderer; `l` opens, `esc` back; keys in the help overlay (src/cli/ui/interactive/overview.ts, src/cli/ui/dashboard/help-overlay.ts) ↪ DEVIATION: the view is handed to overview.ts as an injected FleetViewApi after a dynamic import (type-only imports there), so the one-shot path never loads it, like 023's graph view; `l` opens it
- [x] [T036] [US1] `interactive()`: read fleet on refresh and heartbeat, pass into view data (src/cli/dashboard.ts) ↪ DEVIATION: the heartbeat re-reads the run as well as refresh, so a quiet lane shows STALLED without a file change; terminal rows come from process.stdout.rows
- [x] [T037] [US1] e2e on fake stdin: 3 lanes shown, a lane state change updates the frame without reload, no run says so — SC-001, 029:FR-002 (test/cli/dashboard-fleet.test.ts)
- **Verify:** `npx vitest run test/ui/fleet-view.test.ts test/ui/fleet-reducer.test.ts test/cli/dashboard-fleet.test.ts` pass. ✓ passed
- **Checkpoint:** US-1 is demoable — every lane of a run visible and live.

## Phase 4 — User story US-2  (priority: P1)

- [x] [T040] [P] [US2] Read `stage`, `round`, `limit` and `needsDecision` from `run.json` (025 schema, written by 019's prompt and 028); absent ⇒ stage working (src/core/fleet-view/read.ts) ↪ DEVIATION: satisfied by `runView` over 025's `readRun` (which already defaults stage, round, limit and needsDecision); no separate read code
- [x] [T041] [US2] Render the stage (working / QA / architect review), round vs limit, and a needs-decision mark (src/cli/ui/dashboard/fleet-view.ts) ↪ DEVIATION: review state is shown once in the run header (signed-off decision), not per lane
- [x] [T042] [P] [US2] Core tests: stage mapping, missing data not an error — 029:FR-004 (test/core/fleet-review.test.ts)
- [x] [T043] [P] [US2] Renderer tests for each stage and the needs-decision state (test/ui/fleet-review-view.test.ts)
- **Verify:** `npx vitest run test/core/fleet-review.test.ts test/ui/fleet-review-view.test.ts` pass. ✓ passed
- **Checkpoint:** US-2 is demoable — review-loop state visible per lane.

## Phase 5 — User story US-3  (priority: P1)

- [x] [T050] [US3] Stalled highlight with text `STALLED <quiet time>` driven by spec 025's `laneStatus`, cleared on next report (src/cli/ui/dashboard/fleet-view.ts)
- [x] [T051] [P] [US3] Tests: working lane over limit stalls; waiting/done do not; `tasks.md` change resets — 029:FR-005 (test/core/fleet-stall.test.ts)
- [x] [T052] [P] [US3] View tests: highlight readable without color, clears on report (test/ui/fleet-stall-view.test.ts)
- [x] [T053] [US3] e2e: quiet lane highlights within one refresh of the limit, then clears — SC-002 (test/cli/dashboard-fleet-stall.test.ts)
- **Verify:** `npx vitest run test/core/fleet-stall.test.ts test/ui/fleet-stall-view.test.ts test/cli/dashboard-fleet-stall.test.ts` pass. ✓ passed
- **Checkpoint:** US-3 is demoable — stalled lanes stand out.

## Phase 6 — User story US-4  (priority: P1)

- [x] [T060] [P] [US4] `fleet-actions`: pause/resume/stop → directive writes through spec 025's `writeDirective` (short lane form in file names), per lane or every lane of the run, last write wins; a worker finishes its current task before obeying (src/cli/ui/interactive/fleet-actions.ts)
- [x] [T061] [P] [US4] Reducer: `p` pause, `u` continue, `x` stop, shifted = whole run, confirm dialog for stop and run-level actions (src/cli/ui/interactive/fleet.ts) ↪ DEVIATION: key letters are the plan's D3 defaults in one `FLEET_KEYS` constant, decided at the T022 sign-off: u/U continue, all whole-run actions confirm
- [x] [T062] [US4] Render directive status (pending / pause requested / obeyed) and the confirm dialog (src/cli/ui/dashboard/fleet-view.ts) ↪ DEVIATION: directive status words and the confirm dialog are rendered in fleet-view.ts; tests are in test/ui/fleet-directive-view.test.ts
- [x] [T063] [US4] Wrapper executes the intent in `interactive()` reduce, then refreshes (src/cli/dashboard.ts) ↪ DEVIATION: the effect runs in dashboard.ts's reduce wrapper after the pure reducer, then re-reads the run and shows the result as a notice line
- [x] [T064] [P] [US4] Tests with a fake writer: one lane, run-level, replace pause with continue — 029:FR-006 (test/ui/fleet-actions.test.ts)
- [x] [T065] [P] [US4] Reducer tests: confirm on stop, cancel writes nothing — 029:FR-008 (test/ui/fleet-controls.test.ts)
- [x] [T066] [US4] e2e: pause shows pause requested until the lane's next report, resume continues, opposite directives show last write — SC-003, 029:FR-007 (test/cli/dashboard-fleet-control.test.ts)
- **Verify:** `npx vitest run test/ui/fleet-actions.test.ts test/ui/fleet-controls.test.ts test/cli/dashboard-fleet-control.test.ts` pass; directive files written only through the 025 writer. ✓ passed
- **Checkpoint:** US-4 is demoable — pause, resume and stop from the dashboard.

## Phase 7 — User story US-6  (priority: P1)

- [x] [T070] [P] [US6] Matrix test: every state × nerd/unicode/ascii × wide/narrow/plain/NO_COLOR is readable by word — SC-004, 029:FR-010 (test/ui/fleet-icons.test.ts)
- [x] [T071] [US6] Compact layout under 60 columns without truncating state names (src/cli/ui/dashboard/fleet-view.ts) ↪ DEVIATION: in the compact layout the live indicator is dropped from the header so NEEDS A DECISION is never cut
- [x] [T072] [P] [US6] e2e: precedence flag > env > config > auto on the Fleet view — 029:FR-011 (test/cli/dashboard-fleet-icons.test.ts)
- **Verify:** `npx vitest run test/ui/fleet-icons.test.ts test/cli/dashboard-fleet-icons.test.ts` pass. ✓ passed
- **Checkpoint:** US-6 is demoable — readable in any terminal and icon mode.

## Phase 8 — User story US-7  (priority: P1)

- [x] [T080] [US7] Add optional `fleet` object to `--json --overview` only when a run exists; bare `--json` and one-shot text unchanged (src/cli/dashboard.ts)
- [x] [T081] [P] [US7] Contract doc for the new JSON fields (specs/029-fleet-control-room/contracts/dashboard-json-fleet.md)
- [x] [T082] [P] [US7] Tests: existing fields unchanged, no-run output byte-identical, fleet fields shape — 029:FR-012, FR-013 (test/cli/dashboard-fleet-json.test.ts)
- [x] [T083] [P] [US7] Perf: one-shot and `--json` with 10 lanes under 1 s; non-interactive loads no fleet view or watcher — SC-005 (test/cli/dashboard-fleet-perf.test.ts)
- **Verify:** `npx vitest run test/cli/dashboard-fleet-json.test.ts test/cli/dashboard-fleet-perf.test.ts` and the existing dashboard json and perf tests pass unchanged. ✓ passed
- **Checkpoint:** US-7 is demoable — scripts keep working, still fast.

## Phase 9 — User story US-5  (priority: P2)

- [x] [T090] [P] [US5] Read gates (story, awaiting approval) from `gates[]` in `run.json` (src/core/fleet-view/read.ts)
- [x] [T091] [US5] Render awaiting-approval marks and a combined gate list (src/cli/ui/dashboard/fleet-view.ts) ↪ DEVIATION: pending gates first, then the last two approved ones; tests are in test/ui/fleet-gates-view.test.ts
- [x] [T092] [P] [US5] Reducer: `a` approve calls spec 028's `approveGate` (the same function as `ambykit run approve`), never a `continue` directive; declining or leaving writes nothing, lane stays paused (src/cli/ui/interactive/fleet.ts, src/cli/ui/interactive/fleet-actions.ts) ↪ DEVIATION: the reducer records an approve intent and `performFleetIntent` in fleet-actions.ts calls 028's approveGate; the gate list is rendered by T091 (gated)
- [x] [T093] [P] [US5] Tests: approve releases a 028 gate, decline, several gates listed — 029:FR-009 (test/ui/fleet-gates.test.ts)
- [x] [T094] [US5] e2e: lane reaches a gate, is approved from the dashboard, the 028 gate state releases and the lane continues (test/cli/dashboard-fleet-gates.test.ts)
- **Verify:** `npx vitest run test/ui/fleet-gates.test.ts test/cli/dashboard-fleet-gates.test.ts` pass; approving writes no directive file. ✓ passed
- **Checkpoint:** US-5 is demoable — gates approved from the dashboard.

## Phase 10 — Polish

- [x] [T100] Terminal-restore regression for the Fleet view: quit, Ctrl-C, SIGTERM, resize, detach — 029:FR-016 (test/ui/interactive-fleet-restore.test.ts) ↪ DEVIATION: fullscreen.ts (the 017 host) was hardened: it now restores the terminal and rejects when the app throws, and stops on SIGHUP or the input ending; the regression drives the real overview app with the Fleet view open
- [x] [T101] [P] Docs: Fleet view keys, `dashboard.icons`, JSON `fleet` field (docs/cli-reference.md) ↪ DEVIATION: the site CLI page (site/src/content/docs/cli/index.mdx) is updated too, and its 'no project setting for icons' sentence is replaced by dashboard.icons
- [x] [T102] [P] Changelog entry under Unreleased (CHANGELOG.md) ↪ DEVIATION: the entry is under [Unreleased]; folding it into the 1.6.0 section is left to the release batch
- [x] [T103] [P] Local-only test: fleet paths use no network and no model call — 029:FR-014 (test/cli/dashboard-fleet-local-only.test.ts)
- [ ] [T104] SC-007 dogfood: supervise a real run of one AmbyKit feature with the Fleet view and record the result (specs/029-fleet-control-room/dogfood.md)
- **Verify:** `npm run typecheck` and `npm test` pass; every FR in the spec maps to at least one named test; dogfood.md records a run supervised from the Fleet view. ? unverified: typecheck and the full suite pass (one run failed only the known dashboard-worktrees timing test, which passes alone) and every FR maps to a test (trace 029: 16/16), but dogfood.md (T104, a real supervised run) does not exist yet
