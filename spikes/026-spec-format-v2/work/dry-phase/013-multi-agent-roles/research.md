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

## Phase 0 verification — done 2026-08-25 (T002)

Verified against official docs; recorded in `docs/tool-compatibility.md` ("Agent frontmatter" row).
All three targets qualify for US-5.

| Target | Path | Required keys | Optional keys we use | Source |
|---|---|---|---|---|
| Claude Code | `.claude/agents/<name>.md` | `name` (lowercase+hyphens), `description` | `tools` (comma list), `model` | code.claude.com/docs/en/sub-agents |
| OpenCode | `.opencode/agents/<id>.md` (filename = agent id) | `description` | `mode: subagent`, `permission` | opencode.ai/docs/agents |
| Copilot VS Code + CLI | `.github/agents/<name>.agent.md` | `description` | `name`, `tools` | docs.github.com → create-custom-agents (all environments) |

Body = system prompt in all three. Filenames: `amby-<role-id>` (Copilot allows `. - _ a-z A-Z 0-9`).

Out of scope for native emission (matrix lists no file format): Cursor (UI modes), Cursor CLI,
Antigravity (SDK only), Codex (skills only).
