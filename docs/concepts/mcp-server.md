# AmbyKit as an MCP server

`ambykit mcp` serves a few small tools over the Model Context Protocol (stdio), so an assistant can ask
for **state** (the next task, a story's blockers) instead of reading `tasks.md` and the spec, and can
change state through **one validated path** instead of editing files by hand. It runs locally, uses zero
model tokens, and is **opt-in**: nothing changes until you turn it on, and every phase prompt still works
from files when the server is absent.

## Turning it on

Set it in `.amby/config.json` and run `ambykit sync`:

```json
{ "tools": ["claude"], "mcp": { "enabled": true } }
```

`sync` then adds one entry, `ambykit`, to each enabled assistant's MCP config, keeping every other key and
server in that file as you wrote it (the file is backed up under `.amby/backups/` before it changes). The
server is started as `ambykit mcp`, so `ambykit` must be on your `PATH`; AmbyKit never writes an `npx` fetch.

Only formats confirmed in the vendor's documentation are written (sources in
`specs/025-mcp-server/research.md`, rows in [`tool-compatibility.md`](../tool-compatibility.md)):

| Assistant | File | Written |
|---|---|---|
| Claude Code | `.mcp.json` (`mcpServers`) | with `mcp.enabled` |
| Copilot (VS Code) | `.vscode/mcp.json` (`servers`) | with `mcp.enabled` |
| Cursor and Cursor CLI | `.cursor/mcp.json` (`mcpServers`) | with `mcp.enabled` |
| Antigravity CLI | `.agents/mcp_config.json` (`mcpServers`) | with `mcp.enabled` |
| Copilot CLI | `~/.copilot/mcp-config.json` (user level) | only with `ambykit sync --include-user`; never part of `sync --check` |
| OpenCode, Antigravity IDE, Codex and the rest | — | **not written**; `sync` names each one and why |

A config file that is not plain JSON (comments, trailing commas) is left untouched and reported.

## The tools

All inputs are validated and published through `tools/list`. `feature` is the number (`025`) or the
directory name. Failures are `{ "error": … }` naming what was not found.

| Tool | What it returns or does |
|---|---|
| `next_task` | The next unchecked task whose story is not blocked and that is not marked BLOCKED: `{ id, text, paths[], story }`, or `{ none }` |
| `story_status` | `{ story, status, priority, blockers[] }` from the dependency graph |
| `lane_tasks` | A lane's tasks and checked state, capped at 40 |
| `lane_status` | A lane's state, whether it is **stalled**, and its directive |
| `analyze_report` | The findings of `ambykit analyze`, sliced to a feature and capped |
| `tick_task` | Checks off one task (one changed line); releases that task's file claims |
| `set_story_status` | Sets one story's status; refuses values outside `draft ready in-progress blocked done` |
| `report_activity` | Records what the assistant is doing; returns a directive. Never fails the agent |
| `claim_file` | Claims files for a task; refused, naming the owner, when another worker holds an overlapping path |
| `post_note` | Posts one `T### \| files \| text` line to the run's notes board |

An answer to `next_task` or `story_status` is under 1 KB.

## Reporting and directives

A worker reports at the start of a task, at the end of a task, and whenever it is blocked or waiting. It
never reports on a timer and never reports progress. The reply carries a **directive** for its lane:
`continue`, `pause` or `stop`. On `pause` or `stop` the worker finishes the task it is on, then obeys at its
next report.

Any host can steer a lane through the same single writer:

```bash
ambykit directive 025 lane-1-1 pause    # or resume (writes continue) / stop
```

A directive status is derived, never stored: **pause requested**, **paused**, **pending** or **obeyed**.

## Runs and fleet state

Directives, claims, notes and the run record live in the **primary checkout** under
`.amby/fleet/<run>/` (git-ignored), so every lane worktree sees the same files. A run `<feature>.<n>` is
created only on explicit request; there is no implicit run. A report with no run still records the
activity marker and comes back with a warning, never a failure; with several unfinished runs the warning
names them and you pass `run`.

`fleet` in `.amby/config.json` holds the shared settings (defaults shown):

```json
{ "fleet": { "stallMinutes": 15, "restartLimit": 2, "concurrency": { "total": 3, "perType": 2 }, "roundLimit": 3 } }
```

A lane is **stalled** when its state is `working` and it has made neither a report nor a change to its
`tasks.md` for `stallMinutes`. That limit is the fleet's own and is independent of the dashboard's idle limit.

## Safety

- Edits are patches: `tick_task` and `set_story_status` change one line under a lockfile, re-parse the
  result with the same parsers every other command uses, and refuse anything that would not read back.
- The server speaks the protocol on stdout only; diagnostics go to stderr.
- It supports the `initialize` handshake of the 2024-11-05 to 2025-11-25 revisions and the handshake-free
  2026-07-28 revision (`server/discover`).
