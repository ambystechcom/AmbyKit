---
feature: 021-test-design          # NNN-slug
title: Test design before code
branch: 021-test-design
status: done                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
stories:
  - id: US-1
    priority: P1
    status: done
  - id: US-2
    priority: P1
    status: done
    depends-on: [US-1]
  - id: US-3
    priority: P1
    status: done
    depends-on: [US-1]
  - id: US-4
    priority: P2
    status: done
    depends-on: [US-1, "019:US-1"]
  - id: US-5
    priority: P2
    status: done
    depends-on: [US-3]
  - id: US-6
    priority: P2
    status: done
    depends-on: [US-1, US-3]
  - id: US-7
    priority: P1
    status: done
---

# Spec — Test design before code

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Today acceptance criteria are written in the spec, but nobody decides how each will be tested until
code exists, so tests are written after the fact and requirement coverage is a guess. This feature adds
**test design**: before implementation, each user story's Given/When/Then criteria become named test
cases, each citing what it covers by stable ID and marked automate or not. Implementers then build to
cases that already exist, and later tooling (`trace`, `converge`) can check coverage locally.

**Out of scope:** writing or running actual test code, the `trace` command itself (spec 024), choosing
or adding a test framework, and test-data management. Idea only, taken from a delivery-pipeline
framework; no proprietary content is reused.

## User scenarios & testing

### US-1 — Turn acceptance criteria into test cases  (priority: P1)

As a developer, I want each story's acceptance criteria turned into test cases before I write code, so
that I know what "done" is checked against and tests are designed, not improvised.

- **Why this priority:** it is the core of the feature; the other stories refine or consume it.
- **Independent test:** on a ready spec, produce the test design and confirm every acceptance
  criterion has at least one case.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a spec with acceptance criteria, When test design runs, Then each criterion yields at least one
  test case with a short name, the criterion it covers, and the expected outcome.
- Given a criterion that is vague or untestable, When test design runs, Then it is flagged against the
  criterion ID and no case is invented.
- Given a spec that is not `ready`, When test design is requested, Then it stops and says the spec must
  be ready first.
- Given a story with negative or edge-case criteria, When test design runs, Then those get cases too.
- Given the output, When a person reads it, Then each story has at most 15 cases (a story that needs
  more is split), so it can be reviewed per story without re-reading the whole spec.

### US-2 — Decide automate or not  (priority: P1)

As a developer, I want each test case marked automate or not, with a reason, so that effort goes to
automated checks where they pay off and manual checks are explicit instead of forgotten.

- **Why this priority:** without a decision, cases silently stay unwritten or become flaky manual steps.
- **Independent test:** confirm every case carries a decision and a one-line reason, and that manual
  cases say how they are verified.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a test case, When it is designed, Then it is marked either automate or manual, with a one-line
  reason.
- Given a manual case, When it is designed, Then it states how a person verifies it and who or what
  records the result.
- Given a case, When the rule is applied, Then it is automate by default, and manual only with a
  one-line reason taken from a short fixed list (needs human judgment, external system, visual check,
  one-off).
- Given a person disagrees with a decision, When they change it, Then only that case is updated.

### US-3 — Cite what each case covers by stable ID  (priority: P1)

As a team lead, I want every case to cite the acceptance criterion and requirement it covers, so that
coverage can be checked without reading prose.

- **Why this priority:** stable-ID citation is what lets `trace` and `converge` work at zero model
  tokens (Principle 3).
- **Independent test:** confirm every case lists IDs that exist in the spec, and every FR is covered by
  at least one case or listed as deliberately uncovered.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a test case, When it is written, Then it cites the story ID and, where applicable, the FR ID(s)
  it covers.
- Given an FR with no case, When test design is checked, Then it is reported as uncovered unless
  explicitly marked as deliberately uncovered with a reason.
- Given a case citing an ID that does not exist in the spec, When checked, Then it is reported.
- Given a case ID, When it is referenced elsewhere, Then it is stable and not renumbered when other
  cases change.

### US-4 — Have test design ready before implementation  (priority: P2)

As a developer using `/amby.run`, I want test design produced as part of the tasks phase, so that the
cases exist before any story's implementation begins, without a separate step.

- **Why this priority:** it is the payoff in the pipeline, but test design is useful standalone first.
- **Independent test:** in a run, confirm the tasks phase produces the test design and that it edits
  only its own artifact, never source files.
