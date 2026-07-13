---
feature: 008-codex-integration
title: Codex CLI integration
branch: codex_support
status: done
created: 2026-07-13
---

# Spec — Codex CLI integration

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

## Background (researched capabilities, not decisions)

OpenAI's Codex CLI (`codex`) is not yet an AmbyKit target. Its relevant capabilities, confirmed
against current docs (developers.openai.com/codex, mid-2026):

- **Rules file**: Codex reads `AGENTS.md` **natively** at the repo root (like OpenCode/Copilot/
  Cursor/Antigravity) — no Claude-style bridge file needed. Uniquely, it also resolves *nested*
  `AGENTS.md`/`AGENTS.override.md` files per directory (root → cwd, closer wins) and caps the
  combined instructions at 32 KiB by default.
- **Command surface — two competing mechanisms**:
  - *Skills* (current, forward-looking): a directory `.agents/skills/<name>/SKILL.md`, repo-shareable,
    discovered from cwd up to repo root. Documented frontmatter is only `name` + `description`; no
    documented argument-placeholder syntax.
  - *Custom prompts* (deprecated but still functional): Markdown files under the **user-level**
    `~/.codex/prompts/`, not shareable via the repo, but they DO support the `$1`/`$ARGUMENTS`-style
    placeholders AmbyKit's phase prompts already use.
- **MCP config**: `.codex/config.toml` (TOML, project-scoped, requires the user to "trust" the
  project) or `~/.codex/config.toml` (user-level). No AmbyKit emitter currently writes MCP config
  for *any* tool, so this is background context only, not a requirement driver here.

## User scenarios & testing

### US-1 — Select Codex as a target and get native phase commands  (priority: P1)

As an AmbyKit user who works in Codex CLI, I want to pick "Codex" as a target when running
`ambykit init`/`add`, so that the same `amby.*` phase workflow I use in other tools becomes
available inside Codex.

- **Why this priority:** without this, Codex users get no AmbyKit workflow at all — this is the
  baseline value the feature exists to deliver.
- **Independent test:** run `ambykit init`/`add` with Codex selected; confirm files are written to
  the location(s) Codex actually discovers for invocable commands, and that a fresh Codex session in
  that project can list and invoke each phase.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a project with no prior AmbyKit config, When Codex is selected as a target, Then every
  phase (`constitution` → `implement`) is emitted as a Codex-invocable command.
- Given the emitted files, When `ambykit sync` is re-run with no source changes, Then no files
  change (idempotent).

### US-2 — Codex honors AmbyKit's shared rules without a bridge file  (priority: P1)

As an AmbyKit user in Codex, I want Codex to automatically follow the constitution and workflow
discipline other assistants follow, so that spec/plan/task discipline is consistent no matter which
tool authored an artifact.

- **Why this priority:** cross-tool consistency (one team, mixed tools) is a core AmbyKit promise;
  Codex reading `AGENTS.md` natively should make this "free," but it must be verified, not assumed.
- **Independent test:** start a fresh Codex session in a project with AmbyKit's generated
  `AGENTS.md`; without prompting, ask Codex to describe the project's spec workflow and confirm it
  reflects AmbyKit's constitution/workflow table.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given AmbyKit's generated `AGENTS.md` at the repo root, When a Codex session starts in that repo,
  Then Codex's responses reflect the constitution and phase workflow without any Codex-specific
  rules file.
- Given a consumer project that already has its own nested `AGENTS.md` files in subdirectories,
  When AmbyKit's root `AGENTS.md` is added, Then AmbyKit's content is not silently shadowed or
  truncated by Codex's per-directory precedence or size cap.

### US-3 — Phase arguments reach the prompt the same way they do elsewhere  (priority: P2)

As an AmbyKit user in Codex, I want to pass a feature idea or task description when invoking a phase
(e.g. the equivalent of `/amby.specify <idea>` elsewhere), so that Codex's invocation feels the same
as it does in Claude Code, OpenCode, or Copilot.

- **Why this priority:** the workflow is usable without this (a user can paste the argument as a
  follow-up message), but it is degraded relative to every other command-surface tool AmbyKit
  supports today.
- **Independent test:** invoke a phase skill in Codex with a trailing argument and confirm the
  phase prompt receives it as free text, without a second message and without a literal placeholder
  token leaking into the prompt.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a phase skill invoked with a trailing free-text argument, When Codex runs it, Then the
  phase prompt is filled with that argument as trailing free text (skills have no `$ARGUMENTS`-style
  substitution token, so the body must be worded to consume trailing text directly rather than via
  a placeholder).

### US-4 — AmbyKit dogfoods Codex on its own repo  (priority: P3)

As an AmbyKit maintainer, I want AmbyKit's own repo to add Codex as a target via `ambykit sync`
(Principle 6), and `docs/tool-compatibility.md` updated with Codex's exact paths, so the repo stays
self-hosted and the compatibility matrix stays trustworthy.

