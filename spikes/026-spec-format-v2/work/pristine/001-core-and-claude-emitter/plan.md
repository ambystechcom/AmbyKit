---
feature: 001-core-and-claude-emitter
status: in-progress
created: 2026-07-07
---

# Implementation Plan — Core model + Claude Code emitter + CLI

> HOW. Satisfies FR-001..FR-005 in `@spec.md`, honors `@../../.amby/constitution.md`.

## Technical context

- **Stack:** Node ≥ 20, TypeScript (ESM, NodeNext), strict.
- **Runtime deps:** `gray-matter` (frontmatter), `zod` (validation). Custom CLI dispatcher (no
  framework) to keep M1 dependency-light and fully testable (Principle 2/5).
- **Test:** Vitest.

## Architecture

- `src/core` — pure model: `CommandSpec` loader, config, paths, dashboard parsers, AGENTS.md builder.
- `src/emitters` — `BaseEmitter` (template-method `emit`) + `ClaudeEmitter` + registry/target map.
- `src/cli` — `BaseCommand` (shared plumbing) + verbs (`init`/`add`/`sync`/`dashboard`/`check`/
  `upgrade`) + a small argv dispatcher. `fsops` does idempotent, dry-run-aware writes.

## Requirement mapping

| Requirement | How |
|---|---|
| FR-001 | `BaseEmitter.commandFile` writes `commandDir/<name>.md` (Principle 1). |
| FR-002 | `ClaudeEmitter.toolNameMap` + `mappedTools`. |
| FR-003 | `BaseEmitter.yamlQuote` on description/argument-hint. |
| FR-004 | `SyncCommand --check` returns 1 when `applyFiles` reports `wouldChange`. |
| FR-005 | `dashboard.parseTasks` + `applyTasks` count checkboxes by `[US#]`. |

## Risks & decisions

- Chose a custom dispatcher over clipanion/oclif to remove a build/version risk for M1; can revisit.
- Self-hosting replaces the M0 hand-placed commands with emitter output on first `sync`; from then
  on CI asserts `sync --check` is clean (SC-002).
