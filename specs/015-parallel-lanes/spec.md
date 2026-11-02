---
feature: 015-parallel-lanes
title: Parallel lanes — file ownership and conflict-free concurrent execution
branch: 015-parallel-lanes
status: ready
created: 2026-09-18
---

# Spec — Parallel lanes — file ownership and conflict-free concurrent execution

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

## Problem

Feature 012 gave each feature its own worktree, so two features can be built side by side. Inside a
single feature there is no such guarantee: `tasks.md` already marks independent tasks `[P]` and names
a file path per task, but nothing checks whether two `[P]` tasks claim the same file, and nothing
turns the `[P]` set into separate working copies. A user who hands three `[P]` tasks to three
assistants in one checkout gets interleaved edits and lost work; the marker promises parallelism the
tool does not make safe.

The information needed is already written down — the `[P]` marker and the trailing `(file/path)` are
part of the documented task line format — and is currently discarded when tasks are parsed. Competing
frameworks require a hand-maintained manifest declaring per-package file ownership; AmbyKit can derive
the same guarantee from the artifact a human already reads and reviews, which keeps one source of
truth (Principle 1) and adds no tokens (Principle 3).

## User scenarios & testing

### US-1 — Tasks declare the files they own  (priority: P1)

As a tech lead, I want every task to carry the file paths it will write, machine-readably, so that
ownership is explicit and checkable rather than implied by prose.

- **Why this priority:** Everything else in this feature reads this data; without it there is nothing
  to check or group.
- **Independent test:** Parse a fixture `tasks.md` containing single-path, multi-path, and path-less
  task lines; the parse yields the declared paths per task and flags the path-less line.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a task line in the documented format, When tasks are parsed, Then the task's `[P]` marker and
  every declared file path are available, not discarded.
- Given a task that writes several files, When tasks are parsed, Then all of its paths are captured.
- Given a task line with no path, When tasks are parsed, Then it is reported as incomplete, naming the
  task id.
- Given a `tasks.md` authored before this feature, When it is parsed, Then parsing succeeds and
  path-less tasks are reported rather than treated as errors.
- Given the tasks phase runs, When it writes a task line, Then a concrete file path is mandatory for
  every task.

### US-2 — Parallel-marked tasks that collide are caught  (priority: P1)

As a developer about to fan work out, I want to be told when two tasks marked parallel claim the same
file, so that I learn it from a local check instead of from a merge conflict.

- **Why this priority:** This is the safety guarantee; the marker is currently unverified.
- **Independent test:** Run the check on a fixture where two `[P]` tasks in one phase both write
  `src/core/config.ts`; the check names both task ids and the shared path, and exits non-zero.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given two `[P]` tasks in the same phase declaring the same path, When the check runs, Then it
  reports a conflict naming both task ids and the path, and exits non-zero.
- Given two `[P]` tasks whose paths are disjoint, When the check runs, Then no conflict is reported.
- Given a `[P]` task colliding with a task that is not marked `[P]`, When the check runs, Then it is
  reported, because the sequential task may run concurrently with the parallel set.
- Given two colliding tasks in different phases, When the check runs, Then no conflict is reported —
  the phase gate already orders them.
- Given a conflict exists, When the check runs in CI, Then the non-zero exit fails the build, as
  cycles and dangling references do today.
- Given a directory path is declared rather than a file, When the check runs, Then overlap between a
  directory and a file beneath it is treated as a conflict.

### US-3 — Lanes materialize as isolated working copies  (priority: P2)

As a developer running several assistants, I want the conflict-free parallel groups turned into
separate working copies, so that each assistant edits its own checkout and the merge is mechanical.

- **Why this priority:** The payoff of US-1 and US-2, but useless until collisions are detectable.
- **Independent test:** On a fixture feature with two disjoint `[P]` groups, materialize lanes; two
  working copies appear, each listing only its own tasks, and neither contains the other's paths.
