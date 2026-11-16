---
feature: 003-opencode-cursor-antigravity
created: 2026-07-07
---

# Tasks — OpenCode, Cursor (+ CLI), Antigravity emitters

## Phase 1 — Foundational

- [x] [T010] BaseEmitter: default toolNameMap + empty-frontmatter command support

```yaml
files:
  T010: ["src/emitters/base-emitter.ts"]
```

## Phase 2 — User story US-1 — OpenCode  (priority: P2)

- [x] [T020] [US1] OpenCodeEmitter

```yaml
files:
  T020: ["src/emitters/opencode.ts"]
```

## Phase 3 — User story US-2 — Cursor + Cursor CLI  (priority: P2)

- [x] [T030] [US2] CursorEmitter: plain commands + .mdc rule
- [x] [T031] [US2] CursorCliEmitter: surface none

```yaml
files:
  T030: ["src/emitters/cursor.ts"]
  T031: ["src/emitters/cursor-cli.ts"]
```

## Phase 4 — User story US-3 — Antigravity + CLI  (priority: P2)

- [x] [T040] [US3] AntigravityEmitter: workflows surface
- [x] [T041] [US3] AntigravityCliEmitter reuses IDE output

```yaml
files:
  T040: ["src/emitters/antigravity.ts"]
  T041: ["src/emitters/antigravity-cli.ts"]
```

## Phase 5 — Polish

- [x] [T050] Register all five targets
- [x] [T090] Tests: M3 emitters
- [x] [T091] Verify all nine targets end-to-end in a temp project (init + check)

```yaml
files:
  T050: ["src/emitters/index.ts"]
  T090: ["test/m3-emitters.test.ts"]
```
