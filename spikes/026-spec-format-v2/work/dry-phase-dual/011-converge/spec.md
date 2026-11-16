---
feature: 011-converge
title: Converge — post-implement gap check against spec, plan, tasks
branch: 011-converge
status: done
created: 2026-08-25
---

# Spec — Converge — post-implement gap check against spec, plan, tasks

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

## Problem

The workflow ends at `/amby.implement`; nothing closes the loop. Once tasks are checked off, no
phase confirms the codebase actually satisfies every `FR-###` / `SC-###` in the spec and every
decision in the plan. Spec drift is silent. A **converge** phase reads the code against the feature's
artifacts, reports gaps per stable ID, and appends the missing work as new tasks — never touching
code — so implement → converge can be repeated until the feature is verifiably complete.

## User scenarios & testing

### US-1 — Run a gap check after implementation  (priority: P1)

As a developer using AmbyKit in an AI assistant, I want `/amby.converge` to compare the codebase
against my feature's `spec.md`, `plan.md`, and `tasks.md`, so that I know whether the
implementation is complete before I open a PR.

- **Why this priority:** This is the whole feature; nothing else is useful without it.
- **Independent test:** On a feature whose tasks are all checked but one `FR-###` is
  unimplemented, run converge; it reports that FR as a gap. On a fully implemented feature it
  reports "converged".
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature dir with `spec.md`, `plan.md`, `tasks.md`, When converge runs, Then it outputs a
  verdict of either **converged** or **gaps found (N)** and a per-ID coverage list.
- Given an `FR-###` with no corresponding implementation, When converge runs, Then that FR is
  listed as a gap with a one-line reason.
- Given a plan decision (e.g. a contract or data-model entry) not reflected in code, When converge
  runs, Then it is listed as a gap referencing the plan section.
- Given a `T###` checked as done but whose deliverable is absent, When converge runs, Then that task
  is listed as a gap.

### US-2 — Append gap tasks in place  (priority: P1)

As a developer, I want gaps to be appended to `tasks.md` as new `T###` entries under a
**Convergence** section, so that `/amby.implement` can pick them up without me re-running
`/amby.tasks`.

- **Why this priority:** Without this, converge is a report only and the loop does not close.
- **Independent test:** Run converge on a feature with two gaps; `tasks.md` gains exactly two new
  unchecked tasks with fresh sequential IDs, each referencing the FR/SC/plan item it closes; all
  pre-existing content is byte-identical.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given gaps are found, When converge finishes, Then `tasks.md` contains a `## Convergence` section
  (created if absent) with one new task per gap, IDs continuing from the highest existing `T###`.
- Given converge reports converged with no unverified items, When it finishes, Then `tasks.md` is
  unchanged byte-for-byte.
- Given a gap that was already appended by a previous converge run and is still unchecked, When
  converge runs again, Then it is **not** duplicated.
- Given any run, When converge finishes, Then no file outside the feature dir has been modified and
  no source code has been edited.

### US-3 — Update story and feature status  (priority: P2)

As a developer, I want converge to mark stories whose FRs/SCs are all covered as `done` and, when
every story is done, flip the feature `status` to `done`, so that the dashboard reflects reality.

- **Why this priority:** Valuable but separable; the gap check is useful even if status stays manual.
- **Independent test:** On a fully implemented feature still marked `in-progress`, run converge;
  `spec.md` frontmatter and every story become `done`. `ambykit dashboard` shows it as done.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given all FRs and SCs mapped to a story are covered, When converge runs, Then that story's
  `status` becomes `done`; otherwise it is left unchanged.
- Given every story is `done`, When converge runs, Then the spec frontmatter `status` becomes `done`.
- Given any status change, When converge finishes, Then only `status:` lines changed in `spec.md`.

### US-4 — Available on every supported tool  (priority: P2)

As a user of any AmbyKit target (Claude, Copilot, Cursor, OpenCode, Antigravity, Codex…), I want
`/amby.converge` emitted alongside the other phases, so that the workflow is complete everywhere.

- **Why this priority:** Follows from Principle 1 — a single neutral prompt should reach all targets.
- **Independent test:** After `ambykit sync`, every target with a command surface has a converge
  command file; snapshot tests pass; `ambykit check` reports no drift.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a project with any configured target, When `ambykit sync` runs, Then the converge command
  is emitted in that target's native format.
- Given the repo itself, When `ambykit sync` runs, Then `.claude/commands/amby.converge.md` exists
  and the CI no-diff check passes (Principle 6).

### US-5 — Documented in the workflow  (priority: P3)

As a reader of the docs, I want converge described in the workflow guide and diagram, so that I
know when to run it (after implement; repeat until converged).

