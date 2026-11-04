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
| Gemini CLI (`gemini`) | `GeminiEmitter` | `commands` (TOML) |
| LLxprt Code (`llxprt`) | `LlxprtEmitter` | `commands` (TOML) |
| Qwen Code (`qwen`) | `QwenEmitter` | `commands` |
| Kilo Code (`kilo`) | `KiloEmitter` | `commands` |
| Augment Code (`auggie`) | `AugmentEmitter` | `commands` |
| Windsurf | `WindsurfEmitter` | `workflows` |
| Kiro (IDE + `kiro-cli`) | `KiroEmitter` | `skills` |
| Pi (`pi`) | `CodexEmitter` (alias) | `skills`, identical to Codex |

## Matrix

| Concern | Claude Code | OpenCode | Copilot (VS Code) | Copilot CLI | Cursor | Cursor CLI | Antigravity | Codex CLI |
|---|---|---|---|---|---|---|---|---|
| Rules file | `CLAUDE.md` (+`@AGENTS.md` bridge) | `AGENTS.md` | `.github/copilot-instructions.md` + `AGENTS.md` | same as Copilot VS Code | `.cursor/rules/*.mdc` + `AGENTS.md` | Cursor config + `AGENTS.md` | `AGENTS.md` (+`GEMINI.md`) + `.agents/rules/*.md` | `AGENTS.md` |
| Commands/prompts | `.claude/commands/amby/*.md` | `.opencode/commands/*.md` | `.github/prompts/*.prompt.md` | **none** → skills | `.cursor/commands/*.md` | none | `.agents/workflows/*.md` | `.agents/skills/*/SKILL.md` |
| Command frontmatter | `description`, `argument-hint`, `allowed-tools`, `model` | `description`, `agent`, `model`, `subtask` | `description`, `name`, `agent`, `model`, `tools` | (skills) `name`, `description`, `allowed-tools` | plain body | — | `description` (+ `// turbo` line) | `name`, `description` |
| Scoped instructions | `.claude/rules/*.md` (`paths:`) | `instructions[]` in `opencode.json` | `.github/instructions/*.instructions.md` (`applyTo`) | same (`applyTo`, `excludeAgent`) | `.mdc` `globs`/`alwaysApply` | via `.mdc` | `.agents/rules/*.md` | nested `AGENTS.md`/`AGENTS.override.md` per directory (no glob key) |
| Args placeholder | `$ARGUMENTS`, `$N`, `$name` | `$ARGUMENTS`, `$1` | `${input:x}` | — | prompt text | — | steps in body | none — trailing free text only (AmbyKit reworks `$ARGUMENTS` into prose) |
| Agents | `.claude/agents/*.md` | `.opencode/agents/*.md` | `.github/agents/*.agent.md` | `.github/agents/*.agent.md` | UI modes (no file) | — | none (SDK only) | none (skills only) |
| Agent frontmatter | `name`*, `description`*, `tools`, `model` (body = system prompt) | `description`* (+`mode`, `permission`; filename = id) | `description`*, `name`, `tools` | same as Copilot VS Code | — | — | — | — |
| MCP file | `.mcp.json` | `opencode.json` → `mcp` | `.vscode/mcp.json` | `~/.copilot/mcp-config.json` (user) | `.cursor/mcp.json` | reads `.cursor/mcp.json` | `mcp_config.json` (user) | `.codex/config.toml` (TOML) — **out of scope**, AmbyKit does not write it |
| MCP top-level key | (per-server `type`) | `mcp` | `servers` | `mcpServers` | `mcpServers` | — | `mcpServers` | `mcp_servers.<id>` (not written) |
| AGENTS.md native | No (bridge) | Yes | Yes (opt-in) | Yes | Yes | Yes | Yes | Yes |

## Matrix — additional targets (feature 016)

Checked 2026-10-26 against vendor docs or the product's own repository (docs or loader source). Only
documented surfaces are emitted (Principle 4).

