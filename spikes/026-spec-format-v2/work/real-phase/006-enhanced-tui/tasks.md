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

- [x] [T001] Create `src/cli/ui/` and `src/cli/ui/interactive/` module folders
- [x] [T002] [P] Add shared UI value-object types — Capabilities, Symbols, ChangeSummary, TableModel, MenuState
- [x] [T003] [P] Add test helpers: `stripAnsi` + `fakeCapabilities()` factory for injection

```yaml
files:
  T001: ["src/cli/ui/"]
  T002: ["src/cli/ui/types.ts"]
  T003: ["test/ui/helpers.ts"]
```

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] Implement `detectCapabilities(env?, stdout?)` — isTTY/color/unicode/columns with safe defaults
- [x] [T011] [P] Implement `theme.ts` — `symbols(caps)` (unicode/ASCII) + `paint(caps,style,s)` from design-tokens
- [x] [T012] Unit-test capability detection: non-TTY / NO_COLOR / narrow / non-UTF-8 flips each field
- [x] [T013] Unit-test theme: color=false ⇒ zero ANSI; unicode=false ⇒ ASCII glyphs
- **Checkpoint:** shared capability + theme layer exists and is injectable.

```yaml
files:
  T010: ["src/cli/ui/capabilities.ts"]
  T011: ["src/cli/ui/theme.ts"]
  T012: ["test/ui/capabilities.test.ts"]
  T013: ["test/ui/theme.test.ts"]
```

## Phase 3 — User story US-1 — Cohesive message styling  (priority: P1)

- [x] [T020] [US1] Implement `render.ts` — info(passthrough)/success/warn/error/heading over theme
- [x] [T021] [US1] Refactor `BaseCommand.info/success/warn/error` to hold Capabilities and delegate to render.ts
- [x] [T022] [US1] Refactor banner to drop local `useColor()` and use `theme.paint`
- [x] [T023] [US1] Snapshot-test each message kind under color=true|false; assert `info(json)` byte-identical
- **Checkpoint:** every command's messages route through one styled renderer (US-1 demoable).

```yaml
files:
  T020: ["src/cli/ui/render.ts"]
  T021: ["src/cli/base-command.ts"]
  T022: ["src/cli/banner.ts"]
  T023: ["test/ui/render.test.ts"]
```

## Phase 4 — User story US-2 — Dashboard progress table  (priority: P1, depends US-1)

- [x] [T030] [P] [US2] Implement `progressCell(done,total)` + ProgressBar rendering with state-based fg
- [x] [T031] [P] [US2] Implement StatusBadge (status→token color, word always shown)
- [x] [T032] [US2] Implement responsive `renderTable(model)` — fit to width, drop columns by priority
- [x] [T033] [US2] Swap dashboard `formatTable` for `renderTable`; add progress + status cells; keep `--json` plain
- [x] [T034] [US2] Test: widths 120/80/40 never overflow, drop by priority; ProgressCell fill ratio; ASCII bar
- [x] [T035] [US2] Regression test: `dashboard --json` output byte-identical to pre-change
- **Checkpoint:** `ambykit dashboard` shows progress bars + status colors; JSON unchanged (US-2 demoable).

```yaml
files:
  T030: ["src/cli/ui/table.ts"]
  T031: ["src/cli/ui/table.ts"]
  T032: ["src/cli/ui/table.ts"]
  T033: ["src/cli/dashboard.ts"]
  T034: ["test/ui/table.test.ts"]
  T035: ["test/cli/dashboard-json.test.ts"]
```

## Phase 5 — User story US-3 — Multi-step feedback & change summary  (priority: P2, depends US-1)

- [x] [T040] [P] [US3] Implement `spinner(caps)` — animating on TTY, no-op static line otherwise
- [x] [T041] [P] [US3] Implement `summarize(caps,result,{dryRun})` over WriteResult with token colors
- [x] [T042] [US3] Wire spinner + summary into sync
- [x] [T043] [US3] Wire spinner + summary into init and add
- [x] [T044] [US3] Wire spinner + summary into upgrade
- [x] [T045] [US3] Test: summarize counts + dry-run "would" wording; non-TTY spinner emits no control codes
- **Checkpoint:** init/add/sync/upgrade show live feedback + change summary (US-3 demoable).

