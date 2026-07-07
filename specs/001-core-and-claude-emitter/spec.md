---
feature: 001-core-and-claude-emitter
title: Core model + Claude Code emitter + CLI
branch: main
status: in-progress
created: 2026-07-07
---

# Spec — Core model + Claude Code emitter + CLI

> WHAT and WHY only. AmbyKit's first buildable slice, specced with AmbyKit (dogfooding).

## User scenarios & testing

### US-1 — Emit Claude Code commands from one neutral source  (priority: P1)

As a developer adopting AmbyKit, I want the neutral phase prompts compiled into Claude Code's native
command format, so that the `/amby.*` workflow works in Claude Code without me writing tool-specific files.

- **Why this priority:** Claude Code is the first supported tool; nothing else works without emit.
- **Independent test:** run the emitter on the prompts and inspect the generated command file.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the neutral prompts, When the Claude emitter runs, Then it writes `.claude/commands/amby.<id>.md` per phase.
- Given a spec's abstract tools, When emitted, Then `allowed-tools` uses Claude names (Read/Write/Edit/Bash).
- Given any argument-hint, When emitted, Then it is YAML-safe (quoted).

### US-2 — Scaffold a project with `ambykit init`  (priority: P1)

As a developer, I want `ambykit init` to scaffold `.amby/` and emit my selected tools' files, so that
I can start the workflow in one command.

- **Why this priority:** entry point for every user.
- **Independent test:** run `init` in a temp dir and check `.amby/` + `.claude/commands/` exist.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given an empty dir, When `ambykit init --tools=claude` runs, Then `.amby/config.json` and command files are created.
- Given `--dry-run`, When `init` runs, Then nothing is written and a plan is reported.

### US-3 — Track progress with `ambykit dashboard`  (priority: P2)

As a developer, I want a terminal dashboard of stories and task progress, so that I can see status
without opening files.

- **Why this priority:** valuable but not required to build software.
- **Independent test:** run `dashboard` against this very spec + tasks and read the table.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given specs with tagged tasks, When `dashboard` runs, Then each story shows `X of Y` tasks and a percent.
- Given a story id, When `dashboard US-1` runs, Then its metadata and task checklist are shown.

## Requirements (EARS)

- FR-001  WHEN the Claude emitter processes a neutral prompt, THE SYSTEM SHALL write one command file at `.claude/commands/<name>.md`.
- FR-002  THE SYSTEM SHALL map abstract tools (read/write/edit/bash) to Claude tool names.
- FR-003  WHEN emitting frontmatter, THE SYSTEM SHALL quote values that are not YAML-safe.
- FR-004  WHEN `sync --check` runs, IF any generated file differs from disk, THEN THE SYSTEM SHALL exit non-zero.
- FR-005  THE SYSTEM SHALL compute story progress from `tasks.md` checkbox state and `[US#]` tags.

## Success criteria

- SC-001  `ambykit init` produces a working `/amby.specify` command in Claude Code.
- SC-002  `ambykit sync --check` passes on this repo (self-hosted, no diff).
- SC-003  Adding a new tool requires only a new `BaseEmitter` subclass + registry entry + test.

## Edge cases

- Argument hints beginning with `[` or `<` must not break YAML parsing.
- A story with no tasks reports 0% (not a divide-by-zero).

## Assumptions

- Node ≥ 20, ESM. Prompts live in `src/prompts/`, templates in `src/templates/`.