- **Why this priority:** doesn't block Codex users, but is required before this feature can be
  considered done per the constitution.
- **Independent test:** run `ambykit sync` in the AmbyKit repo with Codex added; CI's "sync produces
  no diff" check passes; `docs/tool-compatibility.md` gains a Codex column/row with sourced paths.
- **depends-on:** [US-1, US-2, US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given Codex added to AmbyKit's own target config, When `ambykit sync` runs, Then the repo's
  generated Codex files are committed and a second `sync` run produces no diff.
- Given the new emitter, When `docs/tool-compatibility.md` is checked, Then it lists Codex's rules
  file, command surface, frontmatter, and MCP-file location with the same precision as every other
  row.

## Requirements (EARS)

- FR-001  WHEN a user selects the Codex target during `init`/`add`, THE SYSTEM SHALL emit an
  AmbyKit-native command for every phase, written to the location(s) Codex discovers for invocable
  commands without any manual step beyond what other native-`AGENTS.md` tools require.
- FR-002  THE SYSTEM SHALL emit AmbyKit's shared rules content in the single `AGENTS.md` location
  Codex reads by default, without a tool-specific bridge file (parity with OpenCode/Copilot/Cursor/
  Antigravity, unlike Claude Code).
- FR-003  WHEN a phase command is invoked in Codex with a trailing argument, THE SYSTEM SHALL ensure
  that argument reaches the phase prompt via skills — Codex's current, repo-shareable command
  mechanism. Skills have no dedicated placeholder syntax, so the argument is delivered as trailing
  free text the same way any other input reaches an invoked skill, not via a `$ARGUMENTS`-style
  substitution. The deprecated, user-level custom-prompts mechanism is not targeted.
- FR-004  IF satisfying FR-003 requires writing outside the project directory (e.g. to a user-level
  Codex path), THEN THE SYSTEM SHALL NOT do so without explicit user consent, per Principle 7.
- FR-005  WHEN `ambykit sync` runs against an existing Codex configuration with no source changes,
  THE SYSTEM SHALL produce no file diff (idempotent regeneration).
- FR-006  THE SYSTEM SHALL document Codex's emitted paths, frontmatter keys, and command-surface
  format in `docs/tool-compatibility.md`, sourced from official Codex docs per Principle 4.
- FR-007  WHERE a consumer project already has nested `AGENTS.md`/`AGENTS.override.md` files in
  subdirectories, THE SYSTEM SHALL leave AmbyKit's root `AGENTS.md` behavior consistent with how it
  treats every other `AGENTS.md`-native tool (no Codex-specific special-casing beyond what the
  nesting/size-cap behavior of Codex itself already requires).

## Success criteria

- SC-001  A user with only the Codex CLI installed can go from `ambykit init` to successfully
  running every AmbyKit phase inside Codex, with zero manual file edits beyond what any other
  native-`AGENTS.md` tool requires.
- SC-002  Re-running `ambykit sync` with unchanged AmbyKit source and an existing Codex
  configuration produces zero file changes.
- SC-003  AmbyKit's own repository lists Codex as a supported, dogfooded target with a passing
  "sync produces no diff" CI check.
- SC-004  `docs/tool-compatibility.md`'s Codex row/column is independently verifiable against a live
  Codex install (no invented paths or frontmatter keys).

## Edge cases

- Codex's per-directory nested `AGENTS.md`/`AGENTS.override.md` resolution and 32 KiB combined-size
  cap could shadow or truncate AmbyKit's rules content in a consumer project that already has deep
  nested rules files. **Out of scope**: AmbyKit treats Codex the same as every other `AGENTS.md`-
  native tool here — no detection or warning; Codex's own docs already put this burden on the user.
- Codex's `.agents/skills/` directory and Antigravity's `.agents/workflows/` directory share the same
  `.agents/` root but different subdirectories — a project selecting both targets must not have one
  tool's files collide with or be mistaken for the other's.
- An older Codex CLI install that predates skills only understands the deprecated, user-level
  custom-prompts path. **Resolved**: out of scope — AmbyKit targets skills only ("skills or
  nothing" is the accepted minimum-version stance); such installs simply see no AmbyKit commands
  until the user upgrades.
- A project selects Codex without ever installing the Codex CLI — emitted files should be inert
  (harmless) until the user actually installs and runs Codex, same as any other target.

## Assumptions

- "Codex" means OpenAI's Codex CLI (`codex`) and its IDE extension, which share the same host config
  — not any other product also named Codex.
- MCP server configuration for Codex (`.codex/config.toml`, TOML) is **out of scope** for this
  feature: no existing AmbyKit emitter yet writes MCP config for any tool, so Codex should not be
  the first without a separate, explicit feature for it.
- Codex's *skills* mechanism, not the deprecated *custom prompts* mechanism, is the confirmed
  integration point (see FR-003).
