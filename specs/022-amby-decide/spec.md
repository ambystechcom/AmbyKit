---
feature: 022-amby-decide          # NNN-slug
title: Decision records (amby.decide)
branch: 022-amby-decide
status: done                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — Decision records (amby.decide)

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Durable decisions made while specifying, planning or building (for example "use files, not a database,
for run state") are today buried in chat, in one feature's plan, or in nobody's memory, so a later
feature repeats the debate or contradicts them. This feature adds `/amby.decide`: a short, numbered
**decision record** (ADR) written once, stored in the project, and referenced by ID (`ADR-###`) from any
phase instead of restated (Principle 3). It also adds a **security reviewer role** for
`/amby.review --as security`.

The constitution keeps the project's durable principles; a decision record keeps one decision with its
context and consequences, and can be superseded by a later one. Idea taken from a delivery-pipeline
framework; no proprietary content is reused.

**Out of scope:** enforcing decisions automatically, discovering standards from an existing codebase,
a web UI, and a decision database. Depends on nothing; the security role relies on the existing
`/amby.review` and role files.

## User scenarios & testing

### US-1 — Record a decision  (priority: P1)

As a developer, I want to record a decision in one short, numbered record, so that the choice and its
reasons survive the chat that produced it.

- **Why this priority:** this is the core capability; everything else reads or refines records.
- **Independent test:** invoke `/amby.decide` with a decision and confirm a new numbered record exists
  with the decision, its context and its consequences.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a decision stated by a person, When `/amby.decide` runs, Then a new record is created with the
  next free `ADR-###` number and a title.
- Given a new record, When it is read, Then it states the decision, why it was made, the alternatives
  considered, and the consequences, plus its status (proposed, accepted, superseded or deprecated),
  date, and optional feature and principle.
- Given no decision text is given, When `/amby.decide` runs, Then it asks what was decided and does not
  invent one.
- Given a decision that duplicates an existing record, When `/amby.decide` runs, Then it points to the
  existing ID instead of creating a second record.
- Given two records created at the same time on different branches, When they are merged, Then the
  numbering collision is detected rather than silently overwriting one.

### US-2 — Reference decisions by ID  (priority: P1)

As a developer or assistant, I want to cite a decision by its ID, so that phases refer to it instead of
restating it and later readers can find it.

- **Why this priority:** stable-ID reference is what keeps prompts small and decisions consistent
  (Principle 3).
- **Independent test:** cite `ADR-001` from a plan and confirm the ID resolves to exactly one record.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a record, When another artifact cites its ID, Then the ID resolves to that record only, and the
  ID is never reused or renumbered.
- Given a cited ID that does not exist, When artifacts are checked, Then it is reported.
- Given a project with many records, When someone looks for a decision, Then a short index of IDs,
  titles and statuses lets them find it without reading every record.

### US-3 — Call it from any phase and load only what is needed  (priority: P1)

As a developer, I want to record or consult decisions from any phase, with phases loading only the
records that matter, so that decisions are captured when made without inflating every prompt.

- **Why this priority:** the value is capturing decisions at the moment they are made, in any phase.
- **Independent test:** run `/amby.decide` from within a plan session and confirm the record is created
  and the plan cites it; confirm an unrelated phase does not load unrelated records.
- **depends-on:** [US-1, US-2]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given any phase (specify, plan, tasks, implement or others), When a decision is made, Then
  `/amby.decide` can be invoked from it and the phase can cite the new ID.
- Given a phase that needs prior decisions, When it starts, Then it loads the records cited by ID in the
  feature's artifacts and reads the short index to spot others, and does not load all records.
- Given a project with no decisions, When any phase runs, Then behavior is as today.

### US-4 — Supersede or amend a decision  (priority: P2)

As a developer, I want to replace an old decision with a new one and keep the history, so that stale
decisions are not followed and the reasons for the change are visible.

- **Why this priority:** decisions change; without this, records go stale and mislead.
- **Independent test:** supersede `ADR-001` with a new record and confirm both resolve, the old one is
  marked superseded, and the new one points back to it.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given an accepted record, When a new record supersedes it, Then the old record is marked superseded
  with a pointer to the new ID, and the new record names the one it replaces.
- Given a superseded record, When it is read, Then it is still available as history and is clearly not
  current.
- Given a record is superseded by another that is itself superseded, When the chain is followed, Then it
  leads to the current record.
- Given an accepted record that is retired with no replacement, When it is marked deprecated, Then it
  stays readable as history and is clearly not current.
- Given a person changes a record's wording only, When they edit it, Then its ID and status are kept.

### US-5 — Tie decisions to features and principles  (priority: P2)

As a team lead, I want a decision to say which feature raised it and which constitution principle it
touches, so that decisions can be traced to their origin and checked against the constitution.

- **Why this priority:** it improves traceability, but records are useful without it.
- **Independent test:** record a decision from a feature and confirm the record names the feature, and
  optionally a principle number.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a decision made during a feature's work, When it is recorded, Then the record names that
  feature.
- Given a decision that relates to a constitution principle, When it is recorded, Then it can cite the
  principle by number.
- Given a decision that conflicts with a principle, When it is recorded, Then the record stays
  `proposed` and is flagged for a person, and it cannot become `accepted` until the constitution is
  amended or the decision changed.
- Given a decision that spans several features, When it is recorded, Then it is not tied to any single
  feature and says so.

### US-6 — Review from a security perspective  (priority: P3)

As a developer, I want to review an artifact as a security reviewer, so that security concerns are
raised by ID before code is written.

- **Why this priority:** a small add-on that reuses the existing review mechanism.
- **Independent test:** run `/amby.review --as security` on a spec and confirm findings come back by ID,
  advisory only.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given `/amby.review --as security`, When it runs on an artifact, Then it reviews from a security
  perspective and reports findings by stable ID, advisory only.
- Given the security role, When it runs, Then it is read-only and makes no edits.
- Given a security finding that implies a durable decision, When it is raised, Then it may point to
  recording an ADR but does not create one itself.
- Given the role file is missing, When `--as security` is used, Then the existing behavior applies:
  stop and list the available roles.

### US-7 — Adopt without disturbing existing projects  (priority: P1)

As a maintainer of existing AmbyKit projects, I want decision records to be optional and additive, so
that upgrading to 1.5 needs no migration.

- **Why this priority:** 1.x must stay additive (breaking changes belong to 2.0).
- **Independent test:** run every existing command on a project with no `.amby/decisions/` and confirm
  unchanged behavior.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a project with no decision records, When any existing command runs, Then its behavior and
  output are unchanged.
- Given `ambykit sync`, When it runs on a project, Then it emits `/amby.decide` and the security role
  like any other command and role, and a second run produces no diff.
- Given a project with records, When `ambykit analyze` runs, Then at most it reports cited IDs that do
  not exist.

## Requirements (EARS)

- FR-001  WHEN `/amby.decide` is invoked with a decision, THE SYSTEM SHALL create a record with the next
  free `ADR-###` ID and a title in `.amby/decisions/`.
- FR-002  THE SYSTEM SHALL write each record with the decision, the reasons, the alternatives
  considered, the consequences, a date and a status of proposed, accepted, superseded or deprecated,
  plus an optional feature and principle.
- FR-003  IF no decision text is given, THEN THE SYSTEM SHALL ask what was decided and SHALL NOT invent
  one.
- FR-004  IF a decision duplicates an existing record, THEN THE SYSTEM SHALL point to the existing ID
  instead of creating another.
- FR-005  THE SYSTEM SHALL keep each ID unique, never reuse or renumber it, and detect numbering
  collisions when records created on different branches meet.
- FR-006  THE SYSTEM SHALL provide a short index of record IDs, titles and statuses.
- FR-007  IF an artifact cites an `ADR-###` that does not exist, THEN THE SYSTEM SHALL report it.
- FR-008  THE SYSTEM SHALL allow `/amby.decide` to be invoked from any phase and let that phase cite the
  new ID.
- FR-009  WHEN a phase needs prior decisions, THE SYSTEM SHALL load the records cited by ID in the
  feature's artifacts and the short index, and SHALL NOT load the whole set.
- FR-010  WHEN a record supersedes another, THE SYSTEM SHALL mark the old one superseded with a pointer
  to the new ID, record the replaced ID in the new one, and keep the old one readable as history.
- FR-011  WHEN a person edits only the wording of a record, THE SYSTEM SHALL keep its ID and status.
- FR-012  WHEN a decision is recorded during a feature's work, THE SYSTEM SHALL record that feature, and
  WHERE the decision relates to a constitution principle, SHALL allow citing it by number.
- FR-013  IF a decision conflicts with a constitution principle, THEN THE SYSTEM SHALL keep it
  `proposed`, flag it for a person, and NOT mark it `accepted` until the constitution is amended or the
  decision changed.
- FR-014  THE SYSTEM SHALL provide a security reviewer role invokable as `/amby.review --as security`,
  read-only and advisory, reporting findings by stable ID.
- FR-015  WHERE a project has no decision records, THE SYSTEM SHALL leave the output of the existing commands that
  read project state (`analyze`, `dashboard`, `check`) unchanged, as shown by unchanged-output tests on a project
  without `.amby/decisions/`.
- FR-016  THE SYSTEM SHALL emit `/amby.decide` and the security role per tool from the neutral source,
  and a repeated `ambykit sync` SHALL produce no diff (Principles 1 and 6).
- FR-017  THE decision-record prompt and template SHALL be short and SHALL load only the artifacts a
  step needs by reference (Principle 3).

## Success criteria

- SC-001  A decision can be recorded and cited by ID from another phase in a single invocation, with the
  record readable in under one screen.
- SC-002  Every cited `ADR-###` in a project's artifacts resolves to exactly one record, verified without
  a model.
- SC-003  A superseded decision is never presented as current, and following the supersede chain from
  any record reaches the current one.
- SC-004  A project with no decision records produces unchanged output from `analyze`, `dashboard` and `check`,
  shown by tests on a fixture project without `.amby/decisions/`.
- SC-005  Every FR maps to at least one test (Principle 5), and `npm run typecheck` and `npm test`
  pass.
- SC-006  Feature 022 is itself built with its own decisions recorded as ADRs for its design choices
  (the 1.5 gate, Principle 6).

## Edge cases

- Two records numbered the same after merging branches.
- A record deleted by hand: its ID must not be reused.
- A decision revisited and reversed repeatedly.
- A decision that applies to part of the codebase only.
- An ADR citing another ADR that does not exist or is superseded.
- A very long record, or a project with hundreds of records: only the index and cited records are loaded.
- A record edited by two lanes at once.
- Security finding that conflicts with an accepted decision.

## Assumptions

- `.amby/decisions/` is the home for records and `ADR-###` the ID form, as in the roadmap.
- Roles are files in `.amby/roles/<id>.md` and `/amby.review --as <id>` already works for them.
- Recording a decision is a person's or assistant's act in conversation; nothing records one
  automatically.
- The constitution remains the place for cross-feature principles; records do not replace it.
