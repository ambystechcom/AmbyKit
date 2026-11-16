---
feature: 020-blocked-and-verify          # NNN-slug
title: Blocked markers and Verify lines
branch: 020-blocked-and-verify
status: ready                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — Blocked markers and Verify lines

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Today a task that cannot proceed, or that was done differently than planned, leaves no trace a tool
can read, and "phase done" means only that every box is ticked. This feature adds two additive,
machine-readable conventions to `tasks.md`: a **BLOCKED marker** (with an optional deviation note) on
a task line, and one **Verify line** per phase that the implementer runs before the phase checkpoint.
`dashboard` and `analyze` surface both locally at zero model tokens (Principle 3).

**Out of scope:** running Verify lines in CI, a Verify result history, and any structured (non-markdown)
task format — that belongs to spec format v2. Existing `tasks.md` files must keep working unchanged.

## User scenarios & testing

### US-1 — Mark a task as blocked  (priority: P1)

As an implementer (person or assistant), I want to mark a task as blocked with a reason, and add a
deviation note when I did it differently than planned, so that the problem is visible to everyone
instead of buried in a silent unchecked box.

- **Why this priority:** a stalled or deviating task is the main thing a person must see during
  implementation, and it is the foundation for the other stories.
- **Independent test:** add a BLOCKED marker to one task line in a sample `tasks.md` and confirm the
  task is read as blocked with that reason, while every other task is read as before.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given an unchecked task line, When a BLOCKED marker with a reason is added, Then the task is
  reported as blocked and the reason is retrievable.
- Given a blocked task, When the marker is removed and the task is later checked off, Then it is no
  longer reported as blocked.
- Given a task line with a deviation note, When the file is read, Then the note is associated with that
  task and does not change its checked state or file ownership.
- Given a BLOCKED marker with no reason, When the file is read, Then the task is still reported as
  blocked and flagged as missing a reason.
- Given a checked task that still carries a BLOCKED marker, When the file is read, Then it is reported
  as inconsistent rather than as blocked.

### US-2 — See blocked work at zero tokens  (priority: P1)

As a team lead, I want `dashboard` and `analyze` to list blocked tasks and deviation notes, so that I
can spot stuck work without opening files or spending model tokens.

- **Why this priority:** visibility is the payoff of US-1; without it the marker is just text.
- **Independent test:** run `dashboard` and `analyze` on a feature with one blocked task and confirm
  both name the task and its reason, with no model call.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature with a blocked task, When the dashboard is shown, Then the feature's row and task
  detail indicate the blocked count and the reason.
- Given a blocked task, When `analyze` runs, Then it reports a finding naming the task ID and reason.
- Given `--json` output, When a feature has blocked tasks, Then they appear in a stable, documented shape.
- Given no blocked tasks, When either command runs, Then its output is unchanged from today.
- Given the interactive dashboard on a narrow or plain-text terminal, When a task is blocked, Then it
  is still distinguishable without color or icon support.

### US-3 — Verify a phase before its checkpoint  (priority: P1)

As an implementer, I want each phase to declare how it is verified and to run that check before the
checkpoint, so that "phase done" means the phase actually works, not only that its boxes are ticked.

- **Why this priority:** this is the quality gate the roadmap's pipeline needs; later features (QA
  agents, `/amby.run`) build on it.
- **Independent test:** give a phase a Verify line, run `/amby.implement` through that phase, and
  confirm the check runs before the checkpoint and its result is recorded.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a phase with a Verify line and all its tasks checked, When the implementer reaches the
  checkpoint, Then the Verify check is run first and its pass or fail is recorded.
- Given a Verify check that fails, When the implementer reports, Then the phase checkpoint is not
  passed and the failure is recorded against the phase.
- Given a failed Verify, When the cause is fixed and Verify passes on re-run, Then the checkpoint can
  be passed and the earlier failure is no longer reported as current.
- Given a phase with no Verify line, When the implementer reaches its checkpoint, Then behavior is as
  today and the gap is surfaced as a warning, not an error.
- Given a Verify line the implementer cannot run (needs a manual or external step), When reached,
  Then the implementer says so, asks the person to confirm, and records the check as unverified.

### US-4 — See missing and failed Verify lines  (priority: P2)

As a team lead, I want `dashboard` and `analyze` to flag phases that lack a Verify line or whose last
Verify failed, so that unverified phases are caught early at zero tokens.

- **Why this priority:** it completes the loop but depends on US-3 conventions and has a manual fallback.
- **Independent test:** on a feature with one phase lacking Verify and one with a failed Verify, confirm
  both are reported by `analyze` and shown on the dashboard.
- **depends-on:** [US-3]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a phase with no Verify line, When `analyze` runs, Then it reports a finding naming the phase.
- Given a phase whose last recorded Verify failed, When the dashboard is shown, Then the phase is
  marked failed and the feature is not shown as fully verified.
- Given a feature where every phase is verified, When the dashboard is shown, Then it is shown as such.
- Given a feature authored before this change, When `analyze` runs, Then missing-Verify findings are
  warnings and never change the exit status of `analyze`. A strict mode is out of scope for 1.4.

### US-5 — Adopt without breaking existing specs  (priority: P1)

As a maintainer of existing AmbyKit projects, I want today's `tasks.md` files and tooling output to
keep working unchanged, so that upgrading to 1.4 needs no migration.

- **Why this priority:** a breaking change belongs to 2.0; 1.4 must be strictly additive.
- **Independent test:** run `analyze` and `dashboard` on every existing `specs/*/tasks.md` before and
  after the feature, and confirm identical results apart from the new warnings.
