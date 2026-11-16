---
feature: 026-spec-format-v2-spike          # NNN-slug
title: Spec format v2 spike
branch: 026-spec-format-v2-spike
status: ready                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — Spec format v2 spike

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

This is a **time-boxed spike**, not a product feature. It exists to answer one question before the
plugin API (027) and the headless runner (028) are built, so they target the final shape of specs.

**The question:** how should specs and task lists carry the data that tools read — story and feature
metadata, dependencies, and per-task file ownership and verification — so that `dashboard`, `analyze`
and later consumers stop pattern-matching markdown?

**Already decided (the spike tests it, not reopens it):** feature and story metadata (ids, status,
depends-on) go in frontmatter; fenced YAML blocks carry only per-task data (file ownership, verify).
Frontmatter alone cannot hold per-task ownership, and blocks alone bury feature metadata. The prose
stays human-first and keeps its role.

**Timebox:** 5 working days. Owner: named at kickoff. The spike must finish before 1.6 work on `run`
and the plugin API starts.

**Deliverable:** a written decision plus prototype findings. The full feature work belongs to spec 030
(spec format v2 and `migrate`) and the freeze of the plugin API to spec 027. No production code from the
spike ships.

**Out of scope:** shipping v2 to users, dropping 1.x reading (2.1), config v2 and the Node 22 bump
(030), and any change to the plugin API itself.

## User scenarios & testing

### US-1 — Prove both formats can be read side by side  (priority: P1)

As a maintainer, I want a prototype that parses today's markdown format and the proposed v2 format into
the same model, so that I know the dashboard and analyzer can read both during the transition.

- **Why this priority:** the main risk is breaking the dashboard and analyzer; 1.x must stay readable
  until 2.1.
- **Independent test:** run the prototype parser on a 1.x spec and its v2 equivalent and confirm
  identical stories, statuses, dependencies and task ownership.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a 1.x spec and tasks file, When the prototype reads it, Then it produces the model that
  `dashboard` and `analyze` use today.
- Given the same content in v2, When the prototype reads it, Then it produces an identical model.
- Given a file in neither format or malformed v2 data, When read, Then the prototype reports the problem
  by location instead of guessing.
- Given a mixed feature (spec in 1.x, tasks in v2 or the reverse), When read, Then the result states
  which parts used which format.

### US-2 — Prove migration is safe  (priority: P1)

As a maintainer, I want a prototype `migrate` that converts specs in place, is repeatable and can be
previewed, so that real migration in 2.0 carries little risk.

- **Why this priority:** if migration cannot be made idempotent and reviewable, the 2.0 plan changes.
- **Independent test:** run the prototype with `--dry-run` on AmbyKit's own specs and confirm a diff
  summary and no file changes; run it twice for real and confirm the second run changes nothing.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given AmbyKit's own `specs/`, When the prototype runs with `--dry-run`, Then it prints a diff summary
  and writes nothing.
- Given the same input, When it runs for real, Then each spec converts and the human-written prose is
  preserved.
- Given an already-converted spec, When it runs again, Then nothing changes.
- Given a spec it cannot convert safely, When it runs, Then that spec is left untouched and listed.
- Given a converted spec, When the 1.x reader is run on it, Then the outcome is stated: readable, or
  readable only with the new reader.

### US-3 — Measure token and readability cost  (priority: P2)

As a maintainer, I want the effect of v2 on tokens and readability measured, so that a format meant to
help machines does not cost assistants or people more to read (Principle 3).

- **Why this priority:** the format must not undo AmbyKit's token frugality, but it does not block the
  parse and migrate answers.
- **Independent test:** compare the token count of a sample spec and tasks file in each format and
  record a short readability judgment.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a sample of existing specs, When both formats are measured, Then the token difference per file
  is recorded.
- Given the v2 sample, When a person reads it, Then a short note records whether the prose stayed
  readable and where the structured data hurt.
- Given an assistant reading only the data it needs, When v2 is used, Then the note says whether it can
  load less than in 1.x.

### US-4 — Deliver a decision others can build on  (priority: P1)

