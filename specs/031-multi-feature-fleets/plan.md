---
feature: 031-multi-feature-fleets
status: draft
created: 2026-11-19
---

# Implementation Plan — Multi-feature fleets

> The HOW. Satisfies every `FR-###` in `@spec.md`; honors `@../../.amby/constitution.md`. Data shapes: `@data-model.md`.

## Technical context

- **Stack:** TypeScript (ESM, Node >= 20), Vitest; no new dependency (P2, P3).
- **Reuses (1.6.0):** `src/core/fleet/*` (run records, directives, `laneStatus`), 028's `src/cli/run-*.ts` (Session, `Supervisor`, launch, gates, merger, budget), `nextToStart` (`src/core/run-schedule.ts`), the graph (`buildGraph`, feature edges, cycles; 023), lane declarations (`src/core/lanes.ts`).
- **Depends on spec 030 (GATE: 030 merged before Phase 3).** Reads a feature through 030's per-file reader (`readSpec`: stories and feature-level `dependsOn`; `readTasks`: tasks with `paths` and `pathIssue`) and writes task state only through 030's writer (`ambykit edit`, core `src/core/spec-format/write.ts`). Until 030 merges, only pure code tested with fixture models is built (Phases 1-2).
- **Constraints:** zero model tokens in the supervisor (P3); only verified runners launch (P4); every FR has a test, with fakes for processes and clock (P5); state only under `.amby/fleet/`, nothing outside the project (P7); the 2.0 gate is dogfooded (P6).

## Architecture

A fleet is a thin layer **above** 028: one `Session` per feature (its own run `<feature>.<n>`, lanes, gates, merge), driven by one `FleetSupervisor` that owns what is shared: order, serialization, caps, budgets, pause containment and the fleet record.

```
ambykit run <f1> <f2>... | --all-ready   (one feature => today's single run, unchanged: FR-019, US-9)
  src/core/fleet-plan/   pure, no fs/process
    read.ts       the only adapter to 030's reader (models in, no markdown parsing anywhere else)
    select.ts     resolve args, dedupe, readiness, --all-ready            (FR-001..003, 016)
    ownership.ts  feature path set from tasks; missing => conservative     (FR-006, 020)
    order.ts      feature DAG = feature-level depends-on + story edges (023 graph) + overlap serialization;
                  topological order, ties by dependency order then number; cycle / missing-dep errors (FR-004,005,007,008)
    schedule.ts   features ready to start; lane starts under fleet caps via nextToStart (FR-010, 012)
    contain.ts    pause closure: paused feature + transitive dependents    (FR-009, 013)
    budget.ts     fleet-wide token/task/wall-clock sums, 028's budgetDecision reused (FR-011)
  src/core/fleet/fleets.ts   fleet dir, fleet.json, nested run resolution, fleetView (FR-014, 017, 018, 021)
  src/cli/run-fleet.ts       plan preview, confirm, start, --continue-fleet
  src/cli/run-fleet-loop.ts  FleetSupervisor: ticks each feature Session, applies schedule/contain/budget
```

**Decisions**
- **D1 Fleet dir (FR-021).** `.amby/fleet/fleet-<n>/` holds `fleet.json` and the per-feature run dirs `<feature>.<n>/` as in 019. `runDir`, `readRun`, `listRuns` and `resolveRun` also search `fleet-*/` one level down, so 025's `report_activity` finds a feature's unfinished run inside its fleet with no change to callers. Flat single runs are untouched.
- **D2 "Merged" = lanes merged into the feature branch** (the run is `done`), not the feature into `main`, which stays a person's decision (clarification C-1 in `@spec.md`). A dependent or serialized feature starts after that; in its worktree it first merges the other feature's branch, and a conflict pauses that feature only (FR-004, 007, 013).
- **D3 Fleet caps via a hook, not a rewrite (US-9).** `Session` gets an optional `slots?: () => { total: number; byType: Map<string, number> }` returning the lanes running in the other sessions; `launchQueued` adds it to its own count. Absent, behavior is as today. The fleet default (3 total, 2 per type) overrides 028's per-feature cap only inside a fleet (FR-012).
- **D4 Ownership is conservative.** A feature's path set is the union of its tasks' `paths` (030 reader, 1.x and 2.x alike). A task with `pathIssue: missing` makes the feature "owns everything": serialized against every other feature and shown as `unknown ownership: T###` (FR-006). Overlap uses `overlaps()` from `lanes.ts` (glob-aware).
- **D5 Pause containment.** A feature pauses when 028 pauses or escalates one of its lanes (restart limit 2, stall, gate rejection or merge conflict); `contain.ts` marks its transitive dependents `held`; independent features keep ticking; resuming releases dependents (FR-009, 013).
- **D6 Resume re-plans.** `fleet.json` stores per-feature fingerprints (hash of spec and tasks as read by the 030 reader, plus the ownership set). `--continue-fleet=<id>` recomputes, prints what changed, and keeps finished lanes' state from each run's lane files (FR-017, 018).
- **D7 Directives.** Pause or stop writes one directive per lane through the existing core `writeDirective` across all sessions (FR-015); no new protocol.
- **D8 View data.** `fleetView(root)` in core returns features -> runs -> lanes with states; `ambykit fleet --json` and 029/032's views consume it. No rendering here (FR-014, US-8 last scenario).

