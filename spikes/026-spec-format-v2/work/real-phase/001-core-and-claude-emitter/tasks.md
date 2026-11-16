---
feature: 001-core-and-claude-emitter
created: 2026-07-07
---

# Tasks — Core model + Claude Code emitter + CLI

> `[x]` = done (source of truth for `ambykit dashboard`).

## Phase 1 — Setup

- [x] [T001] Node/TS ESM scaffold: package.json, tsconfig

```yaml
files:
  T001: ["package.json"]
```

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Core types
- [x] [T011] CommandSpec loader with gray-matter + zod
- [x] [T012] Package/project path resolution
- [x] [T013] Config load/save

```yaml
files:
  T010: ["src/core/types.ts"]
  T011: ["src/core/command-spec.ts"]
  T012: ["src/core/paths.ts"]
  T013: ["src/core/config.ts"]
```

## Phase 3 — User story US-1 — Claude emitter  (priority: P1)

- [x] [T020] [US1] BaseEmitter abstract class + template method
- [x] [T021] [US1] ClaudeEmitter subclass
- [x] [T022] [US1] Emitter registry + target map
- **Checkpoint:** emitter produces `.claude/commands/amby.*.md`.

```yaml
files:
  T020: ["src/emitters/base-emitter.ts"]
  T021: ["src/emitters/claude.ts"]
  T022: ["src/emitters/index.ts"]
```

## Phase 4 — User story US-2 — init/sync/add  (priority: P1)

- [x] [T030] [US2] BaseCommand + dispatcher
- [x] [T031] [US2] File writer with dry-run/idempotency
- [x] [T032] [US2] init command
- [x] [T033] [P] [US2] sync command with --check
- [x] [T034] [P] [US2] add command
- **Checkpoint:** `ambykit init`/`sync` work end-to-end.

```yaml
files:
  T030: ["src/cli/base-command.ts", "src/cli/index.ts"]
  T031: ["src/cli/fsops.ts"]
  T032: ["src/cli/init.ts"]
  T033: ["src/cli/sync.ts"]
  T034: ["src/cli/add.ts"]
```

## Phase 5 — User story US-3 — dashboard  (priority: P2)

- [x] [T040] [US3] Story/task parsers + progress computation
- [x] [T041] [US3] dashboard command: table + detail
- **Checkpoint:** `ambykit dashboard` renders progress.

```yaml
files:
  T040: ["src/core/dashboard.ts"]
  T041: ["src/cli/dashboard.ts"]
```

## Phase 6 — Polish

- [x] [T090] Tests: emitter snapshot, loader, dashboard
- [x] [T091] Self-host: `ambykit sync` regenerates repo's own .claude/ with no diff

```yaml
files:
  T090: ["test/"]
```