```yaml
files:
  T040: ["src/cli/ui/progress.ts"]
  T041: ["src/cli/ui/progress.ts"]
  T042: ["src/cli/sync.ts"]
  T043: ["src/cli/init.ts", "src/cli/add.ts"]
  T044: ["src/cli/upgrade.ts"]
  T045: ["test/ui/progress.test.ts"]
```

## Phase 6 — User story US-4 — Clean degradation  (priority: P2, depends US-1)

- [x] [T050] [US4] Audit all render/table/progress call sites gate correctly on Capabilities (no stray ANSI)
- [x] [T051] [US4] Test: non-TTY + NO_COLOR ⇒ zero ANSI across message/table/summary (SC-002)
- [x] [T052] [US4] Test: unicode=false ⇒ ASCII glyphs/bars everywhere; narrow width stays aligned
- **Checkpoint:** output is clean/aligned in non-TTY, NO_COLOR, ASCII, and narrow terminals (US-4 demoable).

```yaml
files:
  T050: ["src/cli/ui/"]
  T051: ["test/ui/degradation.test.ts"]
  T052: ["test/ui/degradation.test.ts"]
```

## Phase 7 — User story US-5 — Errors & warnings with next steps  (priority: P3, depends US-1)

- [x] [T060] [US5] Add `error(caps,s,next?)` next-step line + ensure error≠warn visual treatment
- [x] [T061] [US5] Add actionable next-step hints to existing error/warn sites (base-command + commands)
- [x] [T062] [US5] Test: error vs warn styles distinct; next-step `→` line renders and is muted
- **Checkpoint:** errors/warnings are distinct and name a concrete next step (US-5 demoable).

```yaml
files:
  T060: ["src/cli/ui/render.ts"]
  T061: ["src/cli/base-command.ts"]
  T062: ["test/ui/render.test.ts"]
```

## Phase 8 — User story US-6 — Interactive full-screen dashboard  (priority: P3, depends US-2)

- [x] [T070] [US6] Implement `runFullscreen(caps,{render,reduce,initial})` — alt-screen, raw mode, guaranteed restore + signals
- [x] [T071] [US6] Implement pure dashboard reducer + view — list/detail/quit navigation
- [x] [T072] [US6] Add `--interactive` flag to dashboard; launch fullscreen on TTY, fall back to one-shot otherwise
- [x] [T073] [US6] Test: reducer nav (↑/↓/enter/←/q) transitions; non-TTY falls back; restore sequence emitted
- **Checkpoint:** `ambykit dashboard --interactive` navigates stories and restores the terminal (US-6 demoable).

```yaml
files:
  T070: ["src/cli/ui/interactive/fullscreen.ts"]
  T071: ["src/cli/ui/interactive/dashboard.ts"]
  T072: ["src/cli/dashboard.ts"]
  T073: ["test/ui/interactive-dashboard.test.ts"]
```

## Phase 9 — User story US-7 — Interactive prompt for init/add  (priority: P3, depends US-1)

- [x] [T080] [US7] Implement `multiSelect(caps,{message,options,preselected})` — pure reducer + keypress host
- [x] [T081] [US7] Wire init/add to prompt when tool flags absent on a TTY; flags always suppress prompt
- [x] [T082] [US7] Non-TTY + missing selection ⇒ actionable error, never blocks
- [x] [T083] [US7] Test: simulated space/enter selection; flags skip prompt; non-TTY errors not hangs
- **Checkpoint:** init/add prompt interactively yet stay scriptable via flags (US-7 demoable).

```yaml
files:
  T080: ["src/cli/ui/interactive/prompt.ts"]
  T081: ["src/cli/init.ts", "src/cli/add.ts"]
  T082: ["src/cli/init.ts", "src/cli/add.ts"]
  T083: ["test/ui/prompt.test.ts"]
```

## Phase 10 — Polish

- [x] [T090] Document the enhanced UI + `--interactive`/prompt behavior in user docs
- [x] [T091] Re-run `ambykit sync` so the repo's own tool files stay in sync (Principle 6)
- [x] [T092] Run `npm run typecheck` and `npm test`; update snapshots; ensure all green before commit (—)

```yaml
files:
  T090: ["docs/"]
  T091: [".claude/"]
```
