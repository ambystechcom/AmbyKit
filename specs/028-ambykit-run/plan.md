---
feature: 028-ambykit-run
status: draft
created: 2026-11-16
---

# Implementation Plan — ambykit run (headless lane orchestration)

> The HOW. First artifact where technology appears. Must satisfy every `FR-###` in `@spec.md` and
> honor the `@../../.amby/constitution.md`. Reference spec by ID — do not restate it. No UI: skip design.

## Technical context

- **Stack:** TypeScript, Node ≥ 20, ESM (`.js` import extensions), Vitest — as today. No new runtime
  dependency: process control uses `node:child_process`, config validation reuses `zod`
  (`src/core/config.ts`). (Principle 2, dependency cap from feature 006.)
- **Existing pieces reused, not rewritten:**
  - lane creation and planning — `src/core/lanes.ts` (`laneName`, `parseLaneName`, `readManifest`,
    `matchLane`, `mergeCheckoffs`) and `src/cli/lane.ts`; worktrees via `src/core/worktree.ts`,
    `src/core/git.ts`, `src/core/checkouts.ts` (`primaryRoot`).
  - the check-off-aware merge (015 FR-019) — currently a private method of `LaneCommand`; extracted to
    core in Phase 2 so `lane merge` and `run` share one implementation.
  - activity markers — `src/core/activity.ts` (`readMarkers`, `tasksMtime`); the `<feature>.<agent>~<lane>`
    marker name, `--lane`, `--state` and directives arrive with spec 025.
  - **fleet state — imported, not built here.** Spec 025 owns all fleet state code under `src/core/fleet/*`
    (runs, directives, claims, notes, lane-status, types) and everything under `.amby/fleet/<run>/` in the
    primary checkout, including the `run.json` schema (025 `data-model.md`) and the single `fleet` config
    object. 028 imports `updateRun`, `writeDirective`, `laneStatus` and the claim/note helpers; it defines no
    run-id, state-file, stall or directive logic of its own (resolves Q-01/Q-05).
- **Depends on:** spec 019 (prompt-level protocol and the verdict contract), spec 025 (fleet state, built
  first in the 1.5 integration batch), and spec 023 (`buildGraph`, optionally used by the lane scheduler to
  respect cross-story `depends-on`).
  - verb plumbing — `BaseCommand` (`assumeYes` already parses `--yes`/`-y`), `COMMANDS` registry in
    `src/cli/index.ts` (Principle 2).
- **Constraints driving choices:**
  - Headless flags are unverified. `docs/tool-compatibility.md` has no runner section today, so every
    runner invocation is data marked `verified: false` until confirmed on a live install; only
    `verified: true` rows are runnable (FR-006/007, Principle 4).
  - Launching processes that edit code is the riskiest action: print first, `--yes` to launch,
    `--emit-script` writes and launches nothing (FR-001–003, Principle 7). Files stay project-scoped under
    `.amby/fleet/<run>/`, self-ignoring like `.amby/activity/` (FR-020).
  - Pure decisions in `src/core`, side effects (spawn, git, fs, prompts) at the `src/cli` edge (AGENTS.md
    conventions); the supervisor's clock, process layer and git are injected so tests use a fake runner and
    a fake clock (Principle 5).
  - Token frugality: a lane's prompt is task IDs + `@path` references + file ownership only (FR-004,
    Principle 3). Supervision reads files; it never calls a model.

## Architecture