## Phased approach

- **Phase 0 — Research (done):** `Session`, `launchQueued`, `Supervisor` and run-dir code were read; D1-D3 follow from them. Open item: R1.
- **Phase 1 — Foundation:** `fleet-plan/` types and pure modules against fixture models (select, ownership, order, schedule, contain, budget).
- **Phase 2 — Fleet state:** `fleets.ts`, nested run resolution, `fleetView` (US-8 data).
- **Phase 3 — US-1, US-2, US-3 (P1):** GATE 030 merged; real reader adapter; plan preview; `run <f1> <f2>`; serialization and dependency wait.
- **Phase 4 — US-4, US-5 (P1):** containment, fleet caps hook, budgets.
- **Phase 5 — US-6, US-8, US-7 (P2, P3):** per-feature gates and merge inside the fleet, directives, resume and re-plan, `--all-ready`.
- **Phase 6 — US-9 and integration:** single-run-unchanged tests, docs, changelog; person task for the 2.0 gate dogfood (SC-001).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001, 002, 003 / US-1 | `select.ts` + plan preview in `run-fleet.ts`; `--yes` required as in 028 |
| FR-004, 005, 006 / US-2 | `ownership.ts`, `order.ts` (serialization edges name the shared files), D2, D4 |
| FR-007, 008 / US-3 | `order.ts` DAG: feature `depends-on` + story edges; cycle and missing-dependency errors |
| FR-009 / US-4 | `contain.ts`, D5; 028's restart limit and stall detection unchanged |
| FR-010, 011, 012 / US-5 | `schedule.ts` over `nextToStart`, D3 hook, `budget.ts` (usage rule from 028's `reportsUsage`) |
| FR-013, 014, 015 / US-6 | one Session per feature (own gates and merge), D7, D8 |
| FR-016 / US-7 | `select.ts` readiness = spec/plan/tasks ready + lanes prepared or preparable (C-2) |
| FR-017, 018, 021 / US-8 | D1, D6, `fleets.ts` |
| FR-019 / US-9 | one feature delegates to the unchanged single-run path; D3 is a no-op when absent |
| FR-020, 022 | only the 030 reader and writer are used; a source-scan test forbids markdown parsing in `fleet-plan/` |

## Risks & decisions

- **R1 Lane preparation.** 028 runs prepared lanes (`ambykit lane`). Decision (C-2): the plan step prepares missing next-phase lanes with the lane core (default 2) and shows it in the preview; if unsafe at build time, refuse with the `ambykit lane` hint (a `clarify` candidate).
- **R2 Dependent-branch merge** (D2) can conflict in files ownership did not predict; it pauses that feature, never auto-resolves.
- **R3 030 not merged.** Phase 3+ is gated; the assumed contract is `readSpec`/`readTasks` (`dependsOn`, `paths`, `pathIssue`). If it changes before merge only `fleet-plan/read.ts` changes.
- **R4 Runners unverified (028 T044/T045).** The 2.0 gate dogfood needs a live runner; otherwise SC-001 stays `? unverified` and the release says so.
- **R5 Windows.** New path/process code builds Windows paths with `path.win32` in tests; processes go only through 028's `ProcessPort`.
- **Gaps noted (resolved as C-1, C-2 in the spec):** who prepares lanes; what "merged" means.
