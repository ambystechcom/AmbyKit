---
feature: 003-opencode-cursor-antigravity
title: OpenCode, Cursor (+ CLI), Antigravity (IDE + CLI) emitters
branch: main
status: done
created: 2026-07-07
---

# Spec — OpenCode, Cursor (+ CLI), Antigravity emitters

> Completes first-release tool coverage. Exercises all four command surfaces
> (commands / skills / workflows / none).

## User scenarios & testing

### US-1 — OpenCode commands  (priority: P2)

As an OpenCode user, I want the phases as `.opencode/commands/*.md`, so that `/amby.*` works there.

- **Independent test:** emit and inspect `.opencode/commands/amby.specify.md`.
- **status:** done

**Acceptance criteria**
- Given the prompts, When the OpenCode emitter runs, Then it writes `.opencode/commands/amby.<id>.md` with a description.

### US-2 — Cursor commands + rule, and Cursor CLI (rules-only)  (priority: P2)

As a Cursor user, I want plain command files plus an always-applied rule; the CLI is rules-only.

- **Independent test:** emit and inspect `.cursor/commands/` (plain) and `.cursor/rules/ambykit.mdc`.
- **status:** done

**Acceptance criteria**
- Given Cursor, When emitted, Then commands are plain markdown (no frontmatter) and `.cursor/rules/ambykit.mdc` has `alwaysApply: true`.
- Given Cursor CLI (surface none), When emitted, Then no command files are produced, only the reused rule.

### US-3 — Antigravity workflows (IDE + CLI)  (priority: P2)

As an Antigravity user, I want the phases as `.agents/workflows/*.md`; the CLI shares that output.

- **Independent test:** emit and inspect `.agents/workflows/amby.specify.md`.
- **status:** done

**Acceptance criteria**
- Given Antigravity, When emitted, Then workflows have `description`-only frontmatter under `.agents/workflows/`.
- Given Antigravity CLI, When emitted, Then its output is byte-identical to the IDE emitter's.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL support four command surfaces: commands, skills, workflows, none.
- FR-002  WHEN a tool documents no command frontmatter (Cursor), THE SYSTEM SHALL emit a plain command body.
- FR-003  WHEN a tool is rules-only (Cursor CLI), THE SYSTEM SHALL emit no command files.
- FR-004  WHEN emitting Antigravity workflows, THE SYSTEM SHALL use `.agents/` (plural) and description-only frontmatter.
- FR-005  WHERE targets share a harness (Antigravity IDE/CLI), THE SYSTEM SHALL produce identical output.

## Success criteria

- SC-001  `ambykit init` with all nine targets emits each tool's files and reports healthy `check`.
- SC-002  Each new emitter is a thin `BaseEmitter` subclass; CLIs reuse a sibling via inheritance.

## Assumptions

- OpenCode/Cursor/Antigravity read AGENTS.md natively (no bridge needed, unlike Claude Code).