- **depends-on:** [US-1, 019:US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a run for a feature with a ready spec, When the tasks phase completes, Then the test design
  exists before the implement phase starts.
- Given test design runs, When it writes files, Then it writes only its own artifact and never source
  files.
- Given implementation finishes a story before its test design exists, When QA runs, Then QA notes the
  missing design instead of passing silently.

### US-5 — Feed coverage and gap checks  (priority: P2)

As a developer, I want the test design readable by `trace` and `converge`, so that coverage and gaps are
checked from the design rather than guessed after the fact.

- **Why this priority:** it connects this feature to the traceability work but depends on it.
- **Independent test:** confirm a machine-readable list of case IDs with their covered IDs can be read
  without a model.
- **depends-on:** [US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature with test design, When another tool reads it, Then it can list each case with its
  covered IDs and automate-or-not decision without a model.
- Given `converge` runs, When test design exists, Then it uses the designed cases as the expected tests
  after reading the `trace` matrix when spec 024 is present, and spends model effort only on what
  neither can answer.
- Given tests in the codebase are named after the FR they cover, When coverage is checked, Then designed
  automated cases can be matched to them by the qualified `NNN:FR-###` ID in the test name; case IDs
  stay in the test design and need not appear in test names.

### US-6 — Keep test design in step with the spec  (priority: P2)

As a developer, I want test design to update in place when the spec changes, so that I do not regenerate
and review the whole thing every time.

- **Why this priority:** specs change; stale designs would erode trust, but this is secondary to having
  a design at all.
- **Independent test:** change one acceptance criterion and confirm only its cases are flagged or
  updated.
- **depends-on:** [US-1, US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given an acceptance criterion changes, When test design is refreshed, Then only the cases citing it
  are updated or flagged, and other cases are untouched.
- Given a criterion is removed, When refreshed, Then its cases are flagged as obsolete, not silently
  deleted.
- Given a new criterion is added, When refreshed, Then new cases are added without renumbering existing
  ones.

### US-7 — Adopt without breaking existing features  (priority: P1)

As a maintainer of existing AmbyKit projects, I want test design to be optional for features that
already exist, so that upgrading to 1.5 needs no migration.

- **Why this priority:** 1.x must stay additive (breaking changes belong to 2.0).
- **Independent test:** run `analyze` and the other phases on a feature with no test design and confirm
  they behave as before.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature with no test design, When any existing phase runs, Then it behaves as before.
- Given a feature with no test design, When `analyze` runs, Then at most a non-blocking note is added.
- Given the new workflow, When a new feature is created, Then test design is part of the documented
  flow and can be skipped explicitly; the skip is recorded as a `tests.md` containing only a
  `skipped: <reason>` line, which spec 024 can read.

## Requirements (EARS)

- FR-001  WHEN test design is requested for a feature whose spec is `ready`, THE SYSTEM SHALL produce a
  test case for each acceptance criterion, including negative and edge-case criteria.
- FR-002  IF the spec is not `ready`, THEN THE SYSTEM SHALL stop and state that the spec must be ready
  first.
- FR-003  IF an acceptance criterion is too vague to test, THEN THE SYSTEM SHALL flag it by ID and SHALL
  NOT invent a case.
- FR-004  THE SYSTEM SHALL record for each case: a stable case ID, a short name, the story and FR IDs it
  covers, the expected outcome, and an automate-or-manual decision with a one-line reason.
- FR-005  WHERE a case is manual, THE SYSTEM SHALL record how it is verified and how its result is
  recorded.
- FR-006  THE SYSTEM SHALL mark every case automate by default, and manual only with a one-line reason
  from a short fixed list (needs human judgment, external system, visual check, one-off).
- FR-007  WHEN test design is checked, THE SYSTEM SHALL report every FR with no covering case that is not
  explicitly marked deliberately uncovered with a reason.
- FR-008  IF a case cites an ID that does not exist in the spec, THEN THE SYSTEM SHALL report it.
- FR-009  THE SYSTEM SHALL keep case IDs stable when other cases are added, changed or removed.
- FR-010  WHEN the tasks phase produces the task list, THE SYSTEM SHALL produce the test design in the
  same phase, before implementation starts, and SHALL restrict it to writing its own artifact.
- FR-011  IF a story's implementation finishes with no test design, THEN THE SYSTEM SHALL have QA note the
  absence rather than pass silently.
- FR-012  THE SYSTEM SHALL store the test design in a form that other tools can read without a model,
  listing each case with its covered IDs and decision. The design lives in a new per-feature file
  (`tests.md`) produced by the existing `/amby.tasks` phase; no new `/amby.*` command is added.
- FR-013  WHEN the spec changes, THE SYSTEM SHALL update or flag only the cases that cite the changed
  criteria, and flag, not delete, cases whose criteria were removed.
- FR-014  WHEN `converge` runs on a feature with test design, THE SYSTEM SHALL read the `trace` matrix
  first where spec 024 is present, then use the designed cases as the expected tests, and spend model
  effort only on what neither answers.
- FR-015  WHERE a feature has no test design, THE SYSTEM SHALL leave every existing phase's behavior
  unchanged and SHALL add at most a non-blocking note to `analyze`.
- FR-016  THE SYSTEM SHALL let a person skip test design for a feature explicitly and SHALL record the
  skip as a `tests.md` containing only a `skipped: <reason>` line.
- FR-017  THE test-design prompt and template SHALL be authored once in the neutral source and emitted
  per tool, and SHALL load only the artifacts a step needs by reference (Principles 1 and 3).

## Success criteria

- SC-001  On a ready spec, 100% of acceptance criteria have at least one case or a flag explaining why
  not.
- SC-002  Every FR in a designed feature is covered by a case or explicitly marked deliberately
  uncovered, verified without a model.
- SC-003  Changing one acceptance criterion changes or flags only the cases that cite it.
- SC-004  Existing features with no test design produce unchanged results from every existing command.
- SC-005  Every FR in this spec maps to at least one test (Principle 5), and `npm run typecheck` and
  `npm test` pass.
- SC-006  Feature 021 is itself built with test design produced before its code, with its own cases
  citing its FR IDs (the 1.5 gate, Principle 6).

## Edge cases

- A criterion that tests several behaviors at once: split into several cases, each citing it.
- One case covering several criteria or FRs.
- An FR that cannot be tested by a case (for example a documentation requirement): marked deliberately
  uncovered with a reason.
- A spec edited after test design: stale cases must be flagged rather than trusted.
- A feature with a very large number of criteria: output must stay reviewable per story.
- Test design requested for a feature still being specified, or already implemented.
- Two people or lanes editing the artifact at once: cases are added by ID and must merge cleanly.

## Assumptions

- Acceptance criteria are written in Given/When/Then and carry stable story and FR IDs, as in the
  current spec template.
- Spec 024 (`trace`) and spec 019 (`/amby.run`) land in the same or a later release; this feature is
  useful standalone without them.
- Actual test code is still written during implementation; this feature only designs the cases.
- The `converge` phase can read the artifact without a format change to existing specs.