```
ambykit run <feature>            src/cli/run.ts   (flags, preview/--yes/--emit-script, subcommands, loop)
   │ composes, one concern per module (each independently testable)
   ├─ run-launch.ts      launch queue: spawn per lane under caps, record exits          (US-2)
   ├─ run-supervisor.ts  stall detect → stop → restart → pause at limit → reassign gate  (US-4)
   ├─ run-merger.ts      finished lane → core lane-merge, serial, conflict pauses        (US-5)
   ├─ run-budget.ts      wall-clock / task-count / token ceiling → stop                 (US-6)
   ├─ run-gates.ts       story checkpoint approval (TTY prompt, approve|reject verbs) via 025's updateRun on `gates[]` — the one gate owner   (US-7)
   ├─ run-control.ts     directives (pause/resume/stop) in, obeyed-at-next-report out   (US-8)
   ├─ run-protocol.ts    QA + architect jobs as processes, bounded review loop, claims  (US-9)
   └─ run-process.ts     spawn/kill/wait behind an interface (the only child_process use)
core (pure, no process/git except lane-merge):
   runners.ts       registry: RunnerSpec { id, executable, invocation(job) → {exe,args,stdin?}, exit
                    semantics, reportsUsage, verified, verifiedVersion }   ← matrix rows mirror this
   run-prompt.ts    buildLanePrompt(manifest, paths) → text (IDs, @refs, ownership)
   run-schedule.ts  nextToStart(queue, running, caps) — total cap + per-type cap, stable order
   run-supervise.ts restartDecision, reassignGate, budgetDecision — all (snapshot, now, config) → decision;
                    stalled-ness comes from 025's `laneStatus`, not reimplemented here
   run-review.ts    review-loop state machine: rounds, verdict contract, escalate at the limit
   lane-merge.ts    extracted check-off-aware merge (git side effects, as `core/git.ts` already does)
imported from spec 025 (`src/core/fleet/*`, no copies here): run ids `<feature>.<n>`, `run.json` read/update
   (`updateRun`), directives (`writeDirective`), claims/notes, `laneStatus` (the one stall implementation),
   rebuild-from-tasks.md when state is missing
```

**Run loop.** `run.ts` creates (or `--continue-run`s) a run, then ticks every `fleet.tickSeconds` (default 5):
read activity markers, `tasks.md` check-offs and process liveness → apply the pure rules → act (stop, restart,
merge, gate). One supervisor process per run, guarded by `run.lock` (pid); a second `ambykit run` on the same
feature refuses. Foreground only: SIGINT/SIGTERM ask lanes to stop, save state and exit; `--continue-run <run>`
continues (edge "terminal closed / reboot"; the flag is not called `--resume` because `resume` is a directive
name, Q-19). A run starts only on explicit request and is named `<feature>.<n>`. No daemon. `/amby.run`
(spec 019, prompt-level) and `ambykit run` (this spec, headless) are two hosts of the same protocol and share
`.amby/fleet/<run>/`, so either can inspect, pause or continue the other's run.

**Scope of one invocation.** Runs the *prepared* lane sets (`ambykit lane <feature>`), ascending by phase.
After a set merges and passes QA/review, a story checkpoint (if the stories of that phase are complete) waits
for approval before the next prepared set starts. Non-`[P]` ("stays") tasks of a phase are not run headless in
1.6: the run reports them and pauses (see Open decisions).

**State layout** `<primary checkout>/.amby/fleet/<run>/` is owned by spec 025 (self-ignoring, found through
`primaryRoot`). `run.json` follows the single schema in 025 `data-model.md` (status active|paused|waiting-person|
done, stage working|qa|architect, round, limit, needsDecision, `gates[{id, after, state pending|approved}]`,
`lanes[{lane, assistant, tasks[]}]`, `approvals[]`, `escalations[]`); 028 reads and updates it only through
025's `updateRun`. Directives (`directives/<lane>.json`, short lane form `lane-<p>-<k>` in file names),
claims and notes are written only by 025's modules. 028 adds only run-supervision files inside that
directory, written through 025's run-store helpers: `lanes/<lane>.json` (pid, restarts, exit), `events.jsonl`
(append-only audit), `prompts/<lane>.md`, `launch.sh`/`launch.ps1` (from `--emit-script`), and the verdict
files below.

**Config** — the single `fleet` object in `.amby/config.json`, owned by 025 (T010): `{stallMinutes: 15,
restartLimit: 2, concurrency: {total: 3, perType: 2}, roundLimit: 3, tickSeconds, budgets: {wallClockMinutes,
maxTasks, maxTokens?}, workerModel}`. 028 only **extends** that schema (`stopGraceMinutes`, runner
selection); it adds no top-level `run` object. Flags override; absent → defaults; existing configs are valid
unchanged.

**Team protocol (US-9).** The supervisor is the lead. After a lane's tasks are all checked it launches a QA
job and an architect job with the same runner, prompt = role file by `@` reference + the phase's `Verify:`
line; each writes the verdict file defined by spec 019: `verdicts/<lane>.<role>.<round>.json`
`{verdict: pass|fail, findings: [{id, severity, finding, fix}]}`. A failure re-launches the lane's worker with
only the finding IDs; after `fleet.roundLimit` rounds it escalates (pauses, asks a person). Claims are
advisory: released at check-off by 025's claim helpers.

## Phased approach

- **Phase 0 — Research (done in this plan; two live items remain as tasks):** repo code surveyed (above).
  Runner invocations for `claude` and `codex` are **not documented** in `docs/tool-compatibility.md`; they
  are confirmed on a live install in Phase 4 (T044/T045) before anything is marked verified.
- **Phase 1 — Setup:** fake runner fixture, config section, ports.
- **Phase 2 — Foundation:** run state, runner registry, prompt builder, lane-merge extraction, scheduler and
  supervision rules, process edge, command skeleton.
- **Phase 3+ — Stories in priority/dependency order:** US-1 preview → US-3 verified runners → US-2 launch →
  US-4 supervise → US-5 merge → US-6 budgets → (P2) US-7 gates → US-8 control → US-9 team protocol → Polish.
- **Tests are in each task** (module + its test file); a final coverage test asserts every `FR-###` of this
  spec appears in a test name using the qualified form `028:FR-###` (spec 024 convention, Principle 5).
- **Lane vs integration steps (Q-11).** Lanes write source and tests only. Golden-fixture re-records,
  `ambykit sync` regeneration, the docs-sync check and the manual gate run (T125) are integration steps done
  once per integration batch after merges, never inside a lane branch. `AGENTS.md` structure-line edits
  (T122) collide with spec 024's T093: whichever lands second rewrites the line.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001/002/003, US-1 | `run.ts` builds `launchPlan` (pure) → prints exact commands; no `--yes` → exit 0; `--yes` → print then launch; `--emit-script` → `run-script.ts` writes `launch.sh`/`.ps1`, launches nothing |
| FR-004, US-2 | `run-launch.ts` + `run-prompt.ts`: one process per lane in the lane worktree (`laneWorktrees`), prompt of IDs/@refs/ownership only; assistant from configured `tools` |
| FR-005 | `run-schedule.nextToStart`: total cap 3 and per-type cap 2 by default, configurable; fleet override is spec 031 (a `caps` parameter it will supply) |
| FR-006/007, US-3 | `runners.ts` `verified` flag + matrix section in `docs/tool-compatibility.md`; a doc-sync test keeps them identical; unverified refused with reason |
| FR-008/009/010, US-4 | `run-supervise` stall rule (no report + no `tasks.md` change for `stallMinutes`; waiting/blocked exempt) and restart policy (2 restarts → pause; reassign only on approval); `run-supervisor.ts` acts |
| FR-011/012, US-5 | `lane-merge.ts` (extracted) called serially in name order; conflict → merge aborted, lane intact, run pauses; unfinished/blocked lane not merged |
| FR-013/014, US-6 | `run-supervise.budgetDecision` (wall-clock, task count always; tokens only when `RunnerSpec.reportsUsage`), `run-budget.ts` stops launching and writes stop directives |
| FR-015, US-7 | `run-gates.ts` stops at a completed-story checkpoint and waits on `gates[]` state in run.json (updated through 025's `updateRun`; dashboard approval calls the same function); `--unattended` shown at start |
| FR-016, US-8 | `run-control.ts` reads directives and writes them only through 025's `writeDirective` / `ambykit directive` (pause, resume, stop from any host); worker finishes its task, obeys at next report; run records it |
| FR-017 | one state layout shared with `/amby.run` (spec 019) and owned by 025; 025's rebuild-from-`tasks.md` is used when state is missing |
| FR-018, US-9 | `run-protocol.ts` + `run-review.ts` (QA, architect, bounded loop, claims release) |
| FR-019 | "experimental" label in help, banner and docs; stable promotion is a 2.0 task, not this plan |
| FR-020 | all files under `.amby/fleet/<run>/`; no user-level writes; the scripts are project-local |
| SC-001, SC-008 | gate task T130 (manual): two lanes on Claude Code and Codex on AmbyKit itself |
| SC-002, SC-006 | preview/`--yes` tests; `runnable()` is the single chokepoint before any spawn |
| SC-003 | fake-clock test: stalled within `stallMinutes` + one tick |
| SC-004/005 | budget tests in every mode; resume-from-other-host test over shared state |
| SC-007 | FR-coverage test + `npm run typecheck`, `npm test` |
| SC-009 | protocol test: failing Verify never merges; loop bounded |

## Risks & decisions

- **Headless flags change often (roadmap risk).** Mitigation: invocation is data per runner, `verified` is
  gated by a doc-sync test, an immediate non-zero exit on a verified runner reports a version mismatch and
  stops that lane (US-3 AC3); upgrade drift is caught at the next live verification.
- **Windows:** `claude`/`codex` are `.cmd` shims there; `spawn` without a shell cannot run them directly.
  Default: resolve the executable via `PATH`/`PATHEXT` and spawn it directly; tests that need a real runner
  skip on Windows; confirm during T044/T045.
- **Stale lane bases:** lane sets for later phases created before earlier ones merge branch from an older
  feature tip. Git merges them fine in practice; the run warns when a later set predates a merged one.
- **Build order dependency:** 025's fleet-state foundation (run store, `updateRun`, `writeDirective`,
  `laneStatus`, `lane`/`paused` marker fields) is built first in the 1.5 integration batch, and 019's verdict
  contract is fixed in 019's plan. 028 (1.6) imports both directly, so no ports or adapters are needed. If a
  module is not yet built, the task that needs it waits for it.
- **A misbehaving assistant** (edits outside ownership, exits 0 without checking off): the run records
  exit status; a lane that exits without completing its tasks is `unfinished`, never merged (US-5 AC4).

## Open decisions (default chosen; revisit via `/amby.clarify` or `/amby.decide`)

1. **State module ownership with 019/025** — *resolved:* 025 owns all fleet state code and files; 019 keeps
   its CLI and prompt layer on top; 028 and 029 import (fleet state contract, Q-01).
2. **Default budgets** — wall-clock 120 min; task-count = 2 × open tasks in the prepared lanes (room for
   rework). Both shown at start (US-6 AC5).
3. **Stop grace** — after a stop/budget directive, terminate a lane's process if it has not reported for
   10 minutes (`run.stopGraceMinutes`).
4. **Prompt delivery per runner** (argument, stdin or file reference) — decided during T044/T045 on a live
   install; the interface supports all three.
5. **Stays tasks and multi-phase** — v1 runs prepared lane sets only; non-`[P]` tasks are reported, and the
   person runs them (`/amby.implement`) then continues with `--continue-run`. Auto-preparing the next
   phase's lanes is not in this plan.
6. **Approval UX** — TTY prompt in the foreground process, plus `ambykit run approve|reject <run>
   [--reason]` updating `gates[]` in run.json through 025's `updateRun` (needed when stdin is not a TTY).
   028 owns gates; the dashboard (spec 029) calls the same function or CLI, never a directive.
7. **Review verdict contract** — *resolved:* adopts 019's contract
   (`verdicts/<lane>.<role>.<round>.json`, `{verdict, findings:[{id, severity, finding, fix}]}`).
8. **Usage reporting** — every runner starts as `reportsUsage: false`; the token ceiling is therefore
   reported-but-unenforced until a runner is verified to report usage.
9. **Merge order** — name order (phase, then lane index), as `ambykit lane merge` does today.
