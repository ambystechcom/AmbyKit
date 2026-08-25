# Research — 013 multi-agent roles

Decisions with rationale, and the verification the plan's Phase 0 must complete before US-5 emits
anything (constitution Principle 4: verify formats, never guess).

## Decisions

| Decision | Rationale |
|---|---|
| Roles as project-owned Markdown in `.amby/roles/` | Same pattern as `.amby/templates/` and `.amby/reference/`: shipped defaults, write-if-absent, user edits survive `sync`. |
| Phases reference roles by `@.amby/roles/<id>.md` | One small file per phase (Principle 3); edits need no re-sync; absent dir = today's behavior (FR-004). |
| Injection in `BaseEmitter.transformBody` | One hook for all prompts and tools (Principle 2). |
| Six default roles incl. Tech Lead for `tasks` | Clarified 2026-08-25; mirrors the BMAD role split but trimmed to what AmbyKit phases actually produce. |
| Review is advisory | Clarified 2026-08-25; consistent with `analyze` (report, never block). |
| 150-word cap, warn not refuse | Clarified 2026-08-25; keeps overhead bounded while letting teams exceed it knowingly. |

## To verify in Phase 0 (blocks US-5 only)

`docs/tool-compatibility.md` records agent **paths** but not agent-file **frontmatter**. Verify each
against the official docs and add an "Agent frontmatter" row; drop any target that cannot be
verified.

| Target | Path (matrix) | Keys to confirm | Source to check |
|---|---|---|---|
| Claude Code | `.claude/agents/*.md` | `name`, `description`, `tools`, `model` | Claude Code docs → Sub-agents |
| OpenCode | `.opencode/agents/*.md` | `description`, `mode`, `model`, `tools` | opencode.ai docs → Agents |
| Copilot | `.github/agents/*.agent.md` | `name`, `description`, `tools` | GitHub Docs → Custom agents |

Out of scope for native emission (matrix lists no file format): Cursor (UI modes), Cursor CLI,
Antigravity (SDK only), Codex (skills only).
