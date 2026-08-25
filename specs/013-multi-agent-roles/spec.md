---
feature: 013-multi-agent-roles
title: Multi-agent roles — PM, Architect, QA perspectives in the workflow
branch: 013-multi-agent-roles
status: ready
created: 2026-08-25
---

# Spec — Multi-agent roles — PM, Architect, QA perspectives in the workflow

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

## Problem

Every AmbyKit phase today is run by one undifferentiated assistant. A spec written and reviewed by
the same "voice" misses what a product manager, an architect, or a QA engineer would each catch;
BMAD-style frameworks show that distinct roles surface different defects. AmbyKit should let each
phase run **as a role** with a durable, project-tunable perspective, and let a *different* role
**review** an artifact before it is accepted — without duplicating prompts per tool (Principle 1) or
inflating tokens (Principle 3).

## User scenarios & testing

### US-1 — Phases run with a default role  (priority: P1)

As a developer, I want each workflow phase to adopt a named role (e.g. specify → PM, plan →
Architect, converge → QA), so that artifacts reflect that discipline's concerns without me
prompting for them.

- **Why this priority:** The core capability; everything else composes on top of it.
- **Independent test:** Run `/amby.specify` in a project with default roles; the output shows the
  role in use, and the spec's stories/requirements reflect PM concerns listed in the role definition
  (e.g. user value, scope boundaries, success metrics).
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a project with role definitions, When a phase runs, Then it states which role it is acting
  as and applies that role's focus checklist to its artifact.
- Given a project without role definitions, When a phase runs, Then behavior is unchanged from today.
- Given the default mapping, When phases run, Then specify/clarify/revise act as PM, design as UX
  Designer, plan as Architect, tasks as Tech Lead, implement as Developer, analyze/converge as QA.

### US-2 — Roles are defined once per project and editable  (priority: P1)

As a project maintainer, I want the roles to live as neutral, editable definitions in the project
(name, mission, focus checklist, hand-off expectations), so that I can tune them to my domain and
they reach every supported assistant from one source.

- **Why this priority:** Roles without a single source of truth would violate Principle 1.
- **Independent test:** Edit the QA role's checklist to add "accessibility"; after `ambykit sync`,
  every configured tool's emitted material reflects the edited checklist; `ambykit check` reports no
  drift.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given `ambykit init` (or `ambykit sync` on an existing project), When it runs, Then the default
  role definitions are installed write-if-absent and the project owns them.
- Given an edited role definition, When `ambykit sync` runs, Then every target's emitted material
  reflects the edit and no per-tool file needs hand editing.
- Given a role definition over 150 words, When `ambykit sync` runs, Then it warns naming the role
  and the count, and still emits it.

### US-3 — Cross-role review of an artifact  (priority: P2)

As a developer, I want to ask a *different* role to review an artifact (e.g. QA reviews the spec,
Architect reviews the tasks) and get findings tied to stable IDs, so that blind spots are caught
before the next phase consumes the artifact.

- **Why this priority:** This is where roles pay off, but it depends on US-1/US-2.
- **Independent test:** After `/amby.specify`, run a QA review of the spec; it returns a findings
  list keyed by `US-#`/`FR-###` (untestable requirement, missing negative case, …) and appends
  nothing to the artifact unless asked.
