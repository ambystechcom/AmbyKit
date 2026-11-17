# Contracts — MCP tools (025-mcp-server)

Inputs are validated with zod and published through `tools/list`. Every result is a short JSON object
in a text content item; failures are `{ "error": "<what was not found or invalid>" }` with
`isError: true`, except `report_activity`, which returns `{ "warning": … }` and is never an error.
`feature` accepts the number (`025`) or the directory name.

## Read tools

| Tool | Input | Output |
|---|---|---|
| `next_task` | `feature`, `lane?` | `{ id, text, paths[], story }`, or `{ none: "done" \| "all blocked", why }` |
| `story_status` | `feature`, `story` | `{ story, status, priority, blockers[] }` |
| `lane_tasks` | `feature`, `lane?` | `{ lane, tasks: [{ id, done, text }] }`, capped; `truncated: true` when sliced |
| `analyze_report` | `feature?` | same findings as `ambykit analyze --json`, sliced to the feature |
| `lane_status` | `feature`, `lane?`, `run?` | `{ lane, state, stalled, directive: { action, status } }` |

## Write tools

| Tool | Input | Output |
|---|---|---|
| `tick_task` | `feature`, `task` | `{ ticked: id }`; refuses unknown or already-checked ids; releases that task's claims |
| `set_story_status` | `feature`, `story`, `status` | `{ story, status }`; refuses values outside `draft\|ready\|in-progress\|blocked\|done`, listing them |

## Fleet tools

| Tool | Input | Output |
|---|---|---|
| `report_activity` | `feature`, `agent`, `phase`, `state`, `task?`, `lane?`, `run?` | `{ ack, directive: "continue\|pause\|stop", warning? }`; no `progress` input. No `run` and no unfinished run: a warning, nothing is created. Several unfinished runs: a warning naming them. Never fails the agent. |
| `claim_file` | `feature`, `task`, `files[]`, `worker`, `run?` | `{ claimed }` or `{ refused: { file, owner } }` |
| `post_note` | `feature`, `task`, `files[]`, `text`, `run?` | `{ posted }`; refuses a missing task id or any newline |

Tool descriptions state the protocol wording: the worker finishes its current task, then obeys a
`pause` or `stop` directive at its next report (FR-020). They also state the reporting cadence
(FR-013): report at task start, task end, and when blocked or waiting, never on a timer. The same wording
appears in the spec 019 worker prompt.

## CLI

- `ambykit mcp` — serve on stdio. stdout carries protocol messages only.
- `ambykit activity <feature> --agent= --phase= [--task=] [--lane=] [--state=] [--run=]` — as today when
  the new flags are absent; always exit 0.
- `ambykit directive <feature> <lane> pause|resume|stop [--run=<id>]` — writes the directive through
  `writeDirective` (file name uses the short lane form `lane-<p>-<k>`); refuses an unknown lane, naming
  it. This is the only writer; 019's wrapper, 028 and 029 call `writeDirective`.
