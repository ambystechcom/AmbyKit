---
feature: 900-edge-rich
created: 2026-11-16
---

# Tasks — Edge rich

> Line format note: a code span such as `- [ ] [T999] example` is prose, not a task.

## Phase 1 — Setup

- [x] [T001] Create scaffolding
- [ ] [T002] [P] [US1] Unusual chars
- [ ] [T003] [P] [US1] Glob ownership
- [ ] [T004] [US2] Blocked one ⚠ BLOCKED: waiting on `(src/d.ts)` ↪ DEVIATION: did it differently
- [ ] [T005] [US2] No ownership at all
- [ ] [T006] [US3] Prose parenthetical (see plan)
- [ ] [T007] [P] [US1] Prose paren then owned (x.y)
```yaml
files:
  T001: ["src/a.ts", "src/b.ts"]
  T002: ["docs/ünï.md", "src/a b.ts", "\"src/q.ts\"", "src/#hash.ts"]
  T003: ["src/**/*.ts"]
  T004: ["src/c.ts"]
  T007: ["src/e.ts"]
verify:
  check: "`npm test` passes"
  result: passed
```

## Phase 2 — Build

- [x] [T010] Done thing
- [ ] [T011] Open thing ⚠ BLOCKED:
- **Checkpoint:** phase 2 demoable.
```yaml
files:
  T010: ["src/f.ts"]
  T011: ["src/g.ts"]
verify:
  check: "first check"
  result: failed
  why: "it broke"
```

## Phase 3 — No verify

- [ ] [T020] [US4] Lonely task

```yaml
files:
  T020: ["src/h.ts"]
```

## Polish

- [ ] [T090] Unnumbered phase
```yaml
verify:
  check: "polish check"
  result: unverified
```
