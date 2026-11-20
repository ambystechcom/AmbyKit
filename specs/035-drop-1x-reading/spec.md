---
feature: 035-drop-1x-reading          # NNN-slug
title: Drop reading of 1.x specs
branch: 035-drop-1x-reading
status: draft                     # draft | ready | in-progress | blocked | done
created: 2026-11-20
---

# Spec — Drop reading of 1.x specs

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

AmbyKit 2.0 reads both spec formats: the 1.x one, kept so projects have time to move, and format v2 (spec 030). Reading
two formats costs every reader a legacy path, a notice on every run, and a set of tests that guard the old behaviour.
The roadmap ends that support in **2.1**. This feature is the 2.1 work: decide that the time has come, make the removal
safe for people who did not migrate, remove the legacy path and its tests, and keep `migrate` so that a 1.x project can
still be converted. It is one release, not a long project, and it must not run before its gate is met.

**Out of scope:** the 2.0 release (spec 034), changes to format v2 itself, and any other 2.1 feature.

## User scenarios & testing

### US-1 — The removal is decided, not assumed  (priority: P1)

As the maintainer, I want an explicit go decision with written conditions, so that 1.x support does not end by accident or by calendar.

- **Why this priority:** 030 promised "support ends in 2.1" in every notice; the promise needs a real condition behind it.
- **Independent test:** read the decision record and confirm each condition has a recorded answer.
- **depends-on:** [030:US-6]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the decision record, When it is read, Then it states the exact wording of the gate that the release maintainer confirmed in
  spec 030 (its task T090), and the conditions that must hold: an adoption window since 2.0 has passed, `migrate` has had no
  open data-loss defect during that window, and the remaining 1.x users have a documented path.
- Given the adoption window, When it is judged, Then the evidence is only what needs no tracking of users: public package download
  counts, issues and reports, and projects the maintainers know about. No telemetry is added (Principle 7).
- Given a condition that is not met, When 2.1 is planned, Then the removal is deferred and the notice wording stays as it is.
- Given the decision, When it is recorded, Then it is a numbered decision record cited by this feature.

### US-2 — A 1.x project gets a clear stop, never a silent misread  (priority: P1)

As a user who did not migrate, I want a plain error that tells me what to do, so that I do not lose data or guess.

