# claude on windows

> 033 T063. Observed by the assistant on the owner's machine on 2026-11-25 and signed off by the owner the same day.
> `src/core/runners.ts` records it: `verified: true`, `verifiedOn: ["win32"]`, `verifiedVersion: "2.1.332"`,
> `verifiedRange: ">=2.1.332 <3.0.0"`. Linux and macOS are not verified: the runner is refused there until a record exists.

- **Runner:** claude
- **OS:** windows (Windows 11 Pro 10.0.26340, Node 24.4.0)
- **Assistant version:** 2.1.332 (Claude Code)
- **Invocation:** `claude -p --permission-mode acceptEdits --allowedTools "Bash(ambykit:*),PowerShell(ambykit:*)" --output-format json`, run in the lane directory; `claude` resolves to the native `claude.exe` in `%USERPROFILE%\.local\bin` (no `.cmd` shim on this install)
- **Prompt delivery:** stdin (the lane prompt from `lanePromptText`, about 800 characters)
- **Exit behaviour:** a finished turn exits 0 with `is_error: false`, `subtype: "success"`; a failed turn (unknown model) exits 1 with `is_error: true`, `terminal_reason: "api_error"`, zero usage. Exit 0 alone is not proof of work: with the 1.6 command (`claude -p` only) the turn exited 0 after every edit and `ambykit` call was refused, which is why the result JSON is now read.
- **Usage reported:** yes, in the final JSON object on stdout (`usage`, `modelUsage` per model, `total_cost_usd`); about 0.16 USD and 13 to 20 seconds for a one-file task
- **Checked by:** Claude (assistant) for Gustavo Barrientos, 2026-11-25; signed off by the owner (Gustavo Barrientos), 2026-11-25, range `>=2.1.332 <3.0.0`

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
| 5 | a full `ambykit run 001 --assistant=claude --unattended --yes` session (branch `fix/run-sequential`: stages, allowed check commands, `--add-dir` for reviewers, run commits lane work) | stage 1 (T001+T002, one serial lane) and stage 2 (T010, T011, two parallel lanes) each built, reviewed by QA and architect (verdicts read), committed and merged; feature checkout clean, all four tasks ticked; about 0.61 USD for the workers plus the reviews |

Run 5 is a full supervised session on a scratch project (stages, reviews, budget, commit and merge). The dogfood (031 T094, 033 T071) is the same on this repository.
