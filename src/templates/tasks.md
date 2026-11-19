---
format: 2
feature: {{FEATURE_ID}}
created: {{DATE}}
---

# Tasks — {{FEATURE_TITLE}}

> Line format: `- [ ] [T###] [P?] [US#] description`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Each phase ends with one `yaml` block: `files:` maps each `T###` to its repo-relative paths (dirs end `/`, no globs; `[P]` tasks in a phase must not share or nest paths) and `verify:` holds the phase's `check:`. Change them with `ambykit edit files|verify`, never by hand.
> Gate: no user-story task starts until Foundational completes.
> Markers go last on the task line: `⚠ BLOCKED: <reason>` for a task that cannot proceed, `↪ DEVIATION: <note>` for a change from the plan. The glyph is optional (`BLOCKED:` works too); remove `⚠ BLOCKED:` when resolved.
> Run the phase's `check:` before the checkpoint, then record it: `ambykit edit verify <feature> <phase> --result=passed|failed|unverified [--why=<why>]` (shown as `✓ passed`, `✗ failed: <why>` or `? unverified`); a later run overwrites it.

## Phase 1 — Setup

- [ ] [T001] {{SETUP_TASK}}
```yaml
files:
  T001: ["{{PATH}}"]
verify:
  check: "{{VERIFY_CHECK}}"
```

## Phase 2 — Foundational  (blocks all feature work)

- [ ] [T010] {{FOUNDATIONAL_TASK}}
```yaml
files:
  T010: ["{{PATH}}"]
verify:
  check: "{{VERIFY_CHECK}}"
```

## Phase 3 — User story US-1  (priority: P1)

- [ ] [T020] [P] [US1] {{TASK}}
- [ ] [T021] [US1] {{TASK}}
- **Checkpoint:** US-1 is demoable.
```yaml
files:
  T020: ["{{PATH}}"]
  T021: ["{{PATH}}"]
verify:
  check: "{{VERIFY_CHECK}}"
```

## Phase 4 — Polish

- [ ] [T090] {{POLISH_TASK}}
```yaml
files:
  T090: ["{{PATH}}"]
verify:
  check: "{{VERIFY_CHECK}}"
```