| Concern | Gemini CLI | LLxprt Code | Qwen Code | Kilo Code | Augment Code | Windsurf | Kiro | Pi |
|---|---|---|---|---|---|---|---|---|
| Rules file | `GEMINI.md` (pointer region) | `LLXPRT.md` (pointer region) | `AGENTS.md` (see below) | `AGENTS.md` | `AGENTS.md` (+`.augment/rules/`) | `AGENTS.md` (+`.windsurf/rules/`) | `AGENTS.md` (+`.kiro/steering/`) | `AGENTS.md` |
| Commands/prompts | `.gemini/commands/*.toml` | `.llxprt/commands/*.toml` | `.qwen/commands/*.md` | `.kilo/commands/*.md` | `.augment/commands/*.md` | `.windsurf/workflows/*.md` | `.kiro/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` (as Codex) |
| Command format | TOML: `prompt` (required), `description` | TOML: `prompt` (required), `description` | Markdown + YAML: `description`, `argument-hint` | Markdown + YAML: `description` | Markdown + YAML: `description`, `argument-hint` | Markdown, no frontmatter; 12,000-character limit | `name` (must equal the dir; lowercase, digits, `-`; ≤ 64), `description` | `name`, `description` |
| Args placeholder | `{{args}}` | `{{args}}` | `{{args}}` | `$ARGUMENTS`, `$N` | `$ARGUMENTS` | none — reworded as prose | `$ARGUMENTS` in the CLI only — reworded as prose | n/a for skills — reworded as prose |
| Command name | path under the dir, `/` ⇒ `:`; dots kept | as Gemini | as Gemini; dots kept | filename | filename; subdir ⇒ `:` | filename | directory name | invoked `/skill:<name>` |
| AGENTS.md native | No (opt-in via `context.fileName`) | No (`contextFileName`) | Yes per source; the docs page still says `QWEN.md` only | Yes | Yes | Yes | Yes | Yes (also `CLAUDE.md`) |
| Agents/personas | not emitted | not emitted | not emitted | not emitted | not emitted | not emitted | not emitted | not emitted |
| Sources | github.com/google-gemini/gemini-cli (docs/cli/custom-commands.md, gemini-md.md) | github.com/vybestack/llxprt-code (docs/cli/commands.md, configuration.md) | qwenlm.github.io/qwen-code-docs (features/commands); github.com/QwenLM/qwen-code | kilo.ai/docs (customize/workflows, agents-md) | docs.augmentcode.com/cli (custom-commands, rules) | docs.devin.ai/desktop/cascade (workflows, memories) | kiro.dev/docs (skills, steering) | github.com/earendil-works/pi (packages/coding-agent/docs/skills.md) |

**Gemini and LLxprt (TOML).** The prompt is a TOML literal multi-line string (`'''…'''`), so
backslashes and quotes need no escaping; a body containing `'''` falls back to a basic `"""` string.
The generated notice is a `#` comment. Gemini treats `!{…}` and `@{…}` as shell/file injection, so a
test forbids both in the neutral prompts. AmbyKit adds a `GEMINI.md` / `LLXPRT.md` pointer region and
never edits `.gemini/settings.json`.

**Windsurf.** `.windsurf/workflows/` is read by older Windsurf builds and by Devin Desktop (which
calls it legacy); `.devin/workflows/` works only on the newest builds. The trade-off is recorded
here, and switching is one emitter field.

**Pi** is an alias of the Codex emitter: it reads `.agents/skills/` natively, so the files are
identical and written once. Its activity self-report says `codex`.

**The `.agents/skills/` overlap.** Gemini, Qwen, LLxprt, Kilo, Augment, Windsurf and Pi also read
`.agents/skills/`. With Codex selected they can see each phase twice (once as a command, once as a
skill). This is documented, not suppressed. Augment also reads `.claude/commands/`; the names are
identical and `.augment/` takes precedence, so Claude plus Augment yields no duplicates.

### Status notes (checked 2026-11-04)

- **Gemini CLI** is being transitioned to Antigravity CLI. Since 2026-06-18 it no longer serves free
  individual or Google AI Pro/Ultra users; it remains for Gemini Code Assist Standard/Enterprise
  licences and paid Gemini/Vertex API keys. The target stays for those users.
- **Antigravity CLI** reads `GEMINI.md` and `AGENTS.md`, and treats skills in `.agents/skills/` as
  slash commands. It does not document `.gemini/commands/*.toml` (it converts them with
  `agy plugin import gemini`).
- **Antigravity workflows are retired.** `.agents/workflows/*.md` stopped being indexed or run on
  2026-10-19; skills at `.agents/skills/<name>/SKILL.md` replace them. The `antigravity` and
  `antigravity-cli` targets still emit workflows (tracked as feature 018); selecting `codex` or `pi`
  already writes the skills Antigravity reads.

### Out of scope (FR-002)

- **Amazon Q Developer CLI** is now Kiro CLI (docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/upgrade-to-kiro.html), which the Kiro target covers.
- **Kiro CLI prompt files** (`.kiro/prompts/`): file format undocumented.
- **Pi prompt templates** with dotted names: undocumented.
- **LLxprt sub-agents:** there is no file format, only `/subagent save`.
- **Agent/persona files** for every new target: not emitted until the format is verified (feature 013).

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