- **depends-on:** [US-1, US-3]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given any `tasks.md` that predates this feature, When read, Then task IDs, checked state, `[P]`
  markers and file ownership are parsed exactly as before.
- Given a task line carrying both a BLOCKED marker and a file-ownership suffix, When read, Then both
  are recovered correctly.
- Given the new `tasks.md` template, When a feature is created, Then it includes a Verify line per
  phase and documents the BLOCKED marker.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL recognize a BLOCKED marker, written as `⚠ BLOCKED: <reason>` or, without
  the glyph, `BLOCKED: <reason>`, on a task line in `tasks.md`, and associate the reason with that task.
- FR-002  THE SYSTEM SHALL recognize an optional deviation note on a task line, written as a separate
  marker `↪ DEVIATION: <note>` that is valid with or without a BLOCKED marker, and associate it with
  that task without altering the task's checked state, ID, `[P]` marker or file ownership.
- FR-003  IF a BLOCKED marker has no reason text, THEN THE SYSTEM SHALL still treat the task as blocked
  and report the missing reason.
- FR-004  IF a task is checked and still carries a BLOCKED marker, THEN THE SYSTEM SHALL report the
  inconsistency instead of counting the task as blocked.
- FR-005  THE SYSTEM SHALL recognize one Verify line per phase, written as `**Verify:** <check>`, in
  `tasks.md`.
- FR-006  WHEN the implementer reaches a phase checkpoint and the phase has a Verify line, THE SYSTEM
  SHALL have the implementer run the Verify check before passing the checkpoint and record the result
  (pass, fail or unverified) in `tasks.md`, as a result suffix on that Verify line: `✓ passed`,
  `✗ failed: <why>` or `? unverified`.
- FR-007  IF the Verify check fails, THEN THE SYSTEM SHALL NOT pass the checkpoint until a later
  Verify run passes.
- FR-008  IF a Verify line cannot be run by the implementer, THEN THE SYSTEM SHALL require explicit
  person confirmation and record the phase as unverified.
- FR-009  WHEN `ambykit analyze` runs, THE SYSTEM SHALL report blocked tasks (with reasons), phases
  without a Verify line, and phases whose last Verify failed, each by stable ID, at zero model tokens.
- FR-010  WHEN `ambykit dashboard` runs, THE SYSTEM SHALL show per-feature blocked counts and
  per-phase verify state, in both the one-shot and `--json` outputs, at zero model tokens.
- FR-011  WHERE a `tasks.md` has no BLOCKED markers and no Verify lines, THE SYSTEM SHALL produce
  `dashboard` and `analyze` output identical to today's apart from missing-Verify warnings.
- FR-012  THE SYSTEM SHALL parse every existing `tasks.md` in this repo with unchanged task IDs,
  checked state, `[P]` markers and file ownership.
- FR-013  THE `--json` output of `dashboard` and `analyze` SHALL expose the new fields in a stable,
  documented shape that does not remove or rename existing fields.
- FR-014  WHILE the terminal is narrow or lacks color and icon support, THE SYSTEM SHALL mark blocked
  and failed items with text that does not depend on color or glyphs.
- FR-015  THE tasks template and the `/amby.tasks` and `/amby.implement` prompts SHALL document the
  BLOCKED marker and the Verify line, and `/amby.implement` SHALL tell the implementer when to add a
  marker and when to run Verify, without increasing prompt size beyond what the rules require
  (Principle 3).
- FR-016  WHEN an implementer marks a task blocked, THE SYSTEM SHALL have it stop work on that task,
  record the marker, and continue with other unblocked tasks where any exist.

## Success criteria

- SC-001  A blocked task is visible in `dashboard` and `analyze` output within the dashboard's existing
  1-second one-shot budget, with zero model tokens used.
- SC-002  100% of existing `specs/*/tasks.md` files produce the same parsed tasks as before the change.
- SC-003  A phase with a failing Verify can never be reported as passed or as fully verified.
- SC-004  Every FR in this spec maps to at least one test (Principle 5), and `npm run typecheck` and
  `npm test` pass.
- SC-005  Feature 020 is itself built with parallel lanes, and the lane merges complete with no manual
  conflict resolution caused by this feature's conventions (the 1.4 gate, Principle 6).

## Edge cases

- Multiple BLOCKED markers on one task line.
- A BLOCKED reason containing markdown (backticks, parentheses) that looks like file ownership.
- A phase with more than one Verify line.
- A Verify line placed outside any phase, or in a feature with no phases.
- A task blocked by another task: whether this is expressed in the reason text only.
- A blocked task inside a parallel lane whose lane is otherwise complete.
- A `tasks.md` edited by two lanes at once: markers on different tasks must merge cleanly.
- Windows line endings and non-ASCII `⚠` in the marker: `BLOCKED:` without the glyph is also accepted
  and read identically (likewise `DEVIATION:` without `↪`).

## Assumptions

- Task lines already carry a stable `T###` ID, a checkbox, an optional `[P]` marker and a trailing
  file-ownership suffix; the new markers coexist with these.
- "Phase" means the headed groups of tasks in `tasks.md` that already end in a checkpoint.
- The Verify check is something the assistant can run or reason about (a command, test run or
  observable condition); it is not a new CI system.
- `dashboard` and `analyze` already read `tasks.md` locally; this feature extends what they extract.
- Parallel lanes (015) and the live activity markers (017) are available; this feature does not change
  either.