- **depends-on:** [US-1, US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a feature whose `[P]` tasks form disjoint path sets, When lanes are materialized, Then one
  isolated working copy exists per lane, named so the lane and feature are identifiable.
- Given a feature with a conflict, When lanes are materialized, Then it refuses and reports the
  conflict rather than creating overlapping lanes.
- Given lanes exist, When they are listed, Then each shows its feature, its tasks, its declared paths,
  and whether its working copy is clean, dirty, or merged.
- Given a lane is finished with, When it is removed, Then its working copy is deleted and its branch
  is kept, consistent with existing worktree removal.
- Given lanes are materialized twice, When the second run happens, Then it is a no-op.
- Given the project has not opted into worktrees, When lanes are requested, Then the request is
  refused with an explanation rather than silently changing the project layout (Principle 7).
- Given a phase whose open `[P]` tasks number more than the requested lane count, When lanes are
  materialized, Then the tasks are spread across that many lanes in task order, and the phase's open
  tasks without `[P]` stay in the feature's own checkout.
- Given an assistant runs the implement phase inside a lane, When it picks tasks, Then it works only
  the tasks of that lane, and "the current feature" resolves to the lane's feature.
- Given finished lanes whose only overlapping edits are check-offs in `tasks.md`, When they are merged
  back into the feature, Then the merge completes without a conflict and every check-off survives.
- Given a lane whose merge would conflict on anything other than check-offs, When it is merged back,
  Then that lane's merge is abandoned, the feature checkout is left as it was, and the conflict is
  reported.

### US-4 — Lane progress is visible  (priority: P3)

As a lead watching several assistants work, I want lane state in the progress view, so that I can see
which lanes are done without visiting each working copy.

- **Why this priority:** Convenience once lanes exist; the data is already computed.
- **Independent test:** With two lanes, one complete and one partial, the progress view shows per-lane
  task counts matching the checkboxes in `tasks.md`.
- **depends-on:** [US-3]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given lanes exist, When the progress view runs, Then each lane appears with its task counts and
  percentage, computed locally at zero model tokens.
- Given no lanes exist, When the progress view runs, Then output is unchanged from today.
- Given the machine-readable form, When it runs, Then lane membership is included.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL parse from each task line its `[P]` parallel marker and every declared file
  path, preserving both for downstream checks.
- FR-002  THE SYSTEM SHALL report any task that declares no file path, naming the task id, without
  failing the parse of a pre-existing `tasks.md`.
- FR-003  THE SYSTEM SHALL require the tasks phase to give every task at least one concrete file path.
- FR-004  WHEN two tasks in the same phase declare overlapping paths and at least one is marked `[P]`,
  THE SYSTEM SHALL report a lane conflict naming both task ids and the overlapping path.
- FR-005  THE SYSTEM SHALL treat a declared directory and any file beneath it as overlapping.
- FR-006  WHERE two overlapping tasks are in different phases, THE SYSTEM SHALL NOT report a conflict,
  because the phase gate orders them.
- FR-007  IF a lane conflict exists, THEN THE SYSTEM SHALL exit non-zero from the local check so it can
  gate CI, consistent with existing structural errors.
- FR-008  THE SYSTEM SHALL group `[P]` tasks with mutually disjoint path sets into lanes, deriving lane
  membership from `tasks.md` alone with no separate manifest (Principle 1).
- FR-009  WHEN lanes are materialized, THE SYSTEM SHALL create one isolated working copy per lane,
  reusing the existing worktree mechanism, and SHALL refuse when a conflict exists.
- FR-010  THE SYSTEM SHALL list lanes with feature, tasks, declared paths, and clean/dirty/merged
  state, and SHALL remove a lane's working copy while keeping its branch.
- FR-011  WHERE the project has not opted into worktrees, THE SYSTEM SHALL refuse lane materialization
  with an explanation rather than changing the project layout (Principle 7).
- FR-012  THE SYSTEM SHALL include lane task counts in the progress view when lanes exist, and SHALL
  leave that output unchanged when they do not.
- FR-013  THE SYSTEM SHALL compute all lane analysis locally, at zero model tokens (Principle 3).
- FR-014  THE SYSTEM SHALL document the task-line path convention and the lane commands in the
  workflow guide and CLI reference, passing the docs-sync checker.
- FR-015  THE SYSTEM SHALL analyze only open (unchecked) tasks for conflicts and missing paths, so a
  completed task can neither cause nor suffer a conflict.
- FR-016  IF a declared path contains a glob or wildcard, THEN THE SYSTEM SHALL report it as an invalid
  declaration, naming the task id, and SHALL treat the task as declaring no path.
- FR-017  WHEN lanes are materialized for a phase, THE SYSTEM SHALL distribute that phase's open `[P]`
  tasks across the requested number of lanes (default 2, never more than one lane per task) in task
  order, and SHALL leave the phase's open tasks without `[P]` to the feature's own checkout.
- FR-018  WHILE an assistant works inside a lane, THE SYSTEM SHALL resolve the current feature to the
  lane's feature and SHALL direct the implement phase to work only that lane's tasks.
- FR-019  WHEN finished lanes are merged back into the feature, THE SYSTEM SHALL resolve differences
  that are only `tasks.md` check-offs automatically, keeping every check-off; IF any other conflict
  occurs, THEN THE SYSTEM SHALL abandon that lane's merge, leave the feature checkout unchanged, and
  report the conflict.
- FR-020  WHEN the tasks in a lane no longer match the current `tasks.md` (ids or paths changed), THE
  SYSTEM SHALL report the drift when lanes are listed, and SHALL NOT re-lane automatically.

## Success criteria

- SC-001  A fixture with a seeded two-task collision is reported by id and path, with a non-zero exit;
  a disjoint fixture exits 0.
- SC-002  Directory-versus-file overlap, cross-phase non-overlap, and `[P]`-versus-sequential overlap
  are each covered by a test.
- SC-003  A fixture feature with two disjoint parallel groups produces exactly two working copies, and
  a conflicting fixture produces none.
- SC-004  A `tasks.md` written before this feature parses without error, with path-less tasks reported.
- SC-005  Lane analysis on a 200-task fixture completes in under 200 ms and consumes zero model tokens.
- SC-006  Every FR maps to an automated test; `npm run typecheck` and `npm test` pass.
- SC-007  Dogfood: this feature's own `tasks.md` passes the lane check, and at least two of its tasks
  are executed in separate lanes.
- SC-008  Two lanes whose check-offs sit on adjacent lines of `tasks.md` merge back with no conflict
  and both check-offs present; a lane with a seeded code conflict leaves the feature checkout clean.
- SC-009  Every existing `tasks.md` in this repository passes the lane check (no conflicts among open
  tasks), so enabling the check does not break CI.

## Edge cases

- A task declaring a glob or wildcard path — globs are not permitted (resolved 2026-10-26). The
  declaration is reported as invalid, like a missing path; a directory path is the way to claim
  "everything under here" (FR-005).
- Paths written differently for the same file (`./src/x.ts` versus `src/x.ts`, or differing case on a
  case-insensitive filesystem) — normalize before comparing, or collisions will be missed.
- A task declaring a path that does not exist yet (a file it will create) — legal; overlap is about
  declarations, not existing files.
- Every task in a phase marked `[P]` with one shared path — report one conflict per pair, not a flood.
- A lane whose tasks are all already checked off — report it as complete rather than creating a copy.
- Tasks edited while lanes exist, changing membership — report the drift; do not silently re-lane.
- A task legitimately shared by two lanes (a common setup file) — the correct fix is to sequence it,
  and the message should say so rather than only naming the conflict.

## Assumptions

- The documented task line format is stable enough to carry ownership; extending it is cheaper than
  introducing a manifest, and keeps the artifact human-reviewable.
- Declared paths are accurate because the tasks phase writes them from the plan; a task that writes an
  undeclared file is a spec violation to be caught by convergence, not by this check.
- Git worktrees remain the isolation mechanism; no container or sandbox isolation is in scope.
- Lane execution is user-orchestrated: AmbyKit prepares isolated copies and reports state, but does
  not launch or supervise assistant processes.
