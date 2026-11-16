---
feature: 006-enhanced-tui
created: 2026-07-07
---

# Tasks — Enhanced terminal UI for the AmbyKit CLI

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Story graph: US-1→(US-2,US-3,US-4,US-5,US-7); US-2→US-6. Types/paths from `@plan.md`,
> `@data-model.md`, `@contracts/ui.md`; tokens are binding via signed-off `@ui.md`.

## Phase 1 — Setup

- [x] [T001] Create `src/cli/ui/` and `src/cli/ui/interactive/` module folders (src/cli/ui/)
- [x] [T002] [P] Add shared UI value-object types — Capabilities, Symbols, ChangeSummary, TableModel, MenuState (src/cli/ui/types.ts)
- [x] [T003] [P] Add test helpers: `stripAnsi` + `fakeCapabilities()` factory for injection (test/ui/helpers.ts)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] Implement `detectCapabilities(env?, stdout?)` — isTTY/color/unicode/columns with safe defaults (src/cli/ui/capabilities.ts)
- [x] [T011] [P] Implement `theme.ts` — `symbols(caps)` (unicode/ASCII) + `paint(caps,style,s)` from design-tokens (src/cli/ui/theme.ts)
- [x] [T012] Unit-test capability detection: non-TTY / NO_COLOR / narrow / non-UTF-8 flips each field (test/ui/capabilities.test.ts)
- [x] [T013] Unit-test theme: color=false ⇒ zero ANSI; unicode=false ⇒ ASCII glyphs (test/ui/theme.test.ts)
- **Checkpoint:** shared capability + theme layer exists and is injectable.

## Phase 3 — User story US-1 — Cohesive message styling  (priority: P1)

- [x] [T020] [US1] Implement `render.ts` — info(passthrough)/success/warn/error/heading over theme (src/cli/ui/render.ts)
- [x] [T021] [US1] Refactor `BaseCommand.info/success/warn/error` to hold Capabilities and delegate to render.ts (src/cli/base-command.ts)
- [x] [T022] [US1] Refactor banner to drop local `useColor()` and use `theme.paint` (src/cli/banner.ts)
- [x] [T023] [US1] Snapshot-test each message kind under color=true|false; assert `info(json)` byte-identical (test/ui/render.test.ts)
- **Checkpoint:** every command's messages route through one styled renderer (US-1 demoable).

## Phase 4 — User story US-2 — Dashboard progress table  (priority: P1, depends US-1)

- [x] [T030] [P] [US2] Implement `progressCell(done,total)` + ProgressBar rendering with state-based fg (src/cli/ui/table.ts)
- [x] [T031] [P] [US2] Implement StatusBadge (status→token color, word always shown) (src/cli/ui/table.ts)
- [x] [T032] [US2] Implement responsive `renderTable(model)` — fit to width, drop columns by priority (src/cli/ui/table.ts)
- [x] [T033] [US2] Swap dashboard `formatTable` for `renderTable`; add progress + status cells; keep `--json` plain (src/cli/dashboard.ts)
- [x] [T034] [US2] Test: widths 120/80/40 never overflow, drop by priority; ProgressCell fill ratio; ASCII bar (test/ui/table.test.ts)
- [x] [T035] [US2] Regression test: `dashboard --json` output byte-identical to pre-change (test/cli/dashboard-json.test.ts)
- **Checkpoint:** `ambykit dashboard` shows progress bars + status colors; JSON unchanged (US-2 demoable).

## Phase 5 — User story US-3 — Multi-step feedback & change summary  (priority: P2, depends US-1)

