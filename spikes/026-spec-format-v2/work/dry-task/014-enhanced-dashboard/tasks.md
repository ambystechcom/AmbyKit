---
feature: 014-enhanced-dashboard
created: 2026-10-18
---

# Tasks — Enhanced dashboard — widgets and charts

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Design refs: `plan.md` (phases, mapping), `research.md` (R-#), `data-model.md` (I-#),
> `contracts/dashboard-json.md`, signed-off `ui.md` + `design-tokens.json`.

## Phase 1 — Setup

- [x] [T001] Shared overview fixture builder: 3 features / 10 stories / 25 of 40 tasks, plus blocked, waiting, cycle, unknown-ref, not-planned, duplicate `008-*`, unknown status, unassigned task, malformed file (test/helpers/dashboard-fixture.ts)
- [x] [T002] [P] Perf fixture generator: 30 features / 1,000 tasks for SC-003 (test/helpers/dashboard-perf-fixture.ts)
- [x] [T003] [P] Temp git repo helper committing `tasks.md` check-offs at fixed GIT_*_DATE values (test/helpers/git-history-fixture.ts)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Data-model types: Status, Phase, FeatureSnapshot, ParseIssue, Filters, Overview, Burndown (src/core/overview-types.ts)
- [x] [T011] [P] Clarification counter ignoring inline code + fenced blocks, with line/text capture — R-1 (src/core/clarifications.ts)
- [x] [T012] [P] Tests for the clarification counter, incl. this repo's 014 spec counting 0 (test/core/clarifications.test.ts)
- [x] [T013] `readFeatures(root)`: one pass over `specs/*`, artifacts, `ui.md` signed_off via gray-matter, tasks or null, ParseIssue on failure, unique displayRef — I-5, FR-014 (src/core/features.ts)
- [x] [T014] Tests for `readFeatures`: malformed file skipped and named, duplicate `008-*` display refs, missing tasks.md → null (test/core/features.test.ts)
- [x] [T015] [P] Export `resolveDepKey` from analyze.ts (no behavior change) (src/core/analyze.ts)
- [x] [T016] [P] Add `truecolor` + `background` to Capabilities and detect via COLORTERM / COLORFGBG — R-3 (src/cli/ui/capabilities.ts)
- [x] [T017] [P] Capability detection tests for truecolor/background, incl. fallback to ansi16 + dark (test/ui/capabilities.test.ts)
- [x] [T018] `paintToken(caps, token, s)` resolving truecolor.dark/light → ansi16 → none (src/cli/ui/theme.ts)
- [x] [T019] Dashboard token mirror of 014 design-tokens.json: glyph pairs, colors, spaces, limits (src/cli/ui/dashboard/tokens.ts)
- [x] [T020] [P] Test that tokens.ts matches specs/014-enhanced-dashboard/design-tokens.json (test/ui/dashboard-tokens.test.ts)
- [x] [T021] Framed panel: normal/focused frame, title with count, truncation `…`, `+N more` elision, ASCII frames (src/cli/ui/dashboard/panel.ts)
- [x] [T022] [P] Panel tests across unicode/ASCII and focused/normal (test/ui/dashboard-panel.test.ts)
- [x] [T023] Layout mode selection wide | narrow | plain from caps per ui.md Capability states (src/cli/ui/dashboard/layout.ts)
- [x] [T024] `computeOverview` skeleton: filters applied first (feature by ref or dir, status) — I-9, FR-011 (src/core/overview.ts)

## Phase 3 — User story US-1  (priority: P1)

- [x] [T030] [US1] Summary aggregate (features, stories, tasks, percent null on 0 tasks) — I-1, FR-002 (src/core/overview.ts)
- [x] [T031] [P] [US1] Summary value tests on fixture: 3 / 10 / 25 of 40 / 63% and empty project — SC-002 (test/core/overview-summary.test.ts)
- [x] [T032] [US1] Header + SummaryCard widgets incl. COMPLETE bar with eighths and empty state (src/cli/ui/dashboard/cards.ts)
- [x] [T033] [US1] Compose overview (header, cards, hint line, parse notices) in wide/narrow/plain (src/cli/ui/dashboard/render-overview.ts)
- [x] [T034] [US1] Default one-shot → overview; keep old table behind `--stories`; empty project renders zeroed cards + hint, exit 0 — FR-013, FR-015 (src/cli/dashboard.ts)
- [x] [T035] [P] [US1] Snapshots: wide, narrow, plain, ASCII, NO_COLOR, empty (test/ui/dashboard-overview.test.ts)
- [x] [T036] [P] [US1] CLI tests: default output, `--stories` table, story detail unchanged, non-TTY plain — FR-015, FR-016 (test/cli/dashboard-overview.test.ts)
- **Checkpoint:** US-1 is demoable — `ambykit dashboard` shows summary cards; existing tests pass unchanged.

## Phase 4 — User story US-2  (priority: P1)

- [x] [T040] [US2] Status counts with fixed order and `other` bucket — I-2, FR-003 (src/core/overview.ts)
- [x] [T041] [US2] Feature rows ordered by number then dir, percent or not-planned, phase, clarifications — I-3, I-7, FR-005, FR-010 (src/core/overview.ts)
- [x] [T042] [P] [US2] Tests for status counts, feature ordering, not-planned, phase derivation (test/core/overview-charts.test.ts)
- [x] [T043] [P] [US2] Status stacked bar with largest-remainder widths and glyph legend — FR-004, FR-006 (src/cli/ui/dashboard/status-chart.ts)
- [x] [T044] [P] [US2] Feature completion chart with phase + clarif. columns and truncation (src/cli/ui/dashboard/feature-chart.ts)
- [x] [T045] [US2] Wire both charts into the overview composition (src/cli/ui/dashboard/render-overview.ts)
- [x] [T046] [P] [US2] Chart snapshots incl. NO_COLOR distinguishability — SC-006 (test/ui/dashboard-charts.test.ts)
- **Checkpoint:** US-2 is demoable — status and feature charts render and match fixture counts.

## Phase 5 — User story US-3  (priority: P2)

- [x] [T050] [US3] Attention items: graph problems from analyzeGraph, blocked (status or not-done blocked-by), waiting; ranked, deduped — I-4, FR-007, FR-008 (src/core/overview.ts)
- [x] [T051] [P] [US3] Attention tests: done blockers hidden, cycle + unknown ref flagged first, done stories excluded (test/core/overview-attention.test.ts)
- [x] [T052] [US3] Attention panel with kind glyphs, "Nothing blocked." and `+N more` (src/cli/ui/dashboard/attention.ts)
- [x] [T053] [US3] Wire Attention into wide (side-by-side) and narrow/plain (stacked) layouts (src/cli/ui/dashboard/render-overview.ts)
- [x] [T054] [P] [US3] Attention snapshots incl. empty state (test/ui/dashboard-attention.test.ts)
- **Checkpoint:** US-3 is demoable — blocked/waiting/graph problems listed with reasons.

## Phase 6 — User story US-4  (priority: P2)

- [x] [T060] [US4] Up-next selection: undone tasks of stories not in attention, feature then T### order, cap, eligible, allDone — I-6, FR-009 (src/core/overview.ts)
- [x] [T061] [P] [US4] Up-next tests: blocked-story tasks excluded, unassigned included, cap, all-done (test/core/overview-upnext.test.ts)
- [x] [T062] [US4] Up-next panel with `<shown> of <total>` title and `/amby.converge` completion line (src/cli/ui/dashboard/up-next.ts)
- [x] [T063] [US4] `--next=N` flag parsing; invalid value → error, exit 1 — R-4 (src/cli/dashboard.ts)
- [x] [T064] [P] [US4] Up-next snapshots and `--next` CLI tests (test/cli/dashboard-upnext.test.ts)
- **Checkpoint:** US-4 is demoable — the next 5 ready tasks appear; `--next=3` changes the cap.

## Phase 7 — User story US-5  (priority: P3)

- [x] [T070] [US5] Feature view: ARTIFACTS, OPEN CLARIFICATIONS, STATUS panels + existing story table with Waiting-on column (src/cli/ui/dashboard/feature-view.ts)
- [x] [T071] [US5] `--feature=X` one-shot renders the feature view; all widgets filtered — FR-011 (src/cli/dashboard.ts)
- [x] [T072] [P] [US5] Feature view snapshots + filter propagation tests (test/ui/dashboard-feature-view.test.ts)
- [x] [T073] [US5] Optional backward-compatible `start(update)` hook on the fullscreen host (src/cli/ui/interactive/fullscreen.ts)
- [x] [T074] [US5] Interactive overview reducer/renderer: panel focus (tab), cursor, ⏎ open, esc back, `f` filter input, `s` status cycle, `q`; delegates story list/detail to existing module (src/cli/ui/interactive/overview.ts)
- [x] [T075] [US5] `--interactive` launches the overview TUI (TTY only, plain fallback otherwise) (src/cli/dashboard.ts)
- [x] [T076] [P] [US5] Reducer + render tests for the interactive overview and the `start` hook; existing interactive tests untouched (test/ui/interactive-overview.test.ts)
- **Checkpoint:** US-5 is demoable — feature view via `--feature` and interactive navigation work.

## Phase 8 — User story US-7  (priority: P3)

- [x] [T080] [US7] `readTaskHistory`: one `git log` + one `git cat-file --batch`, scoped by feature, no-history reasons — R-2, FR-019 (src/core/burndown.ts)
- [x] [T081] [US7] Add a stdin-capable sync git helper for `cat-file --batch` (src/core/git.ts)
- [x] [T082] [US7] `buildBurndown`: period choice, per-period sampling, carry-forward, working-tree last point, delta — I-8 (src/core/burndown.ts)
- [x] [T083] [P] [US7] Burndown tests on the temp git repo: values per period, non-repo, too little history, feature scope — FR-018, FR-019 (test/core/burndown.test.ts)
- [x] [T084] [US7] Burndown chart: stacked columns, axes, labels, legend, no-history and computing states (src/cli/ui/dashboard/burndown-chart.ts)
- [x] [T085] [US7] Wire burndown into one-shot (sync), plain series line, and interactive (async via `start`) (src/cli/ui/dashboard/render-overview.ts)
- [x] [T086] [P] [US7] Burndown snapshots: wide, narrow, ASCII, plain, no-history, computing — FR-018 (test/ui/dashboard-burndown.test.ts)
- **Checkpoint:** US-7 is demoable — burndown shows on this repo; non-git project shows "No history available".

## Phase 9 — User story US-6  (priority: P3)

- [x] [T090] [US6] `--json --overview` object per contract; bare `--json` path untouched — FR-012 (src/cli/dashboard.ts)
- [x] [T091] [P] [US6] Contract tests: `stories` equals bare `--json`, all members present, filters applied, no ANSI (test/cli/dashboard-json-overview.test.ts)
- **Checkpoint:** US-6 is demoable — CI can read aggregates; `test/cli/dashboard-json.test.ts` passes unchanged.

## Phase 10 — Polish

- [x] [T100] [P] Perf test: perf fixture renders < 1 s incl. burndown — SC-003 (test/cli/dashboard-perf.test.ts)
- [x] [T101] [P] Read-only test: working tree unchanged after a dashboard run — FR-017 (test/cli/dashboard-readonly.test.ts)
- [x] [T102] [P] Document new default output, `--stories`, `--next`, `--json --overview` (docs/cli-reference.md)
- [x] [T103] [P] CHANGELOG entry incl. default-output change (CHANGELOG.md)
- [x] [T104] Dogfood on this repo: check SC-001 fold layout at 100×30 and SC-003 timing; record results (specs/014-enhanced-dashboard/plan.md)
- [x] [T105] Run `npm run typecheck` and `npm test`; all existing dashboard tests pass unchanged — SC-005 (package.json)
- [x] [T106] [P] Local-only test: overview + burndown read only `specs/*` and git objects, no network/model access — FR-001, SC-004 (test/cli/dashboard-local-only.test.ts)
- [x] [T107] ~~Hallway test with ≥3 users~~ → layout check per revised SC-001: at 100 columns completion, blocked count and next task are in the first 30 rows; results recorded — SC-001 (specs/014-enhanced-dashboard/plan.md)

## Convergence

- [x] [T108] [US6] Make the legacy story list skip unreadable spec/tasks files (and report them) so `--json`, `--json --overview`, `--stories` and story detail no longer fail with EISDIR (closes FR-014) (src/core/dashboard.ts)
