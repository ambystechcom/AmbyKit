---
feature: {{FEATURE_ID}}          # NNN-slug
title: {{FEATURE_TITLE}}
branch: {{BRANCH}}
status: draft                     # draft | ready | in-progress | blocked | done
created: {{DATE}}
---

# Spec — {{FEATURE_TITLE}}

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

## User scenarios & testing

<!-- One block per story. Each story is independently testable and prioritized. -->

### US-1 — {{STORY_TITLE}}  (priority: P1)

As a {{ROLE}}, I want {{CAPABILITY}}, so that {{BENEFIT}}.

- **Why this priority:** {{WHY_PRIORITY}}
- **Independent test:** {{INDEPENDENT_TEST}}
- **depends-on:** []            # e.g. [US-0]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given {{CONTEXT}}, When {{ACTION}}, Then {{OUTCOME}}.
- Given {{CONTEXT}}, When {{ACTION}}, Then {{OUTCOME}}.

## Requirements (EARS)

<!-- Numbered, testable. Patterns: SHALL (ubiquitous), WHEN (event), WHILE (state), IF/THEN (unwanted), WHERE (optional). -->

- FR-001  WHEN {{TRIGGER}}, THE SYSTEM SHALL {{RESPONSE}}.
- FR-002  WHILE {{STATE}}, THE SYSTEM SHALL {{RESPONSE}}.
- FR-003  IF {{CONDITION}}, THEN THE SYSTEM SHALL {{RESPONSE}}.

## Success criteria

<!-- Measurable and tech-agnostic. -->

- SC-001  {{MEASURABLE_OUTCOME}}.
- SC-002  {{MEASURABLE_OUTCOME}}.

## Edge cases

- {{EDGE_CASE}}

## Assumptions

- {{ASSUMPTION}}
