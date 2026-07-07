---
feature: 002-copilot-emitters
title: GitHub Copilot emitters (VS Code + CLI)
branch: main
status: done
created: 2026-07-07
---

# Spec — GitHub Copilot emitters (VS Code + CLI)

> Second buildable slice, specced with AmbyKit. Introduces the `commandSurface` abstraction.

## User scenarios & testing

### US-1 — Emit Copilot VS Code prompt files  (priority: P1)

As a developer who uses GitHub Copilot in VS Code, I want the AmbyKit phases as Copilot prompt files,
so that I can run `/amby.*` in Copilot Chat.

- **Why this priority:** Copilot in VS Code is the most common assistant.
- **Independent test:** run the emitter and inspect `.github/prompts/amby.specify.prompt.md`.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the neutral prompts, When the Copilot emitter runs, Then it writes `.github/prompts/amby.<id>.prompt.md`.
- Given a body using `$ARGUMENTS`, When emitted for Copilot, Then it becomes `${input:args}`.
- Given rules are managed, When emitted, Then `.github/copilot-instructions.md` points at AGENTS.md.

### US-2 — Emit Copilot CLI skills  (priority: P1)

As a developer who uses the GitHub Copilot CLI, I want the phases as skills (the CLI has no prompt
files), so that the workflow is available there too.

- **Why this priority:** completes Copilot coverage; first use of `commandSurface: skills`.
- **Independent test:** run the CLI emitter and inspect `.github/skills/amby-specify/SKILL.md`.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the neutral prompts, When the Copilot CLI emitter runs, Then it writes `.github/skills/amby-<id>/SKILL.md`.
- Given a skill, When emitted, Then its `name` is lowercase-hyphen (amby-specify) and it reuses Copilot rules.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL model each tool's command surface as one of commands, skills, workflows, or none.
- FR-002  WHEN emitting for Copilot VS Code, THE SYSTEM SHALL write prompt files with `agent: agent`.
- FR-003  WHEN emitting for a tool whose argument convention differs, THE SYSTEM SHALL transform the body accordingly.
- FR-004  WHEN emitting for Copilot CLI, THE SYSTEM SHALL produce skills, not prompt files.
- FR-005  WHERE a target reuses another's output (VS Code extension), THE SYSTEM SHALL not duplicate files.

## Success criteria

- SC-001  `ambykit add copilot copilot-cli` emits both surfaces without touching the Claude output.
- SC-002  A new emitter is a thin subclass — CopilotCliEmitter extends CopilotEmitter.

## Edge cases

- Both `copilot` and `copilot-cli` enabled: shared `.github/copilot-instructions.md` written once, idempotently.

## Assumptions

- Copilot VS Code reads `.github/prompts/*.prompt.md`; Copilot CLI reads `.github/skills/*/SKILL.md`.
