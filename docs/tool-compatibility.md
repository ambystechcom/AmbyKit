# Tool compatibility

Exact paths and formats AmbyKit emits for each supported assistant. Verified against official docs
(mid-2026). This is the source of truth for the emitters in `src/emitters/` — keep it in sync when a
tool's format changes.

## Selectable targets → emitters

Several targets share one emitter's output (why `BaseEmitter` + thin subclasses exist):

| Target | Emitter | Command surface |
|---|---|---|
| Claude Code (CLI) | `ClaudeEmitter` | `commands` |
| Claude Code (VS Code extension) | `ClaudeEmitter` | identical to CLI |
| GitHub Copilot (VS Code extension) | `CopilotEmitter` | `commands` |
| GitHub Copilot CLI (`copilot`) | `CopilotCliEmitter` | `skills` (no prompt files) |
| OpenCode | `OpenCodeEmitter` | `commands` |
| Cursor | `CursorEmitter` | `commands` |
| Cursor CLI (`cursor-agent`) | `CursorCliEmitter` | `none` (rules-only) |
| Antigravity (IDE) | `AntigravityEmitter` | `workflows` |
| Antigravity CLI (`agy`) | `AntigravityCliEmitter` | reuses Antigravity |
| Codex CLI (`codex`) | `CodexEmitter` | `skills` |

## Matrix

| Concern | Claude Code | OpenCode | Copilot (VS Code) | Copilot CLI | Cursor | Cursor CLI | Antigravity | Codex CLI |
|---|---|---|---|---|---|---|---|---|
| Rules file | `CLAUDE.md` (+`@AGENTS.md` bridge) | `AGENTS.md` | `.github/copilot-instructions.md` + `AGENTS.md` | same as Copilot VS Code | `.cursor/rules/*.mdc` + `AGENTS.md` | Cursor config + `AGENTS.md` | `AGENTS.md` (+`GEMINI.md`) + `.agents/rules/*.md` | `AGENTS.md` |
| Commands/prompts | `.claude/commands/amby/*.md` | `.opencode/commands/*.md` | `.github/prompts/*.prompt.md` | **none** → skills | `.cursor/commands/*.md` | none | `.agents/workflows/*.md` | `.agents/skills/*/SKILL.md` |
| Command frontmatter | `description`, `argument-hint`, `allowed-tools`, `model` | `description`, `agent`, `model`, `subtask` | `description`, `name`, `agent`, `model`, `tools` | (skills) `name`, `description`, `allowed-tools` | plain body | — | `description` (+ `// turbo` line) | `name`, `description` |
| Scoped instructions | `.claude/rules/*.md` (`paths:`) | `instructions[]` in `opencode.json` | `.github/instructions/*.instructions.md` (`applyTo`) | same (`applyTo`, `excludeAgent`) | `.mdc` `globs`/`alwaysApply` | via `.mdc` | `.agents/rules/*.md` | nested `AGENTS.md`/`AGENTS.override.md` per directory (no glob key) |
| Args placeholder | `$ARGUMENTS`, `$N`, `$name` | `$ARGUMENTS`, `$1` | `${input:x}` | — | prompt text | — | steps in body | none — trailing free text only (AmbyKit reworks `$ARGUMENTS` into prose) |
| Agents | `.claude/agents/*.md` | `.opencode/agents/*.md` | `.github/agents/*.agent.md` | `.github/agents/*.agent.md` | UI modes (no file) | — | none (SDK only) | none (skills only) |
| MCP file | `.mcp.json` | `opencode.json` → `mcp` | `.vscode/mcp.json` | `~/.copilot/mcp-config.json` (user) | `.cursor/mcp.json` | reads `.cursor/mcp.json` | `mcp_config.json` (user) | `.codex/config.toml` (TOML) — **out of scope**, AmbyKit does not write it |
| MCP top-level key | (per-server `type`) | `mcp` | `servers` | `mcpServers` | `mcpServers` | — | `mcpServers` | `mcp_servers.<id>` (not written) |
| AGENTS.md native | No (bridge) | Yes | Yes (opt-in) | Yes | Yes | Yes | Yes | Yes |

## Gotchas the emitters encode

- **Claude Code does not read `AGENTS.md`.** Emit a `CLAUDE.md` whose first line is `@AGENTS.md` (or a
  symlink) so there's a single shared rules source. This bridge line is preserved (re-added if missing)
  when merging into an existing `CLAUDE.md`.
- **Rules files are merged, not overwritten.** Every rules file wraps AmbyKit's content in a
  `### AmbyKit usage` section so it can be spliced into a file the user already authored; only that
  section is AmbyKit's. (Command/prompt/skill/workflow files remain fully generated and overwritten.)
- **MCP top-level key differs**: `servers` (Copilot VS Code) vs `mcpServers` (Cursor, Copilot CLI,
  Antigravity) vs `mcp` (OpenCode) vs per-server `type` blocks (Claude `.mcp.json`).
- **MCP scope differs**: Copilot CLI and Antigravity use **user-level** files outside the repo — AmbyKit
  writes these only with explicit consent and excludes them from the "repo in sync" check.
- **Scoped-instruction key differs**: Copilot `applyTo` vs Cursor `globs` (+ `alwaysApply`).
- **Command surface differs**: Copilot CLI has no `.prompt.md`; phases map to `SKILL.md`. Antigravity
  uses `.agents/workflows/*.md` with a `// turbo` line to auto-run a step. Cursor CLI is rules-only.
- **OpenCode** uses plural dirs (`agents/`, `commands/`) and `provider/model-id` model strings.
- **Antigravity** dir is `.agents/` (plural); `.agent/` is legacy read-compat.
- **Codex** shares the `.agents/` root with Antigravity but a different subdirectory (`skills/` vs
  `workflows/`) — the two coexist without collision when both targets are selected. Codex's skills
  frontmatter has no argument-placeholder key, so AmbyKit rewrites the neutral `$ARGUMENTS` token into
  prose rather than leaving a literal, un-substituted placeholder in the emitted `SKILL.md`. Codex's
  deprecated, user-level custom-prompts mechanism (`~/.codex/prompts/`, which does support
  placeholders) is intentionally not targeted — see `specs/008-codex-integration/spec.md` FR-003/
  FR-004. Codex also resolves nested `AGENTS.md`/`AGENTS.override.md` files per directory (closer
  wins) with a 32 KiB combined-size cap; AmbyKit does not special-case this, consistent with every
  other `AGENTS.md`-native tool.

## To verify against a live install

Docs conflicted on a couple of points; confirm before shipping those emitters:

- Antigravity `.agents/` vs `.agent/` default on the targeted version.
- Whether the `agy` CLI's `--output-format json` exists.

## Sources

Claude Code: code.claude.com/docs · OpenCode: opencode.ai/docs · Copilot: code.visualstudio.com/docs
and docs.github.com/copilot · Cursor: cursor.com/docs · Antigravity: antigravity.google/docs and
Google Cloud blog. Codex CLI: developers.openai.com/codex (skills, custom prompts, config reference,
AGENTS.md guide). AGENTS.md standard: agents.md.
