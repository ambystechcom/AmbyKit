---
feature: {{FEATURE_ID}}
created: {{DATE}}
---

# Tasks — {{FEATURE_TITLE}}

> Line format: `- [ ] [T###] [P?] [US#] description (file/path, other/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Paths: repo-relative, comma-separated, dirs end `/`, no globs. `[P]` tasks in a phase must not share or nest paths.
> Gate: no user-story task starts until Foundational completes.
> Markers go last on the task line, after the path group: `⚠ BLOCKED: <reason>` for a task that cannot proceed, `↪ DEVIATION: <note>` for a change from the plan. The glyph is optional (`BLOCKED:` works too); remove `⚠ BLOCKED:` when resolved.
> Each phase ends with one `**Verify:** <check>` line, run before the checkpoint. Record the result as a suffix on that line: `✓ passed`, `✗ failed: <why>` or `? unverified` (the words alone also work); a later run overwrites it.

## Phase 1 — Setup

- [ ] [T001] {{SETUP_TASK}} ({{PATH}})
- **Verify:** {{VERIFY_CHECK}}

## Phase 2 — Foundational  (blocks all feature work)

- [ ] [T010] {{FOUNDATIONAL_TASK}} ({{PATH}})
- **Verify:** {{VERIFY_CHECK}}

## Phase 3 — User story US-1  (priority: P1)

- [ ] [T020] [P] [US1] {{TASK}} ({{PATH}})
- [ ] [T021] [US1] {{TASK}} ({{PATH}})
- **Checkpoint:** US-1 is demoable.
- **Verify:** {{VERIFY_CHECK}}

## Phase 4 — Polish

- [ ] [T090] {{POLISH_TASK}} ({{PATH}})
- **Verify:** {{VERIFY_CHECK}}
