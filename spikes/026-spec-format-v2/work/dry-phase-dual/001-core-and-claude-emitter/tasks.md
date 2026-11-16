---
feature: 001-core-and-claude-emitter
created: 2026-07-07
---

# Tasks — Core model + Claude Code emitter + CLI

> `[x]` = done (source of truth for `ambykit dashboard`).

## Phase 1 — Setup

- [x] [T001] Node/TS ESM scaffold: package.json, tsconfig (package.json)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Core types (src/core/types.ts)
- [x] [T011] CommandSpec loader with gray-matter + zod (src/core/command-spec.ts)
- [x] [T012] Package/project path resolution (src/core/paths.ts)
- [x] [T013] Config load/save (src/core/config.ts)

## Phase 3 — User story US-1 — Claude emitter  (priority: P1)

- [x] [T020] [US1] BaseEmitter abstract class + template method (src/emitters/base-emitter.ts)
- [x] [T021] [US1] ClaudeEmitter subclass (src/emitters/claude.ts)
- [x] [T022] [US1] Emitter registry + target map (src/emitters/index.ts)
- **Checkpoint:** emitter produces `.claude/commands/amby.*.md`.

## Phase 4 — User story US-2 — init/sync/add  (priority: P1)

- [x] [T030] [US2] BaseCommand + dispatcher (src/cli/base-command.ts, src/cli/index.ts)
- [x] [T031] [US2] File writer with dry-run/idempotency (src/cli/fsops.ts)
- [x] [T032] [US2] init command (src/cli/init.ts)
- [x] [T033] [P] [US2] sync command with --check (src/cli/sync.ts)
- [x] [T034] [P] [US2] add command (src/cli/add.ts)
- **Checkpoint:** `ambykit init`/`sync` work end-to-end.

## Phase 5 — User story US-3 — dashboard  (priority: P2)

- [x] [T040] [US3] Story/task parsers + progress computation (src/core/dashboard.ts)
- [x] [T041] [US3] dashboard command: table + detail (src/cli/dashboard.ts)
- **Checkpoint:** `ambykit dashboard` renders progress.

## Phase 6 — Polish

- [x] [T090] Tests: emitter snapshot, loader, dashboard (test/)
- [x] [T091] Self-host: `ambykit sync` regenerates repo's own .claude/ with no diff
