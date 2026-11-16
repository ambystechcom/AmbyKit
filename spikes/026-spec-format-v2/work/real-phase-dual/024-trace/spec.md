---
feature: 024-trace          # NNN-slug
title: Requirement traceability (trace)
branch: 024-trace
status: done                   # draft | ready | in-progress | blocked | done
created: 2026-11-12
stories:
  - id: US-1
    priority: P1
    status: done
  - id: US-2
    priority: P1
    status: done
  - id: US-3
    priority: P2
    status: done
    depends-on: [US-1]
  - id: US-4
    priority: P2
    status: done
    depends-on: [US-1, US-3]
  - id: US-5
    priority: P1
    status: done
    depends-on: [US-1]
  - id: US-6
    priority: P3
    status: done
    depends-on: [US-1]
  - id: US-7
    priority: P1
    status: done
---

# Spec — Requirement traceability (trace)

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Principle 5 says every functional requirement maps to a test, but nothing checks it: coverage is
whatever a reviewer or `/amby.converge` can work out by reading code, which costs model tokens and
varies run to run. This feature adds `ambykit trace`: a local command that builds the **requirement →
test → code** matrix from the specs and the tests, lists what is uncovered or orphaned, and feeds the
dashboard and `converge`. It runs at zero model tokens (Principle 3).

**Out of scope:** generating tests, measuring runtime code coverage, judging whether a test is *good*,
and test design itself (spec 021, which `trace` only reads). Strictly additive: nothing in existing
specs or tests has to change.

## User scenarios & testing

### US-1 — See which requirements have tests  (priority: P1)

As a developer, I want to run one command and see which requirements are covered by tests, so that
"every FR maps to a test" is a check, not a belief.

- **Why this priority:** this is the core capability and the missing check behind Principle 5.
- **Independent test:** on a feature with two covered requirements and one uncovered, run `trace` and
  confirm the uncovered one is listed.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature whose tests cite requirement IDs in their names (for example `019:FR-004: …`), When
  `trace` runs, Then each requirement is reported covered with the tests that cite it.
- Given a requirement no test cites, When `trace` runs, Then it is listed as uncovered with its ID and
  text.
- Given a test that cites an ID that does not exist in any spec, When `trace` runs, Then the test is
  reported as an orphan.
- Given a test that cites no requirement, When `trace` runs, Then it is reported as uncited, separately
  from orphans.
- Given no feature argument, When `trace` runs, Then it covers every feature; given one, Then only that
  feature.
- Given a feature with no requirements, When `trace` runs, Then it says so and reports nothing as
  uncovered.

### US-2 — Tests cite what they cover  (priority: P1)

As a developer, I want a simple, documented way for tests to cite requirements, so that coverage can be
read without understanding my code.

- **Why this priority:** without a citation convention there is nothing to match.
- **Independent test:** write one test named with an FR ID and one without, and confirm only the first
  is matched.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a test whose name begins with a qualified ID such as `019:FR-004:`, When `trace` reads it, Then
  the test is matched to that requirement.
- Given a test citing several IDs, When read, Then it is matched to each.
- Given a feature number in the ID form `NNN:FR-004`, When read, Then it is matched to that feature's
  requirement even in a project with several features.
- Given a bare `FR-004` in a test name and more than one feature defining `FR-004`, When read, Then it
  is reported as ambiguous and matched to none.
- Given tests written before this convention, When `trace` runs, Then they appear as uncited and
  nothing fails.
- Given the convention, When a person reads the docs, Then one short section states exactly how to
  cite.

### US-3 — Gate on coverage in CI  (priority: P2)

As a maintainer, I want machine-readable output and an optional failing exit code, so that CI can block
a change that leaves requirements uncovered.

- **Why this priority:** it makes the check enforceable, but the report is useful first on its own.
- **Independent test:** run `trace --json` and parse it; run with the gate option and confirm a non-zero
  exit when a requirement is uncovered and zero when none is.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given `--json`, When `trace` runs, Then the output has a stable, documented shape with covered
  requirements, uncovered requirements, orphans and uncited tests.
- Given the gate option and any uncovered requirement, When `trace` runs, Then it exits non-zero.
- Given the gate option and full coverage, When `trace` runs, Then it exits zero.
- Given no gate option, When `trace` runs with uncovered requirements, Then it exits zero, so default
  use never breaks a build.
