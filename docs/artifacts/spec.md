# Artifact: `spec.md`

The specification defines **WHAT** to build and **WHY**, with no technology decisions. Produced by
`/amby.specify`, refined by `/amby.clarify`. One `spec.md` per feature under `specs/NNN-feature/`.

## Sections

1. **Metadata** — feature ID/slug, branch, status, created date.
2. **User Scenarios & Testing** — the user stories.
3. **Requirements** — EARS functional requirements.
4. **Success Criteria** — measurable, tech-agnostic outcomes.
5. **Edge Cases** and **Assumptions**.

## User stories

Each story is independently testable and prioritized:

```markdown
### US-1 — Reset password via email  (priority: P1)

As a registered user, I want to reset my password via an emailed one-time link,
so that I can regain access without contacting support.

- **Why P1:** account lockout is the top support driver.
- **Independent test:** can be demoed alone as a viable slice.
- **depends-on:** []          # e.g. [US-0] to block until a prerequisite ships
- **status:** draft            # draft | ready | in-progress | blocked | done

**Acceptance criteria**
- Given a registered email, When a reset is requested, Then a one-time link is sent within 30s.
- Given an expired link, When it is opened, Then the user is told it expired and offered a new one.
```

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
story → requirements → tasks and validates the `depends-on`/`blocked-by` graph.