- [x] [T040] [P] [US3] Implement `spinner(caps)` — animating on TTY, no-op static line otherwise (src/cli/ui/progress.ts)
- [x] [T041] [P] [US3] Implement `summarize(caps,result,{dryRun})` over WriteResult with token colors (src/cli/ui/progress.ts)
- [x] [T042] [US3] Wire spinner + summary into sync (src/cli/sync.ts)
- [x] [T043] [US3] Wire spinner + summary into init and add (src/cli/init.ts, src/cli/add.ts)
- [x] [T044] [US3] Wire spinner + summary into upgrade (src/cli/upgrade.ts)
- [x] [T045] [US3] Test: summarize counts + dry-run "would" wording; non-TTY spinner emits no control codes (test/ui/progress.test.ts)
- **Checkpoint:** init/add/sync/upgrade show live feedback + change summary (US-3 demoable).

## Phase 6 — User story US-4 — Clean degradation  (priority: P2, depends US-1)

- [x] [T050] [US4] Audit all render/table/progress call sites gate correctly on Capabilities (no stray ANSI) (src/cli/ui/)
- [x] [T051] [US4] Test: non-TTY + NO_COLOR ⇒ zero ANSI across message/table/summary (SC-002) (test/ui/degradation.test.ts)
- [x] [T052] [US4] Test: unicode=false ⇒ ASCII glyphs/bars everywhere; narrow width stays aligned (test/ui/degradation.test.ts)
- **Checkpoint:** output is clean/aligned in non-TTY, NO_COLOR, ASCII, and narrow terminals (US-4 demoable).

## Phase 7 — User story US-5 — Errors & warnings with next steps  (priority: P3, depends US-1)

- [x] [T060] [US5] Add `error(caps,s,next?)` next-step line + ensure error≠warn visual treatment (src/cli/ui/render.ts)
- [x] [T061] [US5] Add actionable next-step hints to existing error/warn sites (base-command + commands) (src/cli/base-command.ts)
- [x] [T062] [US5] Test: error vs warn styles distinct; next-step `→` line renders and is muted (test/ui/render.test.ts)
- **Checkpoint:** errors/warnings are distinct and name a concrete next step (US-5 demoable).

## Phase 8 — User story US-6 — Interactive full-screen dashboard  (priority: P3, depends US-2)

- [x] [T070] [US6] Implement `runFullscreen(caps,{render,reduce,initial})` — alt-screen, raw mode, guaranteed restore + signals (src/cli/ui/interactive/fullscreen.ts)
- [x] [T071] [US6] Implement pure dashboard reducer + view — list/detail/quit navigation (src/cli/ui/interactive/dashboard.ts)
- [x] [T072] [US6] Add `--interactive` flag to dashboard; launch fullscreen on TTY, fall back to one-shot otherwise (src/cli/dashboard.ts)
- [x] [T073] [US6] Test: reducer nav (↑/↓/enter/←/q) transitions; non-TTY falls back; restore sequence emitted (test/ui/interactive-dashboard.test.ts)
- **Checkpoint:** `ambykit dashboard --interactive` navigates stories and restores the terminal (US-6 demoable).

## Phase 9 — User story US-7 — Interactive prompt for init/add  (priority: P3, depends US-1)

- [x] [T080] [US7] Implement `multiSelect(caps,{message,options,preselected})` — pure reducer + keypress host (src/cli/ui/interactive/prompt.ts)
- [x] [T081] [US7] Wire init/add to prompt when tool flags absent on a TTY; flags always suppress prompt (src/cli/init.ts, src/cli/add.ts)
- [x] [T082] [US7] Non-TTY + missing selection ⇒ actionable error, never blocks (src/cli/init.ts, src/cli/add.ts)
- [x] [T083] [US7] Test: simulated space/enter selection; flags skip prompt; non-TTY errors not hangs (test/ui/prompt.test.ts)
- **Checkpoint:** init/add prompt interactively yet stay scriptable via flags (US-7 demoable).

## Phase 10 — Polish

- [x] [T090] Document the enhanced UI + `--interactive`/prompt behavior in user docs (docs/)
- [x] [T091] Re-run `ambykit sync` so the repo's own tool files stay in sync (Principle 6) (.claude/)
- [x] [T092] Run `npm run typecheck` and `npm test`; update snapshots; ensure all green before commit (—)
