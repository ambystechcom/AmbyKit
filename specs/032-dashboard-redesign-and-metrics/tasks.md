---
feature: 032-dashboard-redesign-and-metrics
created: 2026-11-19
---

# Tasks — Dashboard redesign and workflow metrics

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes. **Extra gates:** (1) `/amby.design` sign-off, the
> person task T050, before every tab-rendering task (Phases 7–9, 11); (2) spec 030 merged (T051) before any task
> that reads v2 history (T023 mixed-history case, T090); (3) spec 031 merged (T052) before Phase 11. Phases 1–5
> need none of them: they use the shipped 1.x parsers behind the interfaces 030 and 031 later fill. Tests name what
> they cover as `032:FR-###`. Hot files (`overview.ts`, `dashboard.ts`, `src/core/index.ts`) are touched by one
> task at a time.
> Story order: Foundational → US-4 → US-2 → US-3 → (design gate) → US-1 → US-7 → US-6 → US-5 → Fleet tab grouping.

## Phase 1 — Setup: inventory and contracts

- [x] [T001] Inventory what the one-shot path loads today and which views the tabs host (overview, feature, graph, fleet, quality); record the 030 and 031 names used by this plan (specs/032-dashboard-redesign-and-metrics/research.md)
- [x] [T002] [P] Metrics history fixture: a temp git repo built from scripted commits (spec ready, tasks checked, converge gap tasks; v1 and v2 forms; a squashed span) (test/helpers/metrics-history.ts)
- **Verify:** research.md lists each hosted view with its source file and whether one-shot loads it, plus the pending 030/031 names; the fixture builds a repo whose log has the scripted commits (`npx vitest run test/helpers`). ? unverified: T110
- **Checkpoint:** inputs known.

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Metrics types: Revision, PhaseCycle, GapPoint, Metrics (src/core/metrics/types.ts)
- [x] [T011] [P] List filter slice: `{query, state}` over features, stories and lanes, pure, with the active-filter text (src/cli/ui/interactive/list-filter.ts)
- [x] [T012] [P] Tests for the list filter: text and ID search, state filter, nothing matches, clear — 032:FR-006 (test/ui/list-filter.test.ts)
- [x] [T013] [P] Tab slice: `Tab` type, `nextTab`, `prevTab`, `tabByNumber`, unknown input is a no-op (src/cli/ui/interactive/tabs.ts)
- [x] [T014] [P] Tests for the tab slice — 032:FR-004 (test/ui/tabs.test.ts)
- [x] [T015] [P] JSON field-set baseline: record today's `dashboard --json` and overview-json field names; budget harness for one-shot on the largest fixture — 032:FR-009, FR-010 (test/cli/dashboard-budget.test.ts, test/fixtures/dashboard-json-fields.json)
- **Verify:** `npm run typecheck` and `npx vitest run test/ui/list-filter.test.ts test/ui/tabs.test.ts test/cli/dashboard-budget.test.ts` pass; no existing dashboard test changes. ✓ passed
- **Checkpoint:** reducers and baselines exist. Story phases may start.

## Phase 3 — User story US-4  (priority: P1)

