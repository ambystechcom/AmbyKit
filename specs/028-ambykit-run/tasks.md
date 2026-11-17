---
feature: 028-ambykit-run
created: 2026-11-16
---

# Tasks — ambykit run (headless lane orchestration)

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Each task = one module plus its test file. Test names cite `028:FR-###` / `028:SC-###` (Principle 5).
> `**Verify:**` lines are plain text per spec 020's convention. Tasks marked MANUAL need a live install.
> **Depends on** spec 019 (verdict contract), spec 025 (all fleet state under `src/core/fleet/*`, built first in the
> 1.5 integration batch) and spec 023 (`buildGraph`). 028 imports that code and keeps no copy of it. Golden
> re-records, `ambykit sync` and the manual gate run (T125) are integration steps, not lane steps.

## Phase 1 — Setup

- [x] [T001] [P] Fake headless runner: scripted exit codes, delays, hangs, task check-offs and activity markers (test/fixtures/fake-runner.mjs)
- [x] [T002] [P] Extend spec 025's single `fleet` config object (025 T010 owns the base: stallMinutes 15, restartLimit 2, concurrency 3/2, roundLimit 3, tickSeconds, budgets, workerModel) with 028's own keys only (stopGraceMinutes 10, runner selection); no top-level `run` object (src/core/config.ts, src/core/types.ts, test/core/config.test.ts)
- [x] [T003] [P] Plain import of spec 025's fleet-state modules (`src/core/fleet/*`: `updateRun`, `writeDirective`, `laneStatus`, claim and note helpers); contract test fails if an export 028 uses is missing (test/core/run-fleet-contract.test.ts)
- **Verify:** `npm run typecheck && npx vitest run test/core/config.test.ts test/core/run-fleet-contract.test.ts`; an existing `.amby/config.json` without `fleet` still loads. ✓ passed

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] Run bootstrap over spec 025's run store: create `<feature>.<n>` only on explicit request, read and update run.json through `updateRun`, rebuild from `tasks.md` through 025; add only 028's own supervision files (`lanes/`, `events.jsonl`, `prompts/`) through 025's helpers; no local run-id or state-file code (src/cli/run-files.ts, test/cli/run-files.test.ts)
- [x] [T011] [P] Runner registry: `RunnerSpec` with claude and codex entries, `verified: false`, invocation fields marked "to verify on a live install" (src/core/runners.ts, test/core/runners.test.ts)
- [x] [T012] [P] `buildLanePrompt`: task IDs, `@path` artifact references and file ownership only (src/core/run-prompt.ts, test/core/run-prompt.test.ts)
- [x] [T013] [P] Extract the check-off-aware lane merge from `LaneCommand` into core with a structured per-lane result; `lane merge` behaviour unchanged (src/core/lane-merge.ts, src/cli/lane.ts, test/core/lane-merge-core.test.ts)
- [x] [T014] [P] Pure scheduler `nextToStart`: total cap and per-type cap from `fleet.concurrency`, stable order; may use spec 023's `buildGraph` for cross-story `depends-on` (src/core/run-schedule.ts, test/core/run-schedule.test.ts)
- [x] [T015] [P] Pure supervision rules: restart limit, reassignment gate, budget decision; stall comes from spec 025's `laneStatus` (waiting/blocked exempt), with no stall logic of its own (src/core/run-supervise.ts, test/core/run-supervise.test.ts)
- [x] [T016] [P] Process edge: spawn, signal, wait and liveness behind an injectable interface; Windows executable resolution (src/cli/run-process.ts, test/cli/run-process.test.ts)
- [x] [T017] [P] `RunCommand` skeleton: flags, experimental label, project/feature/lane checks; register in the verb list (src/cli/run.ts, src/cli/index.ts, test/cli/run-skeleton.test.ts)
- **Verify:** `npm run typecheck && npx vitest run test/core test/cli/run-process.test.ts test/cli/run-skeleton.test.ts test/cli/lane.test.ts test/cli/lane-merge.test.ts` — existing lane tests still pass after T013. ✓ passed
- **Checkpoint:** foundation compiles, pure rules are unit-tested, `ambykit run --help` shows the experimental label.

## Phase 3 — User story US-1  (priority: P1)

- [x] [T030] [P] [US1] Pure launch plan: lanes + assigned runner + prompt file → exact command per lane (src/core/run-launch-plan.ts, test/core/run-launch-plan.test.ts)
- [x] [T031] [P] [US1] `--emit-script` writer: `launch.sh` and `launch.ps1` under `.amby/fleet/<run>/`, launches nothing (src/cli/run-script.ts, test/cli/run-script.test.ts)
- [x] [T032] [US1] Wire preview (no `--yes`: print and exit), `--yes` (print then launch hook), `--emit-script`, no-lanes and unknown-feature messages (src/cli/run.ts, test/cli/run-preview.test.ts)
- **Verify:** `npm run typecheck && npx vitest run test/core/run-launch-plan.test.ts test/cli/run-script.test.ts test/cli/run-preview.test.ts` — without `--yes` nothing is spawned (fake runner records zero starts). ✓ passed
- **Checkpoint:** US-1 is demoable (SC-002).