- Given a requirement deliberately left without a test, When it is marked as such with a reason, Then
  the gate does not count it as uncovered; the mark is recorded in `tests.md` (spec 021) with a reason,
  and a feature without a test design records it as a note in the spec next to the requirement.

### US-4 — See coverage on the dashboard  (priority: P2)

As a team lead, I want coverage per feature shown next to task progress, so that I can see whether
"done" tasks are backed by tests.

- **Why this priority:** visibility is the payoff for leads, but the command already gives the data.
- **Independent test:** open the dashboard on a feature with partial coverage and confirm the covered
  fraction and uncovered requirements appear.
- **depends-on:** [US-1, US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the dashboard, When a feature has requirements, Then it shows covered over total next to task
  progress.
- Given the interactive quality view, When opened, Then it lists uncovered requirements and `analyze`
  findings. The converge gap trend belongs to spec 032 (2.0).
- Given one-shot or `--json` dashboard output, When it runs, Then the coverage figure is included
  within the existing 1-second budget, with a stable shape for scripts.
- Given a narrow or plain-text terminal, When coverage is shown, Then it is readable without color or
  glyphs.
- Given a feature with no tests at all, When shown, Then coverage reads zero, not an error.

### US-5 — Let converge start from the matrix  (priority: P1)

As a developer running `/amby.converge`, I want it to read the matrix first and spend model effort only
on what the matrix cannot answer, so that gap checks get cheaper and more consistent.

- **Why this priority:** it is the main token saving and removes run-to-run guesswork.
- **Independent test:** run `converge` on a feature with a known uncovered requirement and confirm it
  begins from the matrix and does not re-derive coverage by reading all tests.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature, When `/amby.converge` starts, Then it reads the `trace` result and treats uncovered
  requirements as gaps without re-deriving them.
- Given requirements the matrix marks covered, When `converge` runs, Then it spends effort only on
  whether the tests and code actually satisfy them.
- Given `trace` is unavailable, When `converge` runs, Then it works as it does today.
- Given `converge` appends gap tasks, When it does, Then each cites the requirement ID by reference
  instead of restating it.

### US-6 — Use the test design where it exists  (priority: P3)

As a developer using test design (spec 021), I want `trace` to compare the designed cases with the real
tests, so that planned automated cases that were never written show up.

- **Why this priority:** it extends coverage from "has a test" to "has the designed test", but only for
  features that adopt spec 021.
- **Independent test:** a feature with a designed automated case and no matching test is reported as
  missing; one without test design is unaffected.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature with test design, When `trace` runs, Then each designed automated case is reported
  as matched or missing, matched by the requirement ID in a test name.
- Given a designed manual case, When `trace` runs, Then it is listed as manual and not counted missing.
- Given a feature without test design, When `trace` runs, Then the report is identical to the
  requirement-only report.

### US-7 — Adopt without disturbing existing projects  (priority: P1)

As a maintainer of existing AmbyKit projects, I want `trace` to be additive, so that upgrading to 1.5
changes nothing until I use it.

- **Why this priority:** 1.x must stay additive (breaking changes belong to 2.0).
- **Independent test:** run every existing command on this repo before and after and compare outputs.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a project that never runs `trace`, When any existing command runs, Then its behavior and output
  are unchanged relative to the previous release's baseline, excluding other 1.5 additions (specs 020,
  021 and 022 add `analyze` findings) and the added dashboard coverage figure.
- Given tests in any layout, When `trace` runs, Then it never edits tests or specs.
- Given this repo's own tests and specs, When `trace` runs, Then it produces a report and the repo
  reaches full coverage over time (the 1.5 gate).

## Requirements (EARS)

- FR-001  WHEN `ambykit trace` runs, THE SYSTEM SHALL build, at zero model tokens, a matrix from each
  requirement to the tests that cite it, from the specs and the test files.
- FR-002  THE SYSTEM SHALL match a test to a requirement only when the test's name begins with the
  qualified requirement ID (`NNN:FR-###`), and to each ID when several are cited.
- FR-003  IF a requirement has no citing test, THEN THE SYSTEM SHALL list it as uncovered with its ID and
  text.
- FR-004  IF a test cites an ID that exists in no spec, THEN THE SYSTEM SHALL list the test as an
  orphan.