- [x] [T020] Revisions edge: list the commits touching a feature's spec and tasks and read their text in batch, reusing burndown's cat-file reader, capped at 500 commits (src/core/metrics/revisions.ts)
- [x] [T021] [P] `phaseCycle`: first commit touching an artifact to the first commit that sets it complete (spec ready or done, all tasks checked); in progress yields no end (src/core/metrics/cycle.ts)
- [x] [T022] [P] `gapRate`: gap tasks appended per converge commit divided by the requirement count; a commit is a converge run when it appends tasks marked as gap tasks (src/core/metrics/gap.ts)
- [x] [T023] `readMetrics`: parse every revision through the per-file reader, skip and count unreadable ones, median per phase, `enough: false` under 3 completed features or 0 converge runs, starting on the shipped parsers behind one `readRevisionModel` function (T051 swaps in spec 030's reader) (src/core/metrics/index.ts, src/core/index.ts) ↪ DEVIATION: spec 030 was already merged, so the reader is `readSpec`/`readTasks` from the first commit; `readRevisionModel` calls the dispatcher with a version below the 1.x refusal, so history stays readable after 2.1 (T051 is satisfied here)
- [x] [T024] [P] Tests for cycle time: complete, in progress, rewritten history — 032:FR-007 (test/core/metrics-cycle.test.ts)
- [x] [T025] [P] Tests for gap rate: several converge runs, none, requirement count zero — 032:FR-007 (test/core/metrics-gap.test.ts)
- [x] [T026] Tests for `readMetrics`: v1 history, too little history, unreadable revision skipped and counted, large-history cap, no network and no model call, mixed v1/v2 history once 030 is merged — 032:FR-007, FR-008, FR-016, FR-019 (test/core/metrics-read.test.ts)
- [x] [T027] `ambykit dashboard --json --metrics`: opt-in additive `metrics` field; nothing added without the flag (src/cli/dashboard.ts, test/cli/dashboard-metrics-json.test.ts)
- [x] [T028] Interactive loading: read metrics after the first paint without blocking, deliver the result to state; failure leaves the other tabs working (src/cli/dashboard.ts, src/cli/ui/interactive/overview.ts) ↪ DEVIATION: delivered as `metricsState` on the overview data with its own async git reads (`readMetricsAsync`); the panel that shows it waits for the design (T062)
- **Verify:** `npx vitest run test/core/metrics-cycle.test.ts test/core/metrics-gap.test.ts test/core/metrics-read.test.ts test/cli/dashboard-metrics-json.test.ts` pass; `node dist/cli/index.js dashboard --json --metrics` on this repo prints a `metrics` object (or `enough: false`). ✓ passed: on this repo the command reports 33 spec cycles and 2 converge runs
- **Checkpoint:** US-4 data works headless; no panel yet (design-gated).

## Phase 4 — User story US-2  (priority: P1)

- [x] [T030] [US2] Wire tab keys into the reducer: `1`-`4`, `tab`, `shift-tab`; a key with no meaning leaves the state unchanged (src/cli/ui/interactive/overview.ts) ↪ DEVIATION: `tab`/`shift-tab` keep moving panel focus in the overview (existing behaviour and tests), so tabs use `1`-`4` and `]`/`[`; the tab is derived from the view (`tabOf`), no new state field
- [x] [T031] [P] [US2] Help overlay lists the keys from one key map, including tabs, filter and quit (src/cli/ui/dashboard/help-overlay.ts) ↪ DEVIATION: the one key map is `KEY_MAP` in help-overlay.ts, with the tab keys on every screen
- [x] [T032] [US2] Tests: a keys-only tour (tab, move, open detail, back, quit), help lists the keys, a dead key changes nothing, the terminal is restored on quit, interrupt and error — 032:FR-004, FR-005 (test/ui/overview-tabs-keys.test.ts)
- **Verify:** `npx vitest run test/ui/overview-tabs-keys.test.ts test/ui/fullscreen.test.ts` pass and the existing overview reducer tests are unchanged. ✓ passed
- **Checkpoint:** US-2 reducer-complete; the tab bar itself waits for the design.

## Phase 5 — User story US-3  (priority: P2)

- [x] [T040] [US3] Wire the list filter into the reducer: `/` searches, `s` cycles the state filter, `esc` clears (src/cli/ui/interactive/overview.ts) ↪ DEVIATION: the overview keeps its `Filters` model (exact `f` feature filter, `s` status, `esc`); `/` adds a free-text search (`Filters.search`, matched in `applyFilters`). The `ListFilter` slice (T011) is built and tested; with the signed-off design (T050) the filter is one shared line under the tab bar, wired to the fleet lanes, the graph stories and the quality features in tab mode (T063, test/ui/tabs-filter.test.ts)
- [x] [T041] [P] [US3] Plain-text filter line and the no-match message with how to clear (src/cli/ui/dashboard/filter-line.ts) ↪ DEVIATION: the module holds the plain text for the story and lane lists; the overview keeps its pinned `[feature=… status=…]` note and no-match line (014/017 tests)
- [x] [T042] [US3] Tests: search by text and ID, filter by state, nothing matches, clear restores the list — 032:FR-006 (test/ui/overview-filter.test.ts)
- **Verify:** `npx vitest run test/ui/overview-filter.test.ts test/ui/list-filter.test.ts` pass. ✓ passed: the overview feature list; the lane, story and feature lists follow in tab mode (test/ui/tabs-filter.test.ts)
- **Checkpoint:** US-3 demoable on the existing overview.

## Phase 6 — Person gates  (block Phases 7–9 and 11)

- [x] [T050] Person task: run `/amby.design` for the tab frame, tab bar, metrics panel and state tokens, review and sign off; record `signed_off` (specs/032-dashboard-redesign-and-metrics/ui.md, specs/032-dashboard-redesign-and-metrics/design-tokens.json)
- [x] [T051] Gate: spec 030 merged into main (reader and writer available); then switch T023's `readRevisionModel` to the dispatcher (src/core/metrics/index.ts)
- [x] [T052] Gate: spec 031 merged into main (lane grouping across features available); record its function name (specs/032-dashboard-redesign-and-metrics/research.md)
- **Verify:** `ui.md` exists with `signed_off` set; `src/core/spec-format/dispatch.ts` is on main; 031's grouping function is exported. ✓ passed: ui.md and design-tokens.json signed off 2026-11-19; T051 and T052 satisfied
- **Checkpoint:** design signed off (2026-11-19); 030 and 031 available.

## Phase 7 — User story US-1  (priority: P1)

- [x] [T060] [P] [US1] Tab bar renderer from the signed-off tokens, active tab marked (src/cli/ui/dashboard/tab-bar.ts) ↪ DEVIATION: the tab bar is one row directly above each screen's own header, not inside a new outer heavy frame: the existing screens draw their own headers and frames, and FR-003 keeps them unchanged; tokens are mirrored in tab-tokens.ts (test/ui/tab-tokens.test.ts keeps them in sync)
- [x] [T061] [P] [US1] Empty state per tab: what is missing and how to get data (src/cli/ui/dashboard/empty-state.ts) ↪ DEVIATION: the per-tab copy is `TAB_EMPTY` in empty-state.ts and is rendered (framed on a terminal, plain lines otherwise) by `tabEmptyBody` in tab-frame.ts
- [x] [T062] [P] [US4] Metrics panel (cycle time per phase, converge gap trend, "not enough data") in the quality tab (src/cli/ui/dashboard/metrics-panel.ts)
- [x] [T063] [US1] Host the existing views as tab bodies, replace the scattered view and quality switches, no loss of information (src/cli/ui/interactive/overview.ts, src/cli/ui/dashboard/render-overview.ts) ↪ DEVIATION: tab mode is `OverviewTuiData.tabs`, set only by the interactive command, so one-shot, --json and every earlier test render as before; `tabOf` maps the existing `view`/`quality` state onto the tabs and `renderOverviewTui` wraps the screen body (the old fields are the tab bodies' state, not removed)
- [x] [T064] [US1] Tests: parity of every existing panel's content in its tab against the 1.6.0 rendering, tab bar, empty states, metrics panel — 032:FR-001, FR-002, FR-003, FR-007, FR-008 (test/ui/tabs-render.test.ts, test/ui/tabs-parity.test.ts) ↪ DEVIATION: tests are test/ui/tabs-render.test.ts and test/ui/tabs-parity.test.ts (plus test/ui/tab-tokens.test.ts for the token mirror)
- **Verify:** `npx vitest run test/ui/tabs-render.test.ts test/ui/tabs-parity.test.ts` pass; the overview, feature, graph, fleet and quality renderers' existing tests are unchanged. ✓ passed: tabs-render and tabs-parity pass with the token-mirror test; the overview, feature, graph, fleet and quality renderers' existing tests are unchanged
- **Checkpoint:** US-1 demoable: four tabs with metrics in quality.

## Phase 8 — User story US-7  (priority: P2)

- [x] [T070] [US7] One state token set (working, blocked, done, stalled) used by every tab; spacing and headings from the design (src/cli/ui/dashboard/tokens.ts) ↪ DEVIATION: the shared state set is `semantic.state.*` in design-tokens.json, mirrored in tab-tokens.ts (not tokens.ts); the renderers reuse 029's `stateGlyph`/`stateCell`, so lane rows and feature headers share one glyph, word and color
- [x] [T071] [US7] Tests: a state renders identically in every tab — 032:FR-015 (test/ui/state-consistency.test.ts)
- **Verify:** `npx vitest run test/ui/state-consistency.test.ts` pass. ✓ passed: state-consistency passes
- **Checkpoint:** one look across tabs.

## Phase 9 — User story US-6  (priority: P1)

- [x] [T080] [US6] Narrow layout for the tab bar and each tab body, reusing 029's compact breakpoint (src/cli/ui/dashboard/layout.ts)
- [x] [T081] [US6] New tabs, states and lanes use 029's icon tokens and the `dashboard.icons` precedence (src/cli/ui/dashboard/fleet-tokens.ts) ↪ DEVIATION: the new glyphs follow `iconGlyph` in layout.ts (ASCII with --icons=ascii or without unicode, unicode otherwise, Nerd reuses unicode as in 029); the state glyphs reuse 029's `stateGlyph`, so no new icon token file was needed
- [x] [T082] [US6] Redraw on resize; piped output falls back to plain (src/cli/dashboard.ts) ↪ DEVIATION: resize and piped fallback already existed (017 FR-013: the fullscreen host calls `resize` before each redraw; the command goes one-shot when output is not a terminal); this change only sets tab mode and injects the grouped Fleet tab in src/cli/dashboard.ts, and test/ui/tabs-terminals.test.ts drives a real resize through the host
- [x] [T083] [US6] Tests: narrow, no color, no icons, each icon mode, resize, piped — 032:FR-012, FR-013, FR-014 (test/ui/tabs-terminals.test.ts)
- **Verify:** `npx vitest run test/ui/tabs-terminals.test.ts` pass; every state still distinguishable with color and icons off. ✓ passed: tabs-terminals passes; every state is still distinguishable with color and icons off (checked in ASCII, no-color output)
- **Checkpoint:** works on any terminal.

## Phase 10 — User story US-5  (priority: P1)

- [x] [T090] [US5] Budget and field parity with the 030 reader in place: one-shot and `--json` under 1 s on the largest fixture, every recorded field unchanged — 032:FR-009, FR-010, FR-020 (test/cli/dashboard-budget.test.ts)
- [x] [T091] [P] [US5] Import-graph test: one-shot and `--json` never load the metrics or graph views — 032:FR-011 (test/cli/dashboard-oneshot-imports.test.ts)
- [x] [T092] [P] [US5] Output parity: non-interactive commands unchanged — 032:FR-017 (test/cli/dashboard-parity.test.ts) ↪ DEVIATION: the fixture is the standard dashboard fixture, recorded from this branch and cross-checked identical to the 1.6.0 build (main at 90e7408) for all six cases
- **Verify:** `npx vitest run test/cli/dashboard-budget.test.ts test/cli/dashboard-oneshot-imports.test.ts test/cli/dashboard-parity.test.ts` pass; the 1-second timing test is run alone. ✓ passed: the timing test also passes run alone; parity was cross-checked against the 1.6.0 build
- **Checkpoint:** scripts and CI unaffected.

## Phase 11 — Fleet tab grouping  (US-1, gated by T050 and T052)

- [x] [T100] [US1] Group lanes by feature across features using 031's grouping, inside 029's run and lane view model (src/core/fleet-view/group.ts)
- [x] [T101] [US1] Fleet tab hosts 029's view and renders the feature grouping (src/cli/ui/dashboard/fleet-view.ts) ↪ DEVIATION: the grouped renderer is src/cli/ui/dashboard/fleet-tab.ts (029's lane rows and confirm dialog are reused, `renderConfirm` is now exported); its keys (collapse, expand, delegating lane and run actions to 029's reducer for the feature under the cursor) are in overview.ts, and the command performs the intent against `selectedFleetView`
- [x] [T102] [US1] Tests: two features' lanes grouped by feature, single feature unchanged — 032:FR-018 (test/ui/fleet-tab-grouping.test.ts)
- **Verify:** `npx vitest run test/ui/fleet-tab-grouping.test.ts test/ui/fleet-view.test.ts` pass. ✓ passed: fleet-tab-grouping and the existing fleet-view tests pass
- **Checkpoint:** fleet tab complete.

## Phase 12 — Polish and integration

- [ ] [T110] [P] Docs: dashboard tabs, keys, filters, metrics and `--metrics` (docs/cli-reference.md, site/src/content/docs/cli/index.mdx)
- [x] [T111] [P] Changelog entry under [Unreleased] (CHANGELOG.md) ↪ DEVIATION: the entry says "in progress"; it is updated when the tab frame lands
- [ ] [T112] Integration batch after merging: re-record goldens (`UPDATE_GOLDEN=1 npx vitest run test/emitters-golden.test.ts`), `ambykit sync` twice, `npm run typecheck`, `npm test` (test/fixtures/emitters-golden/)
- [ ] [T113] Dogfood: a keys-only tour of all four tabs with a search and a filter on this repo's own specs and history, record the result under 032 SC-001 and SC-007 (specs/032-dashboard-redesign-and-metrics/research.md)
- **Verify:** `npm run typecheck` and `npm test` pass; sync is a no-op the second time; the tour in T113 is recorded. ? unverified until a person runs T113.
- **Checkpoint:** 032 releasable.