## Phase 4 — User story US-3  (priority: P1)

- [x] [T040] [US3] `runnable()`, runner listing with capabilities, refusal reasons (Principle 4) (src/core/runners.ts, test/core/runners.test.ts)
- [x] [T041] [US3] Headless-runner section in the compatibility matrix: claude and codex rows, all `unverified` (docs/tool-compatibility.md)
- [x] [T042] [US3] Doc-sync test: registry and matrix rows agree; an unverified row is never runnable (test/runners-doc-sync.test.ts)
- [x] [T043] [US3] Wire `--runners` listing and refusal; report a version mismatch and stop the lane when a verified runner fails immediately (src/cli/run.ts, test/cli/run-runners.test.ts)
- [ ] [T044] [US3] MANUAL: verify Claude Code headless invocation, prompt delivery, exit behaviour and usage reporting on a live install; record version; mark verified (src/core/runners.ts, docs/tool-compatibility.md)
- [ ] [T045] [US3] MANUAL: same for Codex (src/core/runners.ts, docs/tool-compatibility.md)
- **Verify:** `npm run typecheck && npx vitest run test/core/runners.test.ts test/runners-doc-sync.test.ts test/cli/run-runners.test.ts && node scripts/check-docs-sync.mjs`; T044/T045 pass only when each runner's recorded command ran a real lane task on this machine. ? unverified: the tests pass, but T044 and T045 need a live install and the docs-sync check needs the polish tasks (T120-T123).
- **Checkpoint:** US-3 is demoable; the 1.6 runnable list is exactly Claude Code and Codex, and only after T044/T045 (SC-006).

## Phase 5 — User story US-2  (priority: P1)

- [x] [T050] [P] [US2] Launch queue: one process per lane in its lane worktree under the caps, record exit status, assistant chosen from configured tools (src/cli/run-launch.ts, test/cli/run-launch.test.ts)
- [x] [T051] [P] [US2] Run lock and active-run guard: a second run on the same feature refuses (src/cli/run-files.ts, test/cli/run-files.test.ts)
- [x] [T052] [US2] Wire run creation, state init, the tick loop and resolved caps shown at start (src/cli/run.ts, test/cli/run-launch-flow.test.ts)
- **Verify:** `npm run typecheck && npx vitest run test/cli/run-launch.test.ts test/cli/run-files.test.ts test/cli/run-launch-flow.test.ts` — two lanes on two fake assistants run in separate worktrees, extra lanes wait for a slot. ✓ passed
- **Checkpoint:** US-2 is demoable.

## Phase 6 — User story US-4  (priority: P1)

- [x] [T060] [US4] Supervisor: read markers, `tasks.md` mtime and liveness through spec 025's `laneStatus`; stop and restart with work preserved; pause at the restart limit; reassign only on approval (src/cli/run-supervisor.ts, test/cli/run-supervisor.test.ts)
- [x] [T061] [US4] Wire the supervisor into the tick loop; keep the stall limit separate from the dashboard idle limit (src/cli/run.ts, test/cli/run-stall.test.ts)
- **Verify:** `npm run typecheck && npx vitest run test/cli/run-supervisor.test.ts test/cli/run-stall.test.ts` — a hanging fake lane is restarted within stall limit plus one tick (SC-003), paused after two restarts. ✓ passed
- **Checkpoint:** US-4 is demoable.

## Phase 7 — User story US-5  (priority: P1)

- [ ] [T070] [US5] Merger: merge a finished lane with core lane-merge, one at a time in name order; conflict aborts the merge, leaves the lane intact and pauses; blocked or unchecked lanes are not merged (src/cli/run-merger.ts, test/cli/run-merger.test.ts)
- [ ] [T071] [US5] Wire merges into the loop, resume after a person resolves a conflict, report unfinished lanes (src/cli/run.ts, test/cli/run-merge.test.ts)
- **Verify:** `npm run typecheck && npx vitest run test/cli/run-merger.test.ts test/cli/run-merge.test.ts test/cli/lane-merge.test.ts` — one clean and one conflicting lane: the first merges, the second pauses.
- **Checkpoint:** US-5 is demoable.

## Phase 8 — User story US-6  (priority: P1)