- **depends-on:** [US-1, US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given an artifact and a reviewing role, When the review runs, Then it produces findings each
  referencing a stable ID with severity and a one-line fix suggestion, and modifies no file.
- Given the user accepts findings, When they ask to apply them, Then the artifact is patched in
  place (existing IDs preserved) and the review is recorded in the artifact's sign-off block.
- Given a review with zero findings, When it finishes, Then it records approval by that role.
- Given no review has been run, When any phase runs, Then it proceeds — reviews are advisory, like
  `analyze`, never a blocking gate.

### US-4 — Override the role for one run  (priority: P2)

As a developer, I want to run any phase as a role of my choice for one invocation, so that I can
get an alternative perspective without changing project defaults.

- **Why this priority:** Cheap flexibility once US-1 exists.
- **Independent test:** Run the plan phase as QA; the output states "acting as QA" and the plan's
  risk section reflects QA concerns.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a role override, When the phase runs, Then it uses that role instead of the default and says so.
- Given an unknown role name, When the phase runs, Then it refuses and lists the defined roles.

### US-5 — Roles surface natively where the assistant supports personas  (priority: P3)

As a user of a tool that supports named sub-agents or personas, I want AmbyKit's roles emitted in
that tool's native form, so that I can address a role directly outside the phases.

- **Why this priority:** Nice-to-have; phases already carry the role. Native forms vary per tool.
- **Independent test:** For a tool with a documented persona/sub-agent format, `ambykit sync` emits
  one entry per role matching the compatibility matrix; tools without such a format emit nothing
  extra and lose no functionality.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a target with a verified persona/sub-agent format, When `ambykit sync` runs, Then one native
  entry per role is emitted and `ambykit check` covers it.
- Given a target without one, When `ambykit sync` runs, Then no extra file is written.
- Given the plan phase, When it selects targets for native emission, Then only formats recorded in
  `docs/tool-compatibility.md` from official docs qualify; any other target is out of scope for US-5.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL keep role definitions as neutral project files — one per role, with name,
  mission, focus checklist, and hand-off expectations — installed write-if-absent (Principle 1, 7).
- FR-002  THE SYSTEM SHALL ship six default roles: PM, UX Designer, Architect, Tech Lead, Developer,
  and QA, mapped to phases as in US-1.
- FR-003  THE SYSTEM SHALL map each phase to a default role; WHEN a phase runs, it SHALL load only
  that role's definition (Principle 3) and state the role in its output.
- FR-004  WHERE no role definitions exist in the project, THE SYSTEM SHALL run phases exactly as
  today.
- FR-005  WHEN a role override is given for a run, THE SYSTEM SHALL use it instead of the default;
  IF the role is unknown, THEN it SHALL refuse and list defined roles.
- FR-006  THE SYSTEM SHALL provide a review capability that takes an artifact and a reviewing role
  and returns findings keyed by stable ID (`US-#`, `FR-###`, `SC-###`, `T###`) with severity and a
  suggested fix, modifying no file.
- FR-007  WHEN the user asks to apply review findings, THE SYSTEM SHALL patch the artifact in place,
  preserving all existing IDs, and record the review (role, date, outcome) in the artifact.
- FR-008  THE SYSTEM SHALL record a zero-finding review as an approval by that role.
- FR-009  THE SYSTEM SHALL emit role material to every target from the single neutral source via
  the existing emitters; targets with a verified native persona format SHALL additionally receive
  one native entry per role, and unverified formats SHALL NOT be guessed (Principle 4).
- FR-010  THE SYSTEM SHALL ship default roles of at most 150 words each and SHALL warn at sync when
  a project role exceeds 150 words, without refusing it (Principle 3).
- FR-011  THE SYSTEM SHALL include role material in `ambykit check` drift detection and in the docs
  (workflow guide, CLI reference), passing the docs-sync checker.
- FR-012  THE SYSTEM SHALL NOT require multiple concurrent assistants; roles are perspectives a
  single assistant adopts, and SHALL also work when different assistants take different roles.

## Success criteria

- SC-001  Every phase output names its role; with roles removed, outputs are byte-for-byte identical
  in structure to pre-feature behavior (no regression).
- SC-002  A QA review of a deliberately flawed fixture spec (untestable FR, missing negative case,
  unmeasurable SC) reports all three seeded flaws by ID.
- SC-003  Editing one role file and running `ambykit sync` updates every configured target with no
  hand edits; `ambykit check` is clean.
- SC-004  Every shipped default role is ≤ 150 words; a 151-word fixture role produces exactly one
  sync warning.
- SC-005  Every functional requirement maps to an automated test where mechanical, or a documented
  manual fixture where model-executed; `npm test` passes.
- SC-006  Dogfood: this feature's own spec receives a QA role review before `plan` (and is developed
  in a worktree per feature 012, closing its T091).

## Edge cases

- Role file deleted after emission — `check` reports the missing source; `sync` re-installs the
  default and says so.
- Two roles with the same name (case variants) — refuse at sync with a clear message.
- Review requested on an artifact that doesn't exist yet — stop and name the phase to run first.
- Override role equals the default role — behaves as no override.
- Very long user-edited role — warn when it exceeds the size bound rather than silently loading it.

## Assumptions

- Roles are prompt-level perspectives, not separate processes; parallel multi-assistant execution
  is enabled by feature 012 worktrees but is out of scope here.
- Existing artifacts already carry sign-off blocks (design) or status fields (spec) that a review
  record can extend without changing their structure.
- The default role set is a starting point; teams edit it, so the defaults need not be exhaustive.
