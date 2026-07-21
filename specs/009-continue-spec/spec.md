---
feature: 009-continue-spec
title: Continue / edit an existing feature's spec & design (with a done-guard)
branch: 009-continue-spec
status: ready
created: 2026-07-20
---

# Spec — Continue / edit an existing feature's spec & design (with a done-guard)

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Today the workflow can **start** a spec (`/amby.specify` — creates a new feature) and **resolve open
questions** (`/amby.clarify` — edits only `[NEEDS CLARIFICATION]` markers), but there is no supported
way to **keep specifying** an existing feature: add user stories, grow requirements, or refine an
in-progress spec across sessions. Authors are forced to hand-edit or start over. This feature adds a
command that continues an existing feature's spec in place, refuses to reopen work that is already
`done` (directing the author to create a new spec instead), and ensures the progress view reflects the
resulting in-progress/done state. Honors Principle 3 (patch in place, don't regenerate) and
Principle 1 (author the prompt once, emit per tool).

## User scenarios & testing

<!-- One block per story. Each story is independently testable and prioritized. -->

### US-1 — Continue an existing feature's spec  (priority: P1)

As a spec author, I want a command that resumes and extends an existing feature's spec — adding user
stories and requirements and refining them in place — so that I can keep specifying a feature over
multiple sessions without starting over or hand-editing.

- **Why this priority:** The core capability requested. Today `specify` only creates a new feature and
  `clarify` only touches markers, leaving no supported path to grow an existing spec.
- **Independent test:** On a feature with an existing `draft` spec, run the command with new intent;
  assert new stories/requirements appear with next-in-sequence IDs and every existing ID and its text
  is unchanged.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature with a `draft`/`in-progress` spec, When I run the continue command with additional
  intent, Then the spec gains the new stories/requirements while all existing IDs and text are preserved.
- Given the command writes, When it edits the spec, Then it patches in place (no full regeneration),
  per Principle 3.
- Given the new items, When they are added, Then they use EARS for requirements and Given/When/Then for
  acceptance criteria, consistent with `specify`.

### US-2 — Redirect to a new spec when the target is done  (priority: P1)

As a spec author, I want the continue command to refuse to reopen a feature that is already `done` and
instead point me to create a new spec, so that completed work is never silently reopened.

- **Why this priority:** Explicitly requested guard; protects finished work from accidental edits.
- **Independent test:** On a feature whose spec status is `done`, run the command; assert no changes
  are written and the author is told to run the specify command for a new feature.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature marked `done`, When I run the continue command, Then no edits are written and I am
  directed to `/amby.specify` a new feature.
- Given a feature that is `draft`/`in-progress`, When I run the continue command, Then it proceeds
  (US-1) instead of redirecting.
- Given continuation proceeds, When the spec is updated, Then its working status reflects active work.
- Given a `draft`/`in-progress` feature that contains some `done` stories, When I continue it, Then new
  stories may be added but the individual `done` stories are left untouched.

### US-3 — Progress view reflects continued vs done state  (priority: P2)

As a spec author, I want the `ambykit dashboard` progress view to accurately show a feature/story as
in-progress vs done, so that continuing a spec is visible and I can see what is still open.

- **Why this priority:** Ensures the continue action is observable; may already be satisfied by the
  existing dashboard, so it is an enhancement/verification rather than the core fix.
- **Independent test:** Continue a spec so its status becomes in-progress; run `ambykit dashboard`;
  assert the feature/story is reported in-progress (not done).
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a spec whose status changed to in-progress via a continue, When I run the dashboard, Then it
  shows in-progress for that feature/story.
- Given a `done` feature, When I run the dashboard, Then it still shows done (the continue command did
  not alter it). The spec requires only this outcome; whether the dashboard needs a code change to
  achieve it is decided during planning.

### US-4 — Continue the feature's UI/design too  (priority: P3)

As a designer, I want the **same `/amby.revise` command** to also continue a feature's UI/design
artifact, so that I can extend the design over time rather than regenerating it.

- **Why this priority:** The request names "design/specification"; design continuation is in scope but
  secondary to the spec-continuation core.
- **Independent test:** On a feature with an existing `ui.md`, run the continue-design path; assert the
  design gains new content in place while existing sections are preserved.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature with an existing design artifact, When I run `/amby.revise` to continue its design,
  Then new content is added in place and existing content is preserved.
- Given a feature with no `ui.md` yet, When I continue its design, Then the command guides me to run
  the design phase rather than editing a nonexistent artifact.

## Requirements (EARS)

<!-- Numbered, testable. Patterns: SHALL (ubiquitous), WHEN (event), WHILE (state), IF/THEN (unwanted), WHERE (optional). -->

- FR-001  THE SYSTEM SHALL provide a workflow command `/amby.revise` that continues an existing
  feature's spec — adding and refining user stories, requirements, and criteria — without regenerating it.
- FR-002  WHEN continuing a spec, THE SYSTEM SHALL preserve every existing stable ID (`US-#`, `FR-###`,
  `SC-###`) and its text, and SHALL assign the next available number to each newly added item.
- FR-003  IF the feature's `spec.md` status is `done`, THEN THE SYSTEM SHALL make no edits and SHALL
  direct the author to create a new spec via the specify command.
- FR-004  WHEN continuing a `draft`/`in-progress` feature, THE SYSTEM SHALL set the feature's `spec.md`
  status to `in-progress`, and SHALL leave any individual `done` stories (`US-#`) unchanged while
  allowing new stories to be added.
- FR-005  THE SYSTEM SHALL reflect the resulting in-progress/done status in the `ambykit dashboard`
  progress view; whether this requires a dashboard code change is determined during planning.
- FR-006  THE SYSTEM SHALL make the new command available for every configured tool via the
  author-once / emit-per-tool pipeline, so it appears alongside the other `/amby.*` commands
  (Principle 1); it must remain in sync after `ambykit sync` (Principle 6).
- FR-007  IF the specified feature cannot be found, THEN THE SYSTEM SHALL report a clear error and make
  no changes.
- FR-008  THE SYSTEM SHALL keep this command distinct from `clarify` (which resolves only
  `[NEEDS CLARIFICATION]` markers) and from `specify` (which creates a new feature).
- FR-009  THE SYSTEM SHALL, via the same `/amby.revise` command, continue/edit the feature's UI/design
  artifact in place; IF no `ui.md` exists, THEN it SHALL direct the author to the design phase rather
  than editing a nonexistent artifact.

## Success criteria

<!-- Measurable and tech-agnostic. -->

- SC-001  Continuing a spec preserves 100% of pre-existing content and stable IDs; only additions and
  intended refinements appear in the diff.
- SC-002  No feature/story marked `done` is modified by the continue command; in 100% of `done` cases
  the author is redirected to create a new spec.
- SC-003  After a continue, the dashboard reports the correct in-progress/done status with zero
  mismatches against the artifacts.
- SC-004  After `ambykit sync`, the new command is present in every configured tool's command surface.

## Edge cases

- The feature directory exists but has no `spec.md` yet — continue vs behave like `specify`?
- Status conflict: `spec.md` status is `done` but some stories are `draft` (or the reverse).
- Unresolved `[NEEDS CLARIFICATION]` markers are present when continuing — interaction with `clarify`.
- Continuing renames/renumbers IDs that `plan.md`/`tasks.md` already reference (downstream drift —
  `analyze` should surface it).
- Continuing design when no `ui.md` exists yet.
- A feature whose spec is `ready`/`blocked` (neither clearly in-progress nor done).

## Assumptions

- The command is a new **neutral prompt** authored in the workflow source and emitted per tool
  (dogfooding, Principle 1/6) — not a hand-maintained per-tool file.
- "Continue" targets an existing feature directory under `specs/NNN-slug/`.
- Status vocabulary is the existing spec/story set: `draft | ready | in-progress | blocked | done`.
- Any CLI/dashboard change needed for FR-005 is a `BaseCommand`/core change, not duplicated logic
  (Principle 2); it may turn out no change is needed.