## Agent detection (dashboard, feature 017)

The interactive dashboard shows which assistant works on which feature. Two signals, keyed by the
target ids above (`src/core/agents.ts`; a test keeps it in step with `TARGETS`):

- **Self-report (primary, every tool).** The specify, design, plan, tasks, implement and converge
  prompts run `ambykit activity <feature> --agent=$AGENT --phase=<phase>`. `BaseEmitter` replaces
  `$AGENT` with the emitter's `toolId`, so aliases report their emitter's id (`claude-vscode` →
  `claude`). The marker lands in `<checkout>/.amby/activity/` with a self-ignoring `.gitignore`.
  Claude Code restricts command tools through `allowed-tools`, so phases without `bash` get only
  `Bash(ambykit activity:*)` (Claude's documented prefix rule). No other tool emits a tool allowlist.
- **Process detection (fallback, CLI agents only; `--interactive` only).** Executables checked
  2026-10-26 (spec C-2):

| Target | Executable | Source |
|---|---|---|
| `claude` | `claude` (native and npm installs) | code.claude.com/docs/en/setup |
| `codex` | `codex` | learn.chatgpt.com/docs/codex/cli |
| `opencode` | `opencode`, or node running `opencode-ai` | opencode.ai/docs |
| `copilot-cli` | `copilot`, or node running `@github/copilot` | docs.github.com (Copilot CLI command reference) |
| `cursor-cli` | `cursor-agent`, or `agent` only when its path contains `cursor` | cursor.com/docs/cli/installation |
| `gemini` | `gemini`, or node running `@google/gemini-cli` | github.com/google-gemini/gemini-cli |
| `qwen` | `qwen`, or node running `@qwen-code/qwen-code` | github.com/QwenLM/qwen-code |
| `llxprt` | `llxprt`, or node running `@vybestack/llxprt-code` | github.com/vybestack/llxprt-code |
| `kiro` | `kiro-cli` | kiro.dev/docs/cli/ |
| `kilo` | `kilo`, or node running `@kilocode/cli` | kilo.ai/docs/cli |
| `augment` | `auggie`, or node running `@augmentcode/auggie` | docs.augmentcode.com/cli/overview |

IDE-hosted agents (`claude-vscode`, `copilot`, `cursor`, `antigravity`, `windsurf`) run inside the editor
process and can't be told apart, so they are self-report only. `pi` reports as `codex` (it shares the
Codex emitter) and its executable, `pi`, is too short to match by name. `antigravity-cli` has no documented executable
name yet, so it is also self-report only. Working directories come from `lsof` (macOS) or
`/proc/<pid>/cwd` (Linux). Windows exposes no cwd through CIM, so Windows detections are shown as
"unknown location", never tied to a feature.

**Icons (spec C-3).** Nerd Font glyphs are opt-in (`AMBYKIT_ICONS=nerd` or `--icons=nerd`) and
currently affect only the worktree tag, which uses Octicons `oct-git_branch` U+F418. Agent icons stay
Unicode in every mode: the brand glyphs (`cod-claude` U+EC82, `cod-openai` U+EC81) only arrived in
recent Nerd Fonts (present in v3.5.1), and older installs render them as empty boxes.

## To verify against a live install

Docs conflicted on a couple of points; confirm before shipping those emitters:

- Antigravity `.agents/` vs `.agent/` default on the targeted version.
- Whether the `agy` CLI's `--output-format json` exists.
- Qwen Code reads `AGENTS.md` (true per its source, `memory-constants.ts`; its docs page says `QWEN.md`
  only). If a live install ignores it, add a `QWEN.md` pointer region (a one-override change).
- Gemini CLI loads `/amby.specify` from the emitted `.gemini/commands/amby.specify.toml` (SC-006).
  Waived: the CLI is now enterprise/API-key only (see the status notes above).
- Windsurf still reads `.windsurf/workflows/` on the current Devin Desktop build.

## Sources

Claude Code: code.claude.com/docs · OpenCode: opencode.ai/docs · Copilot: code.visualstudio.com/docs
and docs.github.com/copilot · Cursor: cursor.com/docs · Antigravity: antigravity.google/docs and
Google Cloud blog. Codex CLI: developers.openai.com/codex (skills, custom prompts, config reference,
AGENTS.md guide). Gemini CLI, LLxprt, Qwen Code, Kilo, Augment, Windsurf, Kiro and Pi: see the
"Sources" row of the additional-targets matrix. AGENTS.md standard: agents.md.
