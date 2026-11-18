---
format: 2
feature: 001-twin
created: 2026-11-18
---

# Tasks — Twin

## Phase 1 — Setup

- [x] [T001] [US1] Scaffold
- [x] [T002] [US1] Wire it
```yaml
files:
  T001: ["src/a.ts"]
  T002: ["src/b.ts", "test/b.test.ts"]
verify:
  check: "`npm test`"
  result: passed
```

## Phase 2 — Build

- [ ] [T010] [P] [US2] Left lane
- [ ] [T011] [P] [US2] Right lane
- [ ] [T012] [US2] Glue ⚠ BLOCKED: waiting on T010
- [ ] [T013] [US3] Third thing ↪ DEVIATION: did it differently
```yaml
files:
  T010: ["src/left.ts"]
  T011: ["src/right.ts"]
  T012: ["src/glue.ts"]
  T013: ["src/third.ts"]
verify:
  check: "`npm run check`"
  result: unverified
```

## Phase 3 — Polish

- [ ] [T020] [US4] Docs
```yaml
files:
  T020: ["docs/twin.md"]
```