As the owner of specs 027 and 030, I want a written decision with evidence, so that the plugin API and
spec v2 target the final shape and nothing is frozen too early.

- **Why this priority:** the spike has no value unless it ends in a decision.
- **Independent test:** read the decision and confirm it states the chosen format, the open risks and
  what 027 and 030 may now assume.
- **depends-on:** [US-1, US-2, US-3]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the spike is complete, When the decision is read, Then it states the format to adopt, or a
  different recommendation with reasons.
- Given the findings, When the decision is read, Then it lists risks to the dashboard, analyzer and
  plugin API and says how each is covered.
- Given the decision, When specs 027 and 030 are written, Then each can cite it by ID.
- Given the spike overruns its timebox, When that happens, Then the partial findings and the unanswered
  questions are written up and a person decides whether to extend.

## Requirements (EARS)

- FR-001  THE SPIKE SHALL record the decision it was asked to make: how machine-read data is carried in
  specs and task lists in v2.
- FR-002  THE SPIKE SHALL test the decided split: frontmatter for feature and story metadata (ids,
  status, depends-on) and fenced YAML blocks only for per-task file ownership and verify data.
- FR-003  THE SPIKE SHALL build a prototype reader that parses the 1.x format and the v2 format into one
  model and SHALL compare it with what `dashboard` and `analyze` use today.
- FR-004  IF input is malformed or in neither format, THEN THE PROTOTYPE SHALL report the problem by
  location and SHALL NOT guess.
- FR-005  THE SPIKE SHALL build a prototype `migrate` with a dry-run mode that prints a diff summary
  and writes nothing.
- FR-006  WHEN the prototype `migrate` runs twice on the same input, THE PROTOTYPE SHALL change nothing
  on the second run.
- FR-007  IF the prototype cannot convert a spec safely, THEN IT SHALL leave it untouched and list it.
- FR-008  THE SPIKE SHALL run the prototype on AmbyKit's own specs.
- FR-009  THE SPIKE SHALL record, for a sample of specs, the token difference between formats and a
  short readability judgment (Principle 3).
- FR-010  THE SPIKE SHALL state whether the 1.x reader can still read converted files.
- FR-011  WHEN the spike ends, THE SYSTEM SHALL have a written decision with prototype findings, risks
  and what specs 027 and 030 may assume.
- FR-012  THE SPIKE SHALL NOT change the plugin API, ship v2 to users or alter any shipped command's
  output.
- FR-013  IF the timebox is exceeded, THEN THE SPIKE SHALL stop, write up partial findings and unanswered
  questions, and ask a person whether to extend.
- FR-014  THE SPIKE SHALL keep prototype code out of the shipped package unless a later spec adopts
  it.

## Success criteria

- SC-001  The prototype reader produces an identical model from every one of AmbyKit's own specs in 1.x
  and in v2, or lists each difference.
- SC-002  The prototype `migrate` converts every spec it can with prose preserved, and a second run
  produces no change.
- SC-003  The token difference per file between formats is recorded for a sample of at least three
  specs.
- SC-004  The decision is written within the timebox and lets specs 027 and 030 start without asking
  what v2 looks like.
- SC-005  No shipped command's output changes because of the spike.
- SC-006  Every FR maps to a verification step (Principle 5), and the spike's own artifacts follow the
  workflow (Principle 6).

## Edge cases

- A spec with no frontmatter today, or with hand-edited metadata.
- A task line whose file ownership contains unusual characters.
- A story that depends on a story in another feature (`NNN:US-#`).
- A spec using `[NEEDS CLARIFICATION]` markers or a status that v2 does not list.
- Windows line endings and non-ASCII markers.
- A spec edited by hand while a migration runs.
- Tooling that reads specs outside AmbyKit, such as assistants reading raw markdown.

## Assumptions

- The roadmap decisions on frontmatter plus fenced blocks stand; the spike tests them rather than
  choosing between alternatives.
- AmbyKit's own specs are the representative sample; no external project data is used.
- The 1.x reader keeps working until 2.1, per the roadmap.
- Specs 027 (plugin API) and 030 (spec v2 and `migrate`) will cite this decision.
- No new runtime dependency is introduced by the spike without a recorded reason.
