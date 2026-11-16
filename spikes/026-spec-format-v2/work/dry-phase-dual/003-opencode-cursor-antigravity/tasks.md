---
feature: 003-opencode-cursor-antigravity
created: 2026-07-07
---

# Tasks — OpenCode, Cursor (+ CLI), Antigravity emitters

## Phase 1 — Foundational

- [x] [T010] BaseEmitter: default toolNameMap + empty-frontmatter command support (src/emitters/base-emitter.ts)

## Phase 2 — User story US-1 — OpenCode  (priority: P2)

- [x] [T020] [US1] OpenCodeEmitter (src/emitters/opencode.ts)

## Phase 3 — User story US-2 — Cursor + Cursor CLI  (priority: P2)

- [x] [T030] [US2] CursorEmitter: plain commands + .mdc rule (src/emitters/cursor.ts)
- [x] [T031] [US2] CursorCliEmitter: surface none (src/emitters/cursor-cli.ts)

## Phase 4 — User story US-3 — Antigravity + CLI  (priority: P2)

- [x] [T040] [US3] AntigravityEmitter: workflows surface (src/emitters/antigravity.ts)
- [x] [T041] [US3] AntigravityCliEmitter reuses IDE output (src/emitters/antigravity-cli.ts)

## Phase 5 — Polish

- [x] [T050] Register all five targets (src/emitters/index.ts)
- [x] [T090] Tests: M3 emitters (test/m3-emitters.test.ts)
- [x] [T091] Verify all nine targets end-to-end in a temp project (init + check)