- [ ] [T080] [US6] Budget guard: wall-clock and task-count always, token ceiling only where the runner reports usage; stop launching, write stop directives, terminate after the stop grace (src/cli/run-budget.ts, test/cli/run-budget.test.ts)
- [ ] [T081] [US6] Wire budgets: defaults shown at start, "ceiling not enforceable for this runner" notice, reason recorded in the run state (src/cli/run.ts, test/cli/run-budget-flow.test.ts)
- **Verify:** `npm run typecheck && npx vitest run test/cli/run-budget.test.ts test/cli/run-budget-flow.test.ts` — a tiny wall-clock budget stops the run and records why (SC-004).
- **Checkpoint:** US-6 is demoable; all P1 stories done.

## Phase 9 — User story US-7  (priority: P2)

- [ ] [T090] [US7] Gates (028 is the single gate owner): detect a completed story checkpoint, wait on `gates[]` in run.json (TTY prompt or recorded decision); `approveGate`/`rejectGate` update it through spec 025's `updateRun` with the reason, and are the one function the dashboard (spec 029 T092) also calls (src/core/run-gate-actions.ts, src/cli/run-gates.ts, test/core/run-gate-actions.test.ts, test/cli/run-gates.test.ts)
- [ ] [T091] [US7] `approve` and `reject` subcommands calling the same `approveGate`/`rejectGate`, `--unattended` shown at start, gate wiring (src/cli/run.ts, test/cli/run-approve.test.ts)
- **Verify:** `npm run typecheck && npx vitest run test/cli/run-gates.test.ts test/cli/run-approve.test.ts` — the run does not start the next prepared lane set until approval is recorded.
- **Checkpoint:** US-7 is demoable.

## Phase 10 — User story US-8  (priority: P2)

- [ ] [T100] [US8] Control: read directives each tick through spec 025's directive reader and write pause/resume/stop only through its `writeDirective` / `ambykit directive` (short lane form in file names), apply at the lane's next report (finish the current task first), record obeyed (src/cli/run-control.ts, test/cli/run-control.test.ts)
- [ ] [T101] [US8] `--continue-run <run>` (not `--resume`, which clashes with the `resume` directive), SIGINT/SIGTERM save-and-exit, and a test that a second host (the `/amby.run` prompt of spec 019 or the dashboard) reads the same pause/resume/stop state (src/cli/run.ts, test/cli/run-resume.test.ts)
- **Verify:** `npm run typecheck && npx vitest run test/cli/run-control.test.ts test/cli/run-resume.test.ts` — pause then resume from a new process repeats no completed task (SC-005).
- **Checkpoint:** US-8 is demoable; all directive writes go through spec 025's writer.

## Phase 11 — User story US-9  (priority: P2)

- [ ] [T110] [P] [US9] Review-loop state machine: rounds from `fleet.roundLimit`, spec 019's verdict contract (`verdicts/<lane>.<role>.<round>.json`, `{verdict: pass|fail, findings: [{id, severity, finding, fix}]}`), escalation at the limit (src/core/run-review.ts, test/core/run-review.test.ts)
- [ ] [T111] [P] [US9] Role-job prompts for QA and architect: role file by `@` reference plus the phase's `Verify:` line (src/core/run-prompt.ts, test/core/run-prompt.test.ts)
- [ ] [T112] [US9] Protocol runner: launch QA and architect jobs as processes, return finding IDs to the same lane's worker, release claims at check-off through spec 025's claim helpers (src/cli/run-protocol.ts, test/cli/run-protocol.test.ts)
- [ ] [T113] [US9] Wire the protocol before merge so a failing Verify never merges (src/cli/run.ts, test/cli/run-team.test.ts)
- **Verify:** `npm run typecheck && npx vitest run test/core/run-review.test.ts test/core/run-prompt.test.ts test/cli/run-protocol.test.ts test/cli/run-team.test.ts` — a failing Verify line is never merged and the loop ends within the round limit (SC-009).
- **Checkpoint:** US-9 is demoable.

## Phase 12 — Polish

- [ ] [T120] [P] `ambykit run` reference with flags, subcommands and the experimental note (docs/cli-reference.md)
- [ ] [T121] [P] Site CLI reference lists the `run` verb (site/src/content/docs/cli/index.mdx)
- [ ] [T122] [P] Add `run` to the CLI structure map; this line is also edited by spec 024 T093, and whichever lands second rewrites it (AGENTS.md)
- [ ] [T123] [P] Changelog entry under Unreleased (CHANGELOG.md)
- [ ] [T124] [P] FR-coverage test: every `028:FR-###` appears in a test name (test/run-fr-coverage.test.ts)
- [ ] [T125] MANUAL, integration step (not a lane step): 1.6 gate — run this feature's lanes on Claude Code and Codex on AmbyKit itself and record the result (specs/028-ambykit-run/gate-report.md)
- **Verify:** `npm run typecheck && npm test && node scripts/check-docs-sync.mjs`; T125 passes when both lanes merged with every lane task checked off (SC-001, SC-008).
