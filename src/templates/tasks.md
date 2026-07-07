---
feature: {{FEATURE_ID}}
created: {{DATE}}
---

# Tasks — {{FEATURE_TITLE}}

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.

## Phase 1 — Setup

- [ ] [T001] {{SETUP_TASK}} ({{PATH}})

## Phase 2 — Foundational  (blocks all feature work)

- [ ] [T010] {{FOUNDATIONAL_TASK}} ({{PATH}})

## Phase 3 — User story US-1  (priority: P1)

- [ ] [T020] [P] [US1] {{TASK}} ({{PATH}})
- [ ] [T021] [US1] {{TASK}} ({{PATH}})
- **Checkpoint:** US-1 is demoable.

## Phase 4 — Polish

- [ ] [T090] {{POLISH_TASK}} ({{PATH}})
