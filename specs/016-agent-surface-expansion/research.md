# Research — 016 Agent surface expansion (US-1, Phase 0)

> All facts were checked on 2026-10-26 against vendor docs or the product's own repository (docs or
> loader source), per Principle 4. Blog posts were not used. Each row becomes a column in
> `docs/tool-compatibility.md` (T010).

## Findings

| Target | Surface | Project path | Format / keys | Args | Name rule | Rules file | AGENTS.md native | Source |
|---|---|---|---|---|---|---|---|---|
| Gemini CLI | commands | `.gemini/commands/*.toml` | TOML; `prompt` (required), `description` | `{{args}}`; absent ⇒ args appended after a blank line | path relative to dir, `/`⇒`:`; dots kept | `GEMINI.md` | No (opt-in via `context.fileName`) | github.com/google-gemini/gemini-cli docs/cli/custom-commands.md, gemini-md.md; `FileCommandLoader.ts` |
| LLxprt Code | commands | `.llxprt/commands/*.toml` | TOML; `prompt` (required), `description` | `{{args}}` | as Gemini (loader globs `**/*.toml`) | `LLXPRT.md` | No (`contextFileName`) | github.com/vybestack/llxprt-code docs/cli/commands.md, configuration.md; `FileCommandLoader.ts` |
| Qwen Code | commands | `.qwen/commands/*.md` | Markdown + YAML; `description`, `argument-hint` (TOML deprecated) | `{{args}}` | as Gemini; dots kept | `QWEN.md` | **Yes per source** (`memory-constants.ts` includes AGENTS.md); the docs page still says QWEN.md only | qwenlm.github.io/qwen-code-docs …/features/commands/; github.com/QwenLM/qwen-code |
| Windsurf (Devin Desktop) | workflows | `.windsurf/workflows/*.md` (legacy, still read) or `.devin/workflows/*.md` | Markdown, no frontmatter documented; **12,000-char limit** | none | `/<name>`, filename implied | `.windsurf/rules/` | Yes | docs.devin.ai/desktop/cascade/workflows, …/memories |
| Kilo Code | commands | `.kilo/commands/*.md` | Markdown + YAML; `description` (+ `agent`, `model`, `variant`, `subtask`) | `$ARGUMENTS`, `$N` | filename | — | Yes | kilo.ai/docs/customize/workflows, …/agents-md; Kilo-Org/kilocode `kilo-config.md` |
| Augment Code | commands | `.augment/commands/*.md` | Markdown + YAML; `description`, `argument-hint`, `model` | `$ARGUMENTS` | filename; subdir ⇒ `:` | `.augment/rules/` | Yes | docs.augmentcode.com/cli/custom-commands, …/cli/rules |
| Kiro (IDE + CLI) | skills | `.kiro/skills/<name>/SKILL.md` | `name` (lowercase letters, digits, `-`; ≤ 64; must equal the dir), `description` | `$ARGUMENTS` in the CLI only | dir name | `.kiro/steering/` | Yes | kiro.dev/docs/skills/, kiro.dev/docs/steering/ |
| Pi | skills | `.agents/skills/<name>/SKILL.md` (also `.pi/skills/`) | `name`, `description` | n/a for skills | invoked `/skill:<name>` | — | Yes (AGENTS.md, CLAUDE.md) | github.com/earendil-works/pi packages/coding-agent/docs/skills.md, configuration.md |
| Amazon Q | — | — | — | — | — | — | — | **Out of scope:** Q Developer CLI is now Kiro CLI (docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/upgrade-to-kiro.html) |

Not verified, so not used:
- Kiro CLI prompt files (`.kiro/prompts/`): file format undocumented.
- Pi prompt templates with dotted names: undocumented.
- LLxprt sub-agents: there is no file format, only `/subagent save`.
- Agent/persona files for every new target: the 013 rule applies (none are emitted).

## Decisions

- **R1, the TOML targets (Gemini, LLxprt):**
  - The prompt is a TOML *literal* multi-line string (`'''…'''`), so backslashes and quotes in the
    neutral body need no escaping.
  - If a body ever contains `'''`, the emitter falls back to a basic `"""…"""` string, escaping `\`
    and `"`.
  - The generated notice becomes a `#` TOML comment, so it costs no prompt tokens.
  - `$ARGUMENTS` becomes `{{args}}`.
  - A test forbids `!{` and `@{` in the neutral prompts, because Gemini treats both as shell and file
    injection.
- **R2, rules for non-native targets:** a `GEMINI.md` or `LLXPRT.md` **pointer region**, the same
  merge-region mechanism as Claude, Copilot and Cursor. No `.gemini/settings.json` edits: AmbyKit
  never merges into a tool's JSON settings (P7), and the pointer works on every version.
- **R3, Qwen's AGENTS.md:** the source is authoritative but the docs lag, so it is treated as native
  and added to the matrix's "To verify against a live install" list. If the live check fails, a
  `QWEN.md` pointer is a one-override change.
- **R4, the Windsurf path:** `.windsurf/workflows/` is read by both the older Windsurf builds and the
  current Devin Desktop (as legacy). `.devin/` only works on the newest builds.
  - The trade-off is that the files stay in a directory the vendor calls legacy. The matrix records
    it, and a future switch is one emitter field.
- **R5, Pi is an alias of Codex** (`{ id: "pi", emitter: codex, alias: true }`):
  - Pi reads `.agents/skills/` natively, so the output is byte-identical to Codex's and
    `emittersForTargets` writes it once.
  - Ownership is the set of configured targets that resolve to the emitter. AmbyKit never deletes
    emitted files on removal, so a remaining owner's files are always kept (FR-007).
  - Limitation: Pi's activity self-report says `codex`, the same as `claude-vscode` saying `claude`.
- **R6, Kiro:** the `.kiro/skills/` surface uses the hyphenated Codex naming (`amby-specify`), and
  `$ARGUMENTS` is reworded to prose because the IDE does not substitute it.
- **R7, the `.agents/skills/` overlap:** Gemini, Qwen, LLxprt, Kilo, Augment, Windsurf and Pi all also
  read `.agents/skills/`. With Codex selected, these tools see the phases twice. This is documented,
  not suppressed (spec edge case).
- **R8, Augment also reads `.claude/commands/`:** names are identical (`amby.specify`), and Augment
  gives `.augment/` precedence, so Claude plus Augment yields no duplicates.
- **R9, process detection (017 `AGENTS` table):** every new target id gets an entry.
  - Executables are added only where official install docs name them. T011 checks this for
    `gemini`, `qwen`, `llxprt`, `kiro-cli`, `kilo`, `auggie` and `pi`.
  - Any executable that cannot be verified, and the IDE-only targets (Windsurf), are self-report only,
    as `antigravity-cli` is today.
