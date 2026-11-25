# claude on windows

> DRAFT for the owner's review (033 T063). Observed by the assistant on the owner's machine on 2026-11-25; the runner stays
> `verified: false` until the owner signs off below and sets `verified`, `verifiedOn: ["win32"]`, `verifiedVersion` and
> `verifiedRange` in `src/core/runners.ts`.

- **Runner:** claude
- **OS:** windows (Windows 11 Pro 10.0.26340, Node 24.4.0)
- **Assistant version:** 2.1.332 (Claude Code)
- **Invocation:** `claude -p --permission-mode acceptEdits --allowedTools "Bash(ambykit:*),PowerShell(ambykit:*)" --output-format json`, run in the lane directory; `claude` resolves to the native `claude.exe` in `%USERPROFILE%\.local\bin` (no `.cmd` shim on this install)
- **Prompt delivery:** stdin (the lane prompt from `lanePromptText`, about 800 characters)
- **Exit behaviour:** a finished turn exits 0 with `is_error: false`, `subtype: "success"`; a failed turn (unknown model) exits 1 with `is_error: true`, `terminal_reason: "api_error"`, zero usage. Exit 0 alone is not proof of work: with the 1.6 command (`claude -p` only) the turn exited 0 after every edit and `ambykit` call was refused, which is why the result JSON is now read.
- **Usage reported:** yes, in the final JSON object on stdout (`usage`, `modelUsage` per model, `total_cost_usd`); about 0.16 USD and 13 to 20 seconds for a one-file task
- **Checked by:** Claude (assistant) for Gustavo Barrientos, 2026-11-25; owner sign-off: pending

## What was run

Scratch project (not this repository): feature `001-hello`, two `[P]` tasks, `ambykit worktree` and `ambykit lane` gave two lanes.
`ambykit run` refuses an unverified runner, so each check ran the runner's own command (`RUNNERS` entry `invoke`) in a lane
directory, with the prompt `lanePromptText` builds, on stdin.

| # | Command | Result |
|---|---|---|
| 1 | 1.6's `claude -p` | exit 0 in 14 s, nothing done: file write, task tick and `ambykit activity` all needed approval |
| 2 | plus `--permission-mode acceptEdits --allowedTools "Bash(ambykit:*)" --output-format json` | exit 0 in 20 s, file written, task ticked; PowerShell `ambykit` calls denied (listed in `permission_denials`), Bash ones allowed; found the missing `--agent` in the worker prompt |
| 3 | this branch's runner command and worker prompt | exit 0 in 13 s, file written, task ticked, both `ambykit activity` reports accepted, `permission_denials` empty |
| 4 | `claude -p --model no-such-model-xyz --output-format json` | exit 1, `is_error: true`, `terminal_reason: "api_error"` |

Not yet observed: a full `ambykit run` session (supervisor, budget, merge) with this runner, because `run` launches only a verified
runner. That is the dogfood (031 T094, 033 T071) once the owner signs this record off.