- **Why this priority:** Discoverability; not needed for the feature to function.
- **Independent test:** Docs-sync checker passes; workflow diagram shows the implement ⇄ converge loop.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the docs site, When built, Then the workflow page lists converge with its inputs/outputs and
  the implement → converge loop.

## Requirements (EARS)

- FR-001  WHEN the converge phase is invoked for a feature, THE SYSTEM SHALL load only that
  feature's `spec.md`, `plan.md`, and `tasks.md` (plus plan sub-artifacts such as contracts/data
  model when present) per Principle 3.
- FR-002  THE SYSTEM SHALL evaluate every `FR-###` and `SC-###` in the spec and every decision in
  the plan against the codebase and classify each as **covered** or **gap**.
- FR-003  THE SYSTEM SHALL evaluate every checked `T###` and classify it as **verified** or **gap**
  when its deliverable cannot be found.
- FR-004  WHEN at least one gap exists, THE SYSTEM SHALL append one unchecked task per gap under a
  `## Convergence` section in `tasks.md`, with IDs continuing the existing `T###` sequence and a
  reference to the ID(s) it closes.
- FR-005  WHEN no gaps exist, THE SYSTEM SHALL report **converged**; WHEN additionally no unverified
  items exist, it SHALL leave `tasks.md` byte-for-byte unchanged.
- FR-006  THE SYSTEM SHALL NOT create, modify, or delete any file other than `tasks.md` and the
  `status:` lines of `spec.md`; in particular it SHALL NOT edit source code.
- FR-007  IF a gap is already represented by an unchecked task in the Convergence section, THEN THE
  SYSTEM SHALL NOT append a duplicate.
- FR-008  THE SYSTEM SHALL output a summary containing the verdict, the count of gaps, and the list
  of covered/gap IDs with a one-line reason per gap.
- FR-009  WHEN all FR/SC IDs referenced by a story are covered, THE SYSTEM SHALL set that story's
  `status` to `done`; WHEN all stories are `done`, it SHALL set the feature `status` to `done`.
- FR-010  THE SYSTEM SHALL be authored as a single neutral phase prompt in `src/prompts/` and emitted
  by every existing emitter without emitter-specific logic (Principles 1, 2).
- FR-011  IF the feature dir lacks `tasks.md`, THEN THE SYSTEM SHALL stop and instruct the user to
  run `/amby.tasks` first, without writing anything.
- FR-012  IF the feature has no `plan.md`, THEN THE SYSTEM SHALL converge against `spec.md` and
  `tasks.md` only and say so in the summary.
- FR-013  WHERE evidence for an item is inconclusive, THE SYSTEM SHALL list it as **unverified**
  (counted separately from gaps) and SHALL append one unchecked task per unverified item, prefixed
  `[VERIFY]`, under the same `## Convergence` section, subject to the FR-007 no-duplicate rule.
- FR-014  THE SYSTEM SHALL keep the converge prompt within the same size band as the existing phase
  prompts (roughly the length of `analyze`; no hard ceiling), per Principle 3.
- FR-015  THE SYSTEM SHALL accept an optional feature id argument and default to the current feature
  when none is given, consistent with `tasks` and `analyze`.

## Success criteria

- SC-001  On a fixture feature with K seeded gaps and U unverified items, converge appends exactly
  K + U tasks (U of them `[VERIFY]`-prefixed) and lists exactly those IDs; with K = U = 0 the
  `tasks.md` hash is unchanged.
- SC-002  Running converge twice consecutively without implementing produces no change on the
  second run (idempotent).
- SC-003  100% of converge runs leave source files untouched (clean `git status` outside `specs/`).
- SC-004  Every target with a command surface emits the converge command; snapshot tests cover it.
- SC-005  The implement → converge loop reaches **converged** on the repo's own spec `001` (which
  today shows `in-progress` with all tasks done) — dogfooding proof per Principle 6.

## Edge cases

- `tasks.md` already has a `## Convergence` section from a prior run — append, do not recreate.
- Highest `T###` is inside the Convergence section — IDs must still continue from it.
- Spec has FRs not mapped to any story — still evaluated; story status logic ignores them.
- Explicit feature id that does not exist — stop with a clear message, write nothing.
- Plan decisions explicitly marked deferred / out of scope — must not be reported as gaps.
- Large codebases — converge scopes reads to files the plan/tasks name; it does not scan everything.

## Assumptions

- Converge is an assistant-run phase (reads code with model tokens); a zero-token local mode is out
  of scope for this feature.
- ID conventions (`T###`, `US-#`, `FR-###`, `SC-###`) are stable and parseable as today.
- Existing `ambykit analyze` and `dashboard` consume appended tasks without changes.