- FR-005  IF a test cites no ID, THEN THE SYSTEM SHALL list it as uncited, separately from orphans.
- FR-006  WHEN a feature argument is given, THE SYSTEM SHALL report only that feature, else every
  feature.
- FR-007  THE SYSTEM SHALL disambiguate requirement IDs across features by the qualified form
  `NNN:FR-###` in test names, and SHALL report a bare `FR-###` as ambiguous when more than one feature
  defines it.
- FR-008  WHEN `--json` is given, THE SYSTEM SHALL output covered, uncovered, orphan and uncited items in
  a stable, documented shape that adds fields without removing or renaming existing ones.
- FR-009  WHERE the gate option is given and any requirement is uncovered, THE SYSTEM SHALL exit
  non-zero; otherwise it SHALL exit zero.
- FR-010  THE SYSTEM SHALL NOT count a requirement as uncovered when it is recorded as deliberately
  uncovered with a reason in `tests.md`, or, for a feature without a test design, in a note in the spec
  next to the requirement.
- FR-011  THE SYSTEM SHALL NOT edit any spec or test file.
- FR-012  WHEN the dashboard runs, THE SYSTEM SHALL show covered over total requirements per feature next
  to task progress, in one-shot and `--json` output, within the 1-second budget.
- FR-013  WHERE the dashboard runs with `--interactive`, THE SYSTEM SHALL offer a quality view listing
  uncovered requirements and `analyze` findings (the converge gap trend is owned by spec 032).
- FR-014  WHILE the terminal is narrow or lacks color and glyph support, THE SYSTEM SHALL show coverage
  as plain text.
- FR-015  WHEN `/amby.converge` starts on a feature, THE SYSTEM SHALL have it read the `trace` result
  first, then the test design from spec 021 where present, treat uncovered requirements as gaps without
  re-deriving them, and cite requirement IDs by reference in gap tasks. This is the single statement
  of the converge reading order.
- FR-016  IF `trace` is unavailable, THEN `/amby.converge` SHALL behave as it does today.
- FR-017  WHERE a feature has test design (spec 021), THE SYSTEM SHALL report each designed automated
  case as matched or missing, and list manual cases without counting them missing.
- FR-018  WHERE a feature has no test design, THE SYSTEM SHALL produce the requirement-only report.
- FR-019  THE SYSTEM SHALL leave the behavior and output of every existing command unchanged relative to
  the previous release's baseline, excluding other 1.5 additions (specs 020, 021 and 022 add `analyze`
  findings) and the added dashboard coverage figure.
- FR-020  THE documentation SHALL state in one short section how tests cite requirements.
- FR-021  THE converge changes and any `trace` prompt text SHALL be authored once in the neutral source
  and emitted per tool, and SHALL reference IDs rather than restate requirements (Principles 1 and 3).

## Success criteria

- SC-001  `trace` over all specs and tests in this repo completes within one second and uses zero model
  tokens.
- SC-002  Every requirement in this repo is reported covered, uncovered, or deliberately uncovered, and
  none is unaccounted for.
- SC-003  After `trace` is adopted here, every FR in 019–025 maps to at least one test (Principle 5).
- SC-004  `/amby.converge` on a sample feature reads fewer test files than before, because it starts from
  the matrix.
- SC-005  Every FR in this spec maps to at least one test, and `npm run typecheck` and `npm test` pass.
- SC-006  Feature 024 is itself traced: its own tests cite its FR IDs and `trace` reports it fully
  covered (the 1.5 gate, Principle 6).

## Edge cases

- A test that cites an ID inside a long description or a nested `describe` name.
- The same ID cited by dozens of tests, or a requirement deleted while tests still cite it.
- Test files in several languages or layouts, or generated tests.
- A skipped, todo or pending test that cites a requirement does not count as covering it and is listed
  separately.
- Requirements renumbered after tests were written.
- A feature in a worktree with tests the main checkout does not have.
- A spec with `[NEEDS CLARIFICATION]` markers still open.
- Very large test suites: the one-shot budget must hold.

## Assumptions

- Requirements carry stable `FR-###` IDs in each spec, as in the current template.
- Tests can be found by a documented, configurable location convention; the exact convention is a plan
  decision.
- Test design (spec 021), the dependency graph (spec 023) and the dashboard redesign (spec 032) arrive
  separately; this feature stands without them.
- Citing by test name is enough for 1.5; deeper code-level links (requirement to code) may follow later.
