---
feature: 900-edge-rich
created: 2026-11-16
---

# Tasks — Edge rich

> Line format note: a code span such as `- [ ] [T999] example` is prose, not a task.

## Phase 1 — Setup

- [x] [T001] Create scaffolding (src/a.ts, `src/b.ts`)
- [ ] [T002] [P] [US1] Unusual chars (docs/ünï.md, src/a b.ts, "src/q.ts", src/#hash.ts)
- [ ] [T003] [P] [US1] Glob ownership (src/**/*.ts)
- [ ] [T004] [US2] Blocked one (src/c.ts) ⚠ BLOCKED: waiting on `(src/d.ts)` ↪ DEVIATION: did it differently
- [ ] [T005] [US2] No ownership at all
- [ ] [T006] [US3] Prose parenthetical (see plan)
- [ ] [T007] [P] [US1] Prose paren then owned (x.y) (src/e.ts)
- **Verify:** `npm test` passes ✓ passed

## Phase 2 — Build

- [x] [T010] Done thing (src/f.ts)
- [ ] [T011] Open thing (src/g.ts) ⚠ BLOCKED:
- **Checkpoint:** phase 2 demoable.
- **Verify:** first check ✗ failed: it broke

## Phase 3 — No verify

- [ ] [T020] [US4] Lonely task (src/h.ts)

## Polish

- [ ] [T090] Unnumbered phase
- **Verify:** polish check ? unverified