- **Why this priority:** reading a file with the wrong reader loses data silently (026's finding); removal must not recreate that.
- **Independent test:** run `analyze` on a 1.x project and confirm it stops with the migrate instruction and changes nothing.
- **depends-on:** [030:US-6, US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a feature in the 1.x format, When any command reads it, Then the command stops with a message naming the file, the
  fact that 1.x is no longer read, and the exact command to run (`ambykit migrate --dry-run`, then `ambykit migrate`).
- Given that error, When it is shown, Then no file has been read as v2 or modified and no partial output was printed.
- Given a project with some features in 1.x and some in v2, When a command runs, Then it stops once, lists every 1.x feature, and
  does not process the v2 ones half way.
- Given a person who has not upgraded their projects, When they stay on 2.0.x, Then nothing changes for them.

### US-3 — The legacy path is gone  (priority: P1)

As a maintainer, I want the 1.x reading code removed, so that every reader is simpler and faster.

- **Why this priority:** it is the whole point of the release.
- **Independent test:** search the source for the legacy reader and notice code and confirm none is left.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the source, When it is searched, Then the dispatcher has no 1.x reading branch, the 1.x notice from `check` and the
  `legacyWarning` config key are gone, and no module imports the removed parsers.
- Given a config file that still sets `legacyWarning`, When it is loaded, Then it is accepted and ignored with one notice, not rejected.
- Given the history readers (burndown, lanes reading a branch), When they meet a 1.x revision, Then they skip it and count it,
  as they do for any unreadable revision, and do not fail.
- Given the removal, When the one-shot dashboard and `--json` output are measured, Then they are not slower than in 2.0.

### US-4 — The tests that only guarded 1.x reading are removed, coverage stays  (priority: P2)

As a maintainer, I want the baselines and parity tests for 1.x deleted or converted, so that the suite is not carrying dead weight.

- **Why this priority:** the suite got heavy partly from compatibility tests; removing them is the saving of this release.
- **Independent test:** compare the list of removed tests with `trace` before and after; no FR loses its last test.
- **depends-on:** [US-3]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the tests that exist to prove 1.x is read exactly as before (the recorded 1.x model and output baselines and the 1.x
  parity checks), When the legacy path is removed, Then they are deleted, and the list of deleted files is in the change.
- Given each deleted test, When `trace` runs before and after, Then no requirement loses its only citing test; a requirement that
  would is covered by a converted test first.
- Given fixtures of the 1.x format, When they remain, Then they exist only to prove the "no longer read" error and `migrate`.

### US-5 — `migrate` stays available  (priority: P2)

As a user with an old project, I want `migrate` to keep working after 2.1, so that I can still catch up.

- **Why this priority:** removing the reader without the converter would strand every late upgrader.
- **Independent test:** run `migrate` on a 1.x project with 2.1 and confirm the result is a clean v2 project.
- **depends-on:** [030:US-3, US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a 1.x project, When `ambykit migrate` runs in 2.1, Then it converts it as in 2.0, with the same safety rules, dry run
  and idempotence, using its own reader that is not shared with the removed one.
- Given the migrate reader, When the 1.x format is described, Then the description is the specification of 1.x, kept as
  documentation under `docs/` so the format is not lost.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL record the removal decision, with the confirmed gate wording and the dated evidence for each
  condition, as a decision record before any code is removed.
- FR-002  IF a condition is not met, THEN THE SYSTEM SHALL NOT remove 1.x reading and SHALL keep the existing notice wording.
- FR-003  THE SYSTEM SHALL use only evidence that needs no tracking of users, and SHALL add no telemetry (Principle 7).
- FR-004  IF a command reads a feature in the 1.x format, THEN THE SYSTEM SHALL stop with a message that names the file, says 1.x is
  no longer read and gives the migrate commands, before reading or changing anything.
- FR-005  WHEN a project mixes formats, THE SYSTEM SHALL list every 1.x feature in one message and process none half way.
- FR-006  THE SYSTEM SHALL remove the 1.x reading branch of the per-file reader, the 1.x notice and the `legacyWarning` key, and
  SHALL accept a config that still sets the key, ignoring it with one notice.
- FR-007  WHEN a history reader meets a 1.x revision, THE SYSTEM SHALL skip and count it instead of failing.
- FR-008  THE SYSTEM SHALL delete the tests that only guard 1.x reading, SHALL list them, and SHALL NOT remove the last test of any
  requirement (Principle 5).
- FR-009  THE SYSTEM SHALL keep `migrate` converting 1.x projects with the same safety rules, using a reader of its own.
- FR-010  THE SYSTEM SHALL keep a description of the 1.x format in the documentation.
- FR-011  THE SYSTEM SHALL keep one-shot and `--json` dashboard output within the existing time budget.

## Success criteria

- SC-001  The decision record exists with dated evidence for every condition before the first line is removed.
- SC-002  Running any command on a 1.x project in 2.1 stops with the migrate instructions and changes no file.
- SC-003  No 1.x parser, notice or `legacyWarning` handling is left in the source except inside `migrate`.
- SC-004  `trace` shows no requirement that lost its only test, and the suite is faster than in 2.0 by the removed tests' share.
- SC-005  A 1.x project migrated by 2.1's `migrate` passes `check` and `analyze`.
- SC-006  `npm run typecheck` and `npm test` pass, and every FR maps to at least one test (Principle 5).

## Edge cases

- A project that never migrated and pins 2.0.x: nothing changes for it.
- A project with one 1.x feature among many v2 features: one message, nothing processed.
- A 1.x file with syntax `migrate` skips (the skip-and-list conditions of 030): `migrate` lists it and 2.1 still refuses to read it.
- Git history that contains 1.x revisions: skipped and counted by history readers, never an error.
- The adoption window is judged met but a data-loss defect in `migrate` is reported later: removal is paused.

## Assumptions

- Spec 034 (2.0) has shipped and its adoption window has run; the maintainer's confirmed wording from spec 030 (task T090) is available.
- The removal ships as 2.1, a minor release that is allowed to end 1.x reading because the 2.0 notices said so (spec 033's deprecation
  policy applies to the stable run and plugin surfaces, not to the spec format, which 2.0 announced).
- Public information (download counts, issues) is enough evidence; asking users for usage data is out of the question.
