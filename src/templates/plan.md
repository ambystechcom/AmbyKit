---
feature: {{FEATURE_ID}}
status: draft
created: {{DATE}}
---

# Implementation Plan — {{FEATURE_TITLE}}

> The HOW. First artifact where technology appears. Must satisfy every `FR-###` in `@spec.md` and
> honor the `@../../.amby/constitution.md`. Reference spec/UI by ID — do not restate them.

## Technical context

- **Stack:** {{STACK}}
- **Key libraries:** {{LIBRARIES}}
- **Constraints driving choices:** {{CONSTRAINTS}}   # cite constitution principles by number

## Architecture

{{ARCHITECTURE_OVERVIEW}}
<!-- Components, boundaries, interactions. Diagrams welcome. -->

## Phased approach

- **Phase 0 — Research:** {{RESEARCH}}          → `research.md` (if needed)
- **Phase 1 — Foundation:** data model + contracts → `data-model.md`, `contracts/`
- **Phase 2+ — Features:** per user story, in priority/dependency order

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | {{APPROACH}} |
| US-1 | {{APPROACH}} |

## Risks & decisions

- {{DECISION_AND_RATIONALE}}
