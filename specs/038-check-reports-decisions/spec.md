---
feature: 038-check-reports-decisions          # NNN-slug
title: check reports decision-record problems
branch: 038-check-reports-decisions
status: ready                     # draft | ready | in-progress | blocked | done
created: 2026-11-25
---

# Spec — check reports decision-record problems

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

`ambykit check` is the doctor people run first, but it says nothing about the decision records in `.amby/decisions/`: a dangling
`ADR-###` citation or a record missing from the index shows up only in `ambykit analyze`. This feature makes `check` report the same
decision problems, at the severity the project chose (037).

This feature and 037 are the 2.0 fleet dogfood (031 T094, 033 T071): one `ambykit run 037 038` fleet builds both, 038 after 037.

## User scenarios & testing

### US-1 — The doctor shows decision problems  (priority: P1)

As a maintainer, I want `ambykit check` to list the problems in my decision records, so that one doctor run tells me everything that is
wrong with the project's setup.

- **Why this priority:** it is the whole feature.
- **Independent test:** in a project with a dangling citation and a record missing from the index, `check` prints one line for each
  and exits 1; set the dangling-citation severity to warning (037) and it exits 0 with both lines shown as warnings.
- **depends-on:** [037:US-1]
- **blocked-by:** []
- **status:** ready

**Acceptance criteria**
- Given a spec cites an `ADR-###` with no record, When `ambykit check` runs, Then it prints one line naming the citation and its source
  and exits 1.
- Given the project sets the dangling-citation severity to warning (037:FR-001), When `ambykit check` runs, Then the same line is a
  warning and the citation alone does not change the exit status.
- Given a record has no row in the index, When `ambykit check` runs, Then it prints one warning line and the exit status is unchanged.
- Given the project has no decision records and no citations, When `ambykit check` runs, Then its output is what it is today.
- Given the same project, When `ambykit analyze` and `ambykit check` run, Then both list the same decision problems at the same levels.

## Requirements (EARS)

- FR-001  WHEN `check` runs in a project with decision records or `ADR-###` citations, THE SYSTEM SHALL print one concise line per
  decision problem, naming its kind and what it concerns.
- FR-002  THE SYSTEM SHALL report a dangling citation at the level the project configured (037:FR-001, 037:FR-002).
- FR-003  THE SYSTEM SHALL report warning-level decision problems, such as a record missing from the index, as warnings that do not
  change the exit status of `check`.
- FR-004  IF any decision problem is at error level, THEN `check` SHALL exit 1 and SHALL NOT report the project as healthy.
- FR-005  WHEN the project has no decision records and no citations, THE SYSTEM SHALL leave the output of `check` unchanged.
- FR-006  THE SYSTEM SHALL compute the decision problems in `check` with the same analysis `analyze` uses, so both list the same
  problems at the same levels.
- FR-007  THE SYSTEM SHALL document in the `check` section of the CLI reference that it reports decision-record problems.

## Success criteria

- SC-001  A project with one dangling citation gets exit 1 from `check` with one line naming it; with 037's warning setting, exit 0
  and the line as a warning.
- SC-002  The existing `check` tests pass unchanged (a project without decisions sees no difference).
- SC-003  `npm run typecheck` and `npm test` pass, and every FR maps to at least one test (Principle 5).

## Edge cases

- A decision record that cannot be parsed: reported as `analyze` reports it (error), one line.
- Many problems: one line each, no summary table; `analyze` stays the place for the full report.
- Problems in records and drift in tool files at the same time: both are reported; the exit status is 1 if either is an error.

## Assumptions

- `ambykit check` has no `--json` output and no MCP tool, so there is no JSON or MCP output to keep in step; adding one is out of scope.
- The severity setting and the shared analysis come from 037, which is merged first (the fleet orders it).
