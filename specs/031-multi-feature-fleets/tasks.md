---
feature: 031-multi-feature-fleets
created: 2026-11-19
---

# Tasks — Multi-feature fleets

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes. **Extra gates:** (1) **030 merged** (person task
> T019) before any task that binds the real reader or writer, that is T020 and everything after it; Phases 1-2 use
> fixture models only; (2) 028 and 029 are merged (1.6.0); (3) runners are unverified until 028 T044/T045, so the
> dogfood task T094 needs a live runner. Dependencies: specs 023, 025, 028, 029, 030. Tests name what they cover as
> `031:FR-###`.
> Story order: US-1 → US-3 → US-2 → US-4 → US-5 → US-6, US-8 → US-7 → US-9 (US-9 is also checked at the end).
> Within a phase, tasks run in file order unless marked `[P]` (disjoint files, no sibling dependency).

## Phase 1 — Setup

- [x] [T001] Fixture helper: temp project with N features (spec, tasks with paths, optional feature-level `depends-on`), as injected models and as files (test/helpers/fleet-plan-fixture.ts)
- [x] [T002] Types: `FeatureModel`, `FleetPlan`, `FleetRecord`, `FleetFeature` exactly as in data-model.md (src/core/fleet-plan/types.ts, src/core/fleet-plan/index.ts)
- **Verify:** `npm run typecheck` passes and the fixture builds a three-feature project with a dependency and an overlap. ✓ passed

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] `read.ts`: the one adapter that turns a feature into a `FeatureModel` (stories, feature `dependsOn`, tasks with `paths` and `pathIssue`); models are injected, the 030 binding comes in T020 (src/core/fleet-plan/read.ts) ↪ DEVIATION: bound to the real 030 reader at once (readFleetInput over readFeatures and the 023 graph), so T020's binding is done here; spec status is read through readSpec
- [x] [T011] [P] `ownership.ts`: feature path set as the union of task paths; a task with missing ownership puts the feature in `unknown` (src/core/fleet-plan/ownership.ts, test/core/fleet-ownership.test.ts) ↪ DEVIATION: ownership counts open tasks only (a done task's file is already merged) and treats a glob as unknown ownership; sharedFiles/conflicts live here too
- [x] [T012] [P] `order.ts`: feature DAG from feature `depends-on`, story edges and shared-file serialization (naming the files); topological order, ties by dependency order then number; cycle and missing-dependency errors (src/core/fleet-plan/order.ts, test/core/fleet-order.test.ts)
- [x] [T013] [P] `schedule.ts`: which features may start, and which lanes start under fleet caps via `nextToStart` (src/core/fleet-plan/schedule.ts, test/core/fleet-schedule.test.ts)
- [x] [T014] [P] `contain.ts`: pause closure of a paused feature and its transitive dependents; release on resume (src/core/fleet-plan/contain.ts, test/core/fleet-contain.test.ts)
- [x] [T015] [P] `budget.ts`: fleet-wide task, wall-clock and token sums over `budgetDecision`; token ceiling not enforced when a runner reports no usage (src/core/fleet-plan/budget.ts, test/core/fleet-budget.test.ts)
- [x] [T016] [P] `fleets.ts`: `.amby/fleet/fleet-<n>/`, `fleet.json` read and write, next fleet id, and nested run lookup in `runDir`, `readRun`, `listRuns`, `resolveRun` (src/core/fleet/fleets.ts, src/core/fleet/runs.ts, src/core/fleet/index.ts, test/core/fleet-fleets.test.ts) ↪ DEVIATION: nested lookup is in runDir/listRuns/damagedRuns (resolveRun and readRun follow); the record functions are readFleetRecord/writeFleetRecord to avoid 029's readFleet; createRun takes an optional fleet
- [x] [T017] [P] `Session.slots` hook: lanes running in the other sessions count toward the total and per-type caps; absent means today's behavior (src/cli/run-session.ts, src/cli/run-launch.ts, test/cli/run-fleet-slots.test.ts) ↪ DEVIATION: the hook returns the other sessions' running lanes ({lane, assistant}[]) instead of totals, so nextToStart counts them unchanged
- [x] [T018] `fleetView(root)`: features, then runs, then lanes with states, for `ambykit fleet --json` and the 029/032 views (src/core/fleet/fleet-view.ts, test/core/fleet-view.test.ts) ↪ DEVIATION: exported as fleetsView; features carry cause and affected for paused ones (T052 data)
- [x] [T019] **Person gate:** confirm spec 030 is merged into `main` and that its reader (`readSpec`, `readTasks`: `dependsOn`, `paths`, `pathIssue`) and writer match what `read.ts` assumes; if not, adjust only `read.ts` (specs/031-multi-feature-fleets/plan.md) ↪ DEVIATION: 030 merged into main in PR #39 (d7bbc5f); readFeatures/readSpec/readTasks match what read.ts assumes, no change needed
- **Verify:** `npm run typecheck` and `npx vitest run test/core/fleet-ownership.test.ts test/core/fleet-order.test.ts test/core/fleet-schedule.test.ts test/core/fleet-contain.test.ts test/core/fleet-budget.test.ts test/core/fleet-fleets.test.ts test/core/fleet-view.test.ts test/cli/run-fleet-slots.test.ts` pass; the existing run and fleet tests are unchanged. ✓ passed
- **Checkpoint:** the pure core is done and 030 is merged. User stories may start.

## Phase 3 — User story US-1  (priority: P1)

- [ ] [T020] [US1] Bind `read.ts` to 030's reader and add a source-scan test: no markdown or YAML parsing inside `src/core/fleet-plan/` (src/core/fleet-plan/read.ts, test/core/fleet-plan-read.test.ts)
- [ ] [T021] [P] [US1] `select.ts`: resolve numbers and names, de-duplicate, stop on a missing or not-ready feature with the reason; `--all-ready` selection with skipped reasons (src/core/fleet-plan/select.ts, test/core/fleet-select.test.ts)
- [ ] [T022] [P] [US1] Lane preparation (C-2): prepare missing next-phase lanes with the lane core and report it; refuse with the `ambykit lane` hint when it cannot (src/cli/run-fleet-prepare.ts, test/cli/run-fleet-prepare.test.ts)
- [ ] [T023] [US1] `buildFleetPlan`: select, ownership, order and caps into one `FleetPlan`; its text and `--json` preview (src/core/fleet-plan/plan.ts, src/core/fleet-plan/format.ts, test/core/fleet-plan.test.ts)
- [ ] [T024] [US1] `ambykit run <f1> <f2>`: preview, `--yes`, decline starts nothing; one feature falls through to the unchanged single run (src/cli/run-fleet.ts, src/cli/run.ts, test/cli/run-fleet-start.test.ts)
- **Verify:** `npx vitest run test/core/fleet-plan-read.test.ts test/core/fleet-select.test.ts test/core/fleet-plan.test.ts test/cli/run-fleet-prepare.test.ts test/cli/run-fleet-start.test.ts` pass; a three-feature fixture prints one plan listing every feature's lanes and start order.
- **Checkpoint:** US-1 is demoable: a fleet plan is shown, confirmed or declined.

## Phase 4 — User story US-3  (priority: P1)

- [ ] [T030] [US3] `FleetSupervisor` skeleton: one `Session` per feature in its own run dir inside the fleet dir; a feature starts only when everything it waits for is done (src/cli/run-fleet-loop.ts, test/cli/run-fleet-loop.test.ts)
- [ ] [T031] [US3] Before a dependent starts, merge the finished feature's branch into its worktree; a conflict pauses that feature only (src/cli/run-fleet-merge.ts, test/cli/run-fleet-merge.test.ts)
- [ ] [T032] [US3] End-to-end with fake port and clock: dependency waits, chain order, missing dependency and cycle stop before starting (test/cli/run-fleet-deps.test.ts)
- **Verify:** `npx vitest run test/cli/run-fleet-loop.test.ts test/cli/run-fleet-merge.test.ts test/cli/run-fleet-deps.test.ts` pass; with B depending on A, no lane of B starts before A's run is done.
- **Checkpoint:** US-3 is demoable.

## Phase 5 — User story US-2  (priority: P1)

- [ ] [T040] [US2] Serialize features that share files in the loop, in dependency order then number; independent features run together (src/cli/run-fleet-loop.ts, test/cli/run-fleet-serialize.test.ts)
- [ ] [T041] [US2] Show each serialization with the shared files, and `unknown ownership: T###` flags, in the plan preview (src/core/fleet-plan/format.ts, test/core/fleet-plan-format.test.ts)
- [ ] [T042] [US2] Mixed 1.x and 2.x features give the same ownership and dependencies (test/core/fleet-plan-mixed.test.ts)
- **Verify:** `npx vitest run test/cli/run-fleet-serialize.test.ts test/core/fleet-plan-format.test.ts test/core/fleet-plan-mixed.test.ts` pass; two overlapping features never have running lanes at the same time.
- **Checkpoint:** US-2 is demoable.

## Phase 6 — User story US-4  (priority: P1)

- [ ] [T050] [US4] Apply containment in the loop: a feature whose lane is paused or escalated holds its dependents, independent features keep running (src/cli/run-fleet-loop.ts, test/cli/run-fleet-contain.test.ts)
- [ ] [T051] [US4] Resume of a paused feature releases its dependents (src/cli/run-fleet-loop.ts, src/cli/run-fleet-resume.ts, test/cli/run-fleet-resume.test.ts)
- [ ] [T052] [US4] Show the cause and the affected features in `fleetView` and the fleet text output (src/core/fleet/fleet-view.ts, src/cli/fleet.ts, test/cli/fleet-fleets-status.test.ts)
- **Verify:** `npx vitest run test/cli/run-fleet-contain.test.ts test/cli/run-fleet-resume.test.ts test/cli/fleet-fleets-status.test.ts` pass; a failed lane pauses its feature and dependents while an independent feature finishes.
- **Checkpoint:** US-4 is demoable.

## Phase 7 — User story US-5  (priority: P1)

- [ ] [T060] [US5] Wire the `slots` hook across all sessions with the fleet default of 3 total and 2 per type, overriding 028's per-feature cap inside a fleet (src/cli/run-fleet-loop.ts, test/cli/run-fleet-caps.test.ts)
- [ ] [T061] [US5] Fleet-wide budgets: sum meters over sessions, stop starting new work at a ceiling (src/cli/run-fleet-loop.ts, src/cli/run-fleet-budget.ts, test/cli/run-fleet-budget.test.ts)
- [ ] [T062] [US5] Say so when a token ceiling is set and a runner reports no usage (src/cli/run-fleet-budget.ts, test/cli/run-fleet-budget-usage.test.ts)
- **Verify:** `npx vitest run test/cli/run-fleet-caps.test.ts test/cli/run-fleet-budget.test.ts test/cli/run-fleet-budget-usage.test.ts` pass; no more than the configured lanes, in total and per type, run at once.
- **Checkpoint:** US-5 is demoable.

## Phase 8 — User stories US-6 and US-8  (priority: P2)

- [ ] [T070] [US6] Per-feature approval gates and merges inside the fleet: only the gated or conflicting feature waits (src/cli/run-fleet-loop.ts, test/cli/run-fleet-gates.test.ts)
- [ ] [T071] [US6] Pause or stop writes one directive per lane through the core writer across every session (src/cli/run-fleet-control.ts, test/cli/run-fleet-control.test.ts)
- [ ] [T072] [US6] One status view of every feature's lanes: `ambykit fleet` text and `--json` group by feature (src/cli/fleet.ts, src/core/fleet/fleet-view.ts, test/cli/fleet-fleets-view.test.ts)
- [ ] [T073] [US8] Fleet record, fingerprints, and `--continue-fleet=<id>`: re-plan on resume, report what changed, never repeat finished lanes (src/cli/run-fleet.ts, src/core/fleet/fleets.ts, test/cli/run-fleet-continue.test.ts)
- [ ] [T074] [US8] `report_activity` without a run resolves the feature's unfinished run inside its fleet dir (test/mcp/fleet-nested-run.test.ts)
- **Verify:** `npx vitest run test/cli/run-fleet-gates.test.ts test/cli/run-fleet-control.test.ts test/cli/fleet-fleets-view.test.ts test/cli/run-fleet-continue.test.ts test/mcp/fleet-nested-run.test.ts` pass; stopping a fleet and starting it again repeats no completed lane.
- **Checkpoint:** US-6 and US-8 are demoable.

## Phase 9 — User story US-7  (priority: P3)

- [ ] [T080] [US7] Wire `--all-ready` into the command: choose ready features, show chosen and skipped with reasons, start nothing when none is ready (src/cli/run-fleet.ts, test/cli/run-fleet-all-ready.test.ts)
- **Verify:** `npx vitest run test/cli/run-fleet-all-ready.test.ts` passes.
- **Checkpoint:** US-7 is demoable.

## Phase 10 — User story US-9  (priority: P2)

- [ ] [T085] [US9] Single feature and existing commands behave exactly as before: same output and events with and without the fleet code (test/cli/run-single-unchanged-031.test.ts)
- **Verify:** `npx vitest run test/cli/run-single-unchanged-031.test.ts` passes and the full 028 run test files pass unchanged.
- **Checkpoint:** US-9 is verified.

## Phase 11 — Polish and integration

- [ ] [T090] Docs: fleets in the run guide and `docs/cli-reference.md`, the fleet directory layout, the C-1 and C-2 rules, and the experimental status carried from 028 (docs/cli-reference.md, docs/architecture.md)
- [ ] [T091] Changelog `[Unreleased]` entry with the `Plugins:` line, and the structure line in AGENTS.md if a verb is added (CHANGELOG.md, AGENTS.md)
- [ ] [T092] `ambykit trace 031` shows every FR covered; fix any gap; `ambykit analyze` shows no cycles, dangling references or lane conflicts (specs/031-multi-feature-fleets/tasks.md)
- [ ] [T093] Integration, once after merging: golden re-record, `ambykit sync` twice, full tests (test/fixtures/emitters-golden/)
- [ ] [T094] **Person task, the 2.0 gate (SC-001):** with a verified live runner, build two dependent features with one fleet and no manual start, order or merge; record the run id and result (specs/031-multi-feature-fleets/research.md)
- [ ] [T095] **Person task:** confirm which runners were verified for T094 and update 028's verified flags only on evidence (src/core/runners.ts)
- **Verify:** `npm run typecheck`, `npm test` and `node dist/cli/index.js trace 031` pass; T094 is checked only after a real fleet run.
- **Checkpoint:** 031 is releasable; the 2.0 fleet gate is recorded.
