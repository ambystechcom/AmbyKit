---
feature: 025-mcp-server
created: 2026-11-16
---

# Research — MCP revision and per-target entry shapes (T001)

Verified on 2026-11-16 from official documentation (Principle 4). Anything that could not be confirmed
from an official page is recorded as **not written**: the emitter writes nothing for it and `sync` says why.

## Protocol revision and stdio framing

- **Latest revision: `2026-07-28`** (https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio
  and https://modelcontextprotocol.io/specification/2026-07-28/changelog).
- **stdio framing** is the same in every revision we serve: one JSON-RPC message per line on stdout,
  newline-delimited, no embedded newlines; the server reads stdin; stderr is free for logging.
  (2024-11-05, 2025-03-26 and 2025-06-18 transports pages say the same.)
- **2026-07-28 removes the `initialize` / `notifications/initialized` handshake.** Each request carries the
  protocol version and client capabilities in `_meta` (`io.modelcontextprotocol/protocolVersion`); servers
  implement `server/discover` (supported versions, capabilities, identity); a version mismatch returns an
  error with code `-32022`. `ping` is removed there. A 2026 server may still answer the legacy handshake
  so older clients keep connecting.
- **Decision for `ambykit mcp`:** stay hand-rolled (plan open decision 1) but stateless, so one dispatcher
  serves both generations: it answers `initialize` (echoing the client's version when we support it, else our
  newest legacy version), `server/discover`, `ping`, `tools/list`, `tools/call`, ignores `notifications/*`,
  and refuses a request whose `_meta` protocol version we do not support with `-32022`. Supported versions:
  `2024-11-05`, `2025-03-26`, `2025-06-18`, `2025-11-25`, `2026-07-28`. Four methods plus discover, so the
  "needs more than four methods" revisit trigger is not hit and no SDK dependency is added.

## Per-target entry shape

| Target | File (scope) | Top-level key | Entry written | Source | Status |
|---|---|---|---|---|---|
| Claude Code | `.mcp.json` (project) | `mcpServers` | `{ "type": "stdio", "command": "ambykit", "args": ["mcp"] }`; Claude asks the user to approve a project server on first use | https://code.claude.com/docs/en/mcp | verified |
| Copilot (VS Code) | `.vscode/mcp.json` (project) | `servers` | `{ "type": "stdio", "command": "ambykit", "args": ["mcp"] }` | https://code.visualstudio.com/docs/agents/reference/mcp-configuration | verified |
| Cursor | `.cursor/mcp.json` (project) | `mcpServers` | `{ "type": "stdio", "command": "ambykit", "args": ["mcp"] }` | https://cursor.com/docs/mcp | verified |
| Cursor CLI | `.cursor/mcp.json` (shared with Cursor) | `mcpServers` | same file as Cursor; the CLI may need `--approve-mcps` | https://cursor.com/docs/mcp (CLI behaviour from forum threads only) | file shared; no separate write |
| Copilot CLI | `~/.copilot/mcp-config.json` (**user**) | `mcpServers` | `{ "type": "local", "command": "ambykit", "args": ["mcp"], "tools": ["*"] }` (`tools` is required) | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers | verified; written only with `--include-user` |
| Antigravity CLI | `.agents/mcp_config.json` (project, workspace override of `~/.gemini/config/mcp_config.json`) | `mcpServers` | `{ "command": "ambykit", "args": ["mcp"] }` | https://antigravity.google/docs/mcp (CLI tab) | verified for the CLI |
| Antigravity IDE | not confirmed that the IDE reads the workspace file; the documented global path `~/.gemini/config/mcp_config.json` is user-level and other guides give conflicting paths | `mcpServers` | — | https://antigravity.google/docs/mcp | **not written** |
| OpenCode | `opencode.json` | `mcp` (older docs) or `mcp.servers` (current docs, with `disabled` replacing `enabled`) | — | https://opencode.ai/docs/mcp-servers/ and https://opencode.ai/docs/migrate-v1/ | **not written**: the two schemas are incompatible and nothing says which one an installed version reads; writing the wrong one would break the user's config |
| Codex / Pi | `.codex/config.toml` | TOML `mcp_servers.<id>` | — | — | **not written** (TOML is out of scope, as the matrix says) |
| Gemini CLI, LLxprt, Qwen, Kilo, Augment, Windsurf, Kiro | — | — | — | not researched in this feature | **not written** |

## Notes

- The command written is `ambykit mcp` (plan open decision 3), not `npx -y …`, so enabling the server never
  runs network code by default (Principle 7).
- A target is "verified" only when an official page gives the file, key and entry shape. Forum posts and
  third-party guides were used to spot conflicts only, never as a source.
- Unconfirmed items to revisit: OpenCode's current schema generation; whether the Antigravity IDE reads
  `.agents/mcp_config.json`; whether Cursor CLI needs `--approve-mcps` for a project file.
