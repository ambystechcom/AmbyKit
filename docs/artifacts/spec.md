# Artifact: `spec.md`

The specification defines **WHAT** to build and **WHY**, with no technology decisions. Produced by
`/amby.specify`, refined by `/amby.clarify`. One `spec.md` per feature under `specs/NNN-feature/`.

## Sections

1. **Metadata and story data** — feature ID/slug, branch, status, created date, and the `stories:` list (priority, status, dependencies).
2. **User Scenarios & Testing** — the user stories.
3. **Requirements** — EARS functional requirements.
4. **Success Criteria** — measurable, tech-agnostic outcomes.
5. **Edge Cases** and **Assumptions**.

## User stories

Each story is independently testable and prioritized. A spec's **story data** (priority, status and
dependencies) lives in the **frontmatter** `stories:` list; the heading carries the title only and the
prose stays prose:

```markdown
---
format: 2
feature: 007-reset-password
status: in-progress
stories:
  - id: US-1
    priority: P1
    status: draft            # draft | ready | in-progress | blocked | done
    depends-on: []           # e.g. [US-0, "019:US-1"] to wait for a story in this or another feature
    blocked-by: []
---

### US-1 — Reset password via email

As a registered user, I want to reset my password via an emailed one-time link,
so that I can regain access without contacting support.

- **Why P1:** account lockout is the top support driver.
- **Independent test:** can be demoed alone as a viable slice.

**Acceptance criteria**
- Given a registered email, When a reset is requested, Then a one-time link is sent within 30s.
- Given an expired link, When it is opened, Then the user is told it expired and offered a new one.
```

- `format: 2` marks the file as v2. A story entry needs an `id` that matches a `### US-#` heading; `priority`,
  `status`, `depends-on` and `blocked-by` are optional. `status` is any string, with the five values above
  canonical (another value is read as written and warned about).
- Change a story's status with `ambykit edit status <feature> US-# <status>`; do not edit the YAML by hand. A
  mistake in the frontmatter is reported with its file and line by `ambykit analyze`, never guessed around.
- A feature can also declare whole-feature dependencies, `depends-on: [019, 023-dependency-graph]`, in the
  frontmatter. They show as declared edges in `ambykit graph`, and a name that matches no feature is reported.
- When the frontmatter and a leftover 1.x bullet disagree, the frontmatter wins and a warning says so.

### Specs written before 2.0

A 1.x spec keeps its story data as bullets under each heading (`- **depends-on:** …`, `- **status:** …`) and the
priority as `(priority: P1)` in the heading. 2.x reads it exactly as before until 2.1, with one warning per run;
`ambykit migrate` moves the data into the frontmatter without touching the prose. See
[Migrating to the v2 spec format](../migration.md).

## Functional requirements (EARS)

Numbered `FR-###`, using [EARS](https://alistairmavin.com/ears/) patterns — unambiguous and directly
testable:

```markdown
- FR-001  WHEN a reset is requested for a known email, THE SYSTEM SHALL send a one-time link.
- FR-002  WHILE a reset link is unused and unexpired, THE SYSTEM SHALL accept it exactly once.
- FR-003  IF a reset link is older than 15 minutes, THEN THE SYSTEM SHALL reject it.
- FR-004  WHERE email delivery is configured, THE SYSTEM SHALL record a delivery audit entry.
```

EARS keywords: **ubiquitous** (SHALL), **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behavior), **WHERE** (optional feature).

## Success criteria

```markdown
- SC-001  95% of reset emails are delivered within 30 seconds.
- SC-002  Password reset completion rate ≥ 80% for users who start it.
```

## Ambiguity markers

Unknowns are flagged inline, never guessed:

```markdown
- FR-005  THE SYSTEM SHALL lock the account after [NEEDS CLARIFICATION: how many?] failed attempts.
```

`/amby.clarify` walks these, asks you, and edits only those lines.

## IDs & traceability

Stable IDs (`US-#`, `FR-###`, `SC-###`) let downstream artifacts reference the spec instead of
restating it. `tasks.md` tags each task with its `[US#]`; `analyze` builds a traceability view
story → requirements → tasks and validates the `depends-on`/`blocked-by` graph. Requirement IDs stay in the
prose: `ambykit trace` reads them from the `FR-###` lines, not from the frontmatter.
