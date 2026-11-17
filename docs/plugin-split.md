# Core versus plugin: the target split

Which assistants stay in AmbyKit's core and which could become official plugins
(feature 027, FR-013). **No target is removed from the core in 1.6.** The plugin API ships first
([`plugin-api.md`](./plugin-api.md)); this page records the evidence the 2.0 gate review uses to decide
what to extract (SC-007). If a target does move, the mechanism for telling a project is already in
`ambykit sync` (`src/core/moved-targets.ts`); nothing it wrote is deleted.

**Rule used for the starting classification** (plan open decision 3): the families the roadmap names
(Claude, Copilot, Cursor, OpenCode, Codex, Antigravity) are *built in*, and so are their sibling targets
(VS Code and CLI variants, and Pi, which reuses Codex's output). The later additions are *plugin
candidates*: Gemini CLI, LLxprt Code, Qwen Code, Kilo Code, Augment Code, Windsurf and Kiro.

## The 18 targets

Churn is measured from git history of the target's emitter source file as of 2026-11-16: commits that
touched the file, the date it was added and the date of the last change. It counts **our own** edits too
(worker agents, MCP files, the skills surface), so it is an upper bound on upstream format churn, not a
count of it. Aliases share their parent's file.

| Target | Emitter | Status | Churn: commits · added · last change | Demand evidence |
|---|---|---|---|---|
| `claude` | `claude.ts` | built in | 8 · 2026-07-07 · 2026-11-16 | not collected |
| `claude-vscode` | alias of `claude` | built in (sibling) | same file as `claude` | not collected |
| `copilot` | `copilot.ts` | built in | 7 · 2026-07-07 · 2026-11-16 | not collected |
| `copilot-cli` | `copilot-cli.ts` | built in (sibling) | 4 · 2026-07-07 · 2026-11-16 | not collected |
| `opencode` | `opencode.ts` | built in | 5 · 2026-07-07 · 2026-11-16 | not collected |
| `cursor` | `cursor.ts` | built in | 4 · 2026-07-07 · 2026-11-16 | not collected |
| `cursor-cli` | `cursor-cli.ts` | built in (sibling) | 1 · 2026-07-07 · 2026-07-07 | not collected |
| `antigravity` | `antigravity.ts` | built in | 4 · 2026-07-07 · 2026-11-16 | not collected |
| `antigravity-cli` | `antigravity-cli.ts` | built in (sibling) | 3 · 2026-07-07 · 2026-11-16 | not collected |
| `codex` | `codex.ts` | built in | 2 · 2026-07-13 · 2026-11-03 | not collected |
| `gemini` | `gemini.ts` | plugin candidate | 1 · 2026-11-03 · 2026-11-03 | not collected |
| `llxprt` | `llxprt.ts` | plugin candidate | 1 · 2026-11-03 · 2026-11-03 | not collected |
| `qwen` | `qwen.ts` | plugin candidate | 1 · 2026-11-03 · 2026-11-03 | not collected |
| `kilo` | `kilo.ts` | plugin candidate | 1 · 2026-11-03 · 2026-11-03 | not collected |
| `augment` | `augment.ts` | plugin candidate | 1 · 2026-11-03 · 2026-11-03 | not collected |
| `windsurf` | `windsurf.ts` | plugin candidate | 1 · 2026-11-03 · 2026-11-03 | not collected |
| `kiro` | `kiro.ts` | plugin candidate | 1 · 2026-11-03 · 2026-11-03 | not collected |
| `pi` | alias of `codex` | built in (sibling) | same file as `codex` | not collected |

## Demand evidence is a gap

AmbyKit has no usage telemetry (Principle 7), so **no demand evidence exists yet**. Before the 2.0 gate,
collect what can be collected without tracking people: issues and discussions naming each assistant,
requests for a new target, and (for any official plugin) the plugin's own package downloads. Record the
figures in the column above with the date and source; a row with no evidence stays *built in*.

## Reviewing at the 2.0 gate

1. Update the churn column from git history, and separate upstream format changes from our own edits.
2. Fill the demand column and the date it was read.
3. A candidate moves only if its churn is mostly upstream and its demand is low. Moving means: publish
   the plugin, add its entry to `MOVED_TARGETS`, drop it from `TARGETS`, and record it in the changelog
   with a `[plugin-api]` line.
