# CLI reference

`@ambystech/ambykit`, bin name `ambykit`. Run via `npx @ambystech/ambykit <command>` or install and
use `ambykit <command>`.

## Global flags

- `--verbose` — detailed logging.
- `--dry-run` — show what would change without writing files.
- `--yes` — assume yes for prompts (non-interactive); skips interactive tool selection.

## Terminal output

The CLI adapts its output to your terminal. It colorizes and uses box-drawing glyphs on an
interactive terminal, and **degrades cleanly** everywhere else so logs and pipes stay readable:

- Piped / redirected / non-interactive (CI): plain text, no color, no control sequences.
- `NO_COLOR` set: color is dropped (glyphs and words remain).
- Terminals without extended glyphs: an ASCII fallback (`[ok]`/`x`, `#`/`-` bars) is used.
- Narrow terminals: the dashboard switches to a stacked layout (and plain text below 60 columns),
  and tables drop lower-priority columns rather than wrapping.
- `--json` output is always unstyled and byte-stable — safe to parse.

Multi-step commands (`init`, `add`, `sync`, `update`) show a spinner while working and a
created/updated/unchanged/skipped summary when done.

When a newer AmbyKit is published, an interactive command shows a yellow **"Update available"** callout
between the banner and its output, naming your installed and the latest version. It's suppressed on
non-interactive terminals and under `--json`, checks the registry at most once a day, and never blocks
on network failure. Run [`ambykit update`](#ambykit-update) to upgrade.

## `ambykit init [dir]`

Scaffold AmbyKit in a project. Creates `.amby/` (constitution + `config.json`) and `specs/`, detects
installed assistants, lets you select targets, emits their native files, and writes the shared
`AGENTS.md` (+ `CLAUDE.md` bridge for Claude Code).

**Brownfield-safe.** `init` detects whether a project already exists (an existing rules file,
non-AmbyKit source files, or a git history) and reports the mode. For rules files it **merges** rather
than overwrites: existing content is preserved and only AmbyKit's `### AmbyKit usage` section is
added/updated in place. An existing file is backed up to `.amby/backups/` before it is changed, and a
section you hand-edited is left untouched (reported as skipped). Use `--dry-run` to preview.

```bash
npx @ambystech/ambykit init
npx @ambystech/ambykit init . --yes
npx @ambystech/ambykit init --dry-run   # preview merges, write nothing
```

## `ambykit add <tool…>`

Add or refresh integration for one or more targets (see [tool compatibility](./tool-compatibility.md)
for target names). On an interactive terminal, running it with **no target** opens a multi-select
prompt (`space` toggle, `enter` confirm, `esc` cancel); non-interactively it errors with the list of
available targets instead of blocking. `init` behaves the same when `--tools` is omitted. The
selector scrolls when the list is taller than the terminal (`↑ n more` / `↓ n more`).

Target ids: `claude`, `claude-vscode`, `copilot`, `copilot-cli`, `opencode`, `cursor`, `cursor-cli`,
`antigravity`, `antigravity-cli`, `codex`, `gemini`, `llxprt`, `qwen`, `kilo`, `augment`, `windsurf`,
`kiro`, `pi`. Targets that share an emitter (for example `codex` and `pi`) write their files once;
`ambykit check` names the owners of each shared output.

```bash
ambykit add cursor claude
ambykit add                       # interactive tool picker (TTY only)
```

## `ambykit sync`

Re-emit all configured tools from the neutral source. Run after upgrading AmbyKit or editing
`.amby/` templates/prompts. Project-scoped files only by default; user-level MCP files are opt-in.

`sync` is also the **update path** for existing docs: it merges AmbyKit's section into each configured
tool's rules file non-destructively (same rules as `init` — preserve, back up, skip hand-edits), so
running it keeps your agent docs current without a full re-init.

```bash
ambykit sync
ambykit sync --dry-run
ambykit sync --prune-legacy
```

**Antigravity migration.** Antigravity retired workflows on 2026-10-19; the `antigravity` and
`antigravity-cli` targets now write skills (`.agents/skills/amby-*/SKILL.md`, the same files Codex and Pi
write). Workflow files that an earlier release generated at `.agents/workflows/amby.<phase>.md` are left
in place and reported; `--prune-legacy` backs each up under `.amby/backups/` and removes only the ones
that carry AmbyKit's generated notice (your own workflows are never touched; `ambykit restore <file>`
brings one back). `sync` never overwrites an existing skill file that AmbyKit did not generate. When
several targets write one skill file it is written once and reports one assistant id (`codex`, then
`antigravity`, then `antigravity-cli`).

Also installs any newly shipped templates, reference docs, and **roles** into `.amby/` (write-if-absent —
your edits are kept), warns when a role in `.amby/roles/` exceeds 150 words, and refuses to emit
when two roles share an id. Projects with roles get one native sub-agent per role for Claude Code,
OpenCode, and Copilot.

**Plugins (experimental).** `plugins` in `.amby/config.json` maps an `ambykit-emitter-*` package to the exact
version installed in the project's own `node_modules`; `sync` (and `check` and `add`) load only those, then
emit their targets like built-in ones:

```json
{ "tools": ["claude", "mytool"], "plugins": { "ambykit-emitter-mytool": "1.0.0" } }
```

`sync` prints each loaded plugin as `name@version` and an experimental note. A plugin that is missing,
mis-pinned, outside the plugin-API range, malformed, or that clashes with another target is reported by name
and skipped; the other targets still sync and `sync` exits **1**. A plugin file outside the project is refused;
a file in the home directory needs `--include-user` and is never part of `--check`. Without a `plugins` key
nothing is loaded and output is unchanged. A configured target that moved to a plugin gets a notice naming the
package (none have moved yet). See [`plugin-api.md`](./plugin-api.md), [`plugin-trust.md`](./plugin-trust.md)
and [`plugin-split.md`](./plugin-split.md).

Plugin authors test with `@ambystech/ambykit/testkit` (`checkEmitterContract`, `assertEmitterContract`, and the
`createPluginApi` helper), which checks an emitter's paths and frontmatter keys against a matrix row; a missing
row fails. The plugin API itself is `@ambystech/ambykit/plugin`.

## `ambykit restore [file]`

Recover an agent-doc file (`AGENTS.md`, `CLAUDE.md`, a tool's rules file) from the timestamped backup
AmbyKit writes to `.amby/backups/` before modifying it. With no argument, lists the backups available
to restore (newest first).

```bash
ambykit restore                 # list available backups
ambykit restore CLAUDE.md       # restore the most recent backup of CLAUDE.md
ambykit restore CLAUDE.md --dry-run
```

## `ambykit worktree <feature> | list | remove <feature>`

Per-feature **git worktrees** so several features can be worked on in parallel — by you or by
several assistants — without checkout switching. Each feature gets its own working copy at
`.worktrees/<feature>/` (gitignored) on branch `<feature>`, created from the repository's default
branch when the branch does not exist yet. Zero model tokens.

```bash
ambykit worktree 004-slug            # create .worktrees/004-slug on branch 004-slug
ambykit worktree list                # feature, branch, clean/dirty/merged, path
ambykit worktree remove 004-slug     # delete the working copy (branch is kept); --force if dirty
ambykit worktree 004-slug --dry-run  # show the git command without running it
```

Creating twice is a no-op; removing a missing one exits 0. `ambykit check` flags worktrees whose
branch is already merged. Opt in to automatic creation from `/amby.specify` by answering yes at
`ambykit init`, or set `"worktrees": true` in `.amby/config.json`. Inside a worktree, phases resolve
"the current feature" from the directory name.

## `ambykit lane <feature> | list | remove <feature> [<lane>] | merge <feature> [<lane>]`

**Parallel lanes**: split one phase's `[P]` tasks into isolated worktrees that cannot touch the same
files, then merge them back. Lane `k` of phase `p` is the worktree and branch
`.worktrees/<feature>.lane-<p>-<k>`, created from the feature branch. Each lane holds a manifest
(`.amby/lane/lane.json`, self-ignoring) listing only its tasks. Zero model tokens. Requires
`"worktrees": true` in `.amby/config.json`.

```bash
ambykit lane 015-slug                          # 2 lanes from the first phase with open [P] tasks
ambykit lane 015-slug --phase=3 --lanes=3      # choose the phase and lane count
ambykit lane list [015-slug]                   # tasks, done/total, clean/dirty/merged, drift
ambykit lane merge 015-slug [3-1]              # merge finished lanes into the feature branch
ambykit lane remove 015-slug [3-1] [--force]   # remove working copies (branches are kept)
```

Tasks are dealt round-robin in task order. Creating is refused when the phase has path conflicts
(see `ambykit analyze`) and is a no-op when the lanes already exist. `merge` runs in the feature's
checkout, which must be clean. Check-offs that land on adjacent `tasks.md` lines are resolved
automatically (a box is ticked if either side ticked it); any other conflict aborts that lane's merge
and leaves the checkout clean. `list` reports **drift** when a lane task is missing from, or has
different paths in, the feature's current `tasks.md`.

## `ambykit dashboard [story-id]`

Progress view over the story/task graph, computed locally from `specs/*/` files and, for the
burndown, read-only git history (no model tokens, no network, writes nothing).

**Worktrees.** The dashboard reads the primary checkout plus every feature worktree under
`.worktrees/` (see `ambykit worktree`), and shows the same numbers wherever you run it. A worktree
contributes only its own feature's directory, which replaces the copy on the default branch. Rows
read from a worktree carry a checkout tag (`⎇`, `⎇●` dirty, `⎇⊘` merged; `wt`, `wt*`, `wt merged` in
plain output), and a **Worktrees & agents** panel lists them. Projects without worktrees look
exactly as before. A worktree that can't be read is named in a notice line.

**Agents.** Assistants report the phase and task they are on with `ambykit activity` (the phase
prompts do this). The dashboard shows them as `● active` (activity in the last 2 minutes),
`○ idle` (30 minutes) or `– stale`. Change the thresholds with
`"dashboard": { "activeMinutes": 2, "idleMinutes": 30 }` in `.amby/config.json`. In
`--interactive` mode, running CLI agents are also detected from the process list and marked `~`.
Detection reads the process list only, never sends anything, and stops when you quit.

- **No arg** — the overview, top to bottom:
  - summary cards: features, stories, tasks done/total, overall completion;
  - **story status** stacked bar with a legend (each status has its own fill pattern and glyph, so
    it reads without color);
  - **Attention** — dependency cycles and unknown references first, then blocked stories (status
    `blocked`, or a `blocked-by` story that is not done), then stories waiting on an unfinished
    `depends-on`; then open tasks that carry a `BLOCKED` marker (kind `task-blocked`) and phases
    whose last recorded Verify result failed (kind `verify-failed`, keyed `<feature>:phase-N`);
  - **Up next** — the next undone tasks whose story is not in Attention (`--next=N`, default 5);
    tasks carrying a `BLOCKED` marker are left out;
  - **burndown** — remaining vs. done tasks per day/week/month from the git history of `tasks.md`
    (the last column is your working tree); shows "No history available" outside a git repo;
  - **feature completion** — one row per feature with its bar, workflow phase (specified → designed →
    planned → tasked → implementing → done) and open `[NEEDS CLARIFICATION]` count. A feature with no
    `tasks.md` reads "not planned". A feature with open `BLOCKED` tasks shows `N blocked` on its row
    as plain text, only when N is above zero.

  Unreadable files are skipped and named in a notice line. Off a TTY (pipes, CI) the same content is
  printed as plain text.
- **`--feature=X`** — the feature view for one feature (`X` is its number, e.g. `014`, or its
  directory name): artifacts present, open clarifications, status, the story table with a
  `Waiting on` column, and Attention / Up next / burndown scoped to the feature. The `tasks.md`
  artifact line ends with `verify <passed>/<total>` when phases carry a `**Verify:**` line, plus
  `, FAILED phase N` for each phase whose last result failed.
- **`--status=X`** — narrow every widget to stories with that status.
- **`--stories`** — the previous story table (`Feat | Story | description | progress | status |
  priority | blocked-by`) with an overall roll-up.
- **`story-id`** — detail for one story. Story ids **restart per feature**, so a bare `US-3` may
  match several; qualify it with the feature ref as `NNN:US-3` (also accepts `NNN/US-3`). A bare id
  that matches more than one feature prints the matches so you can pick. A task row ends with
  `BLOCKED: <reason>` and `DEVIATION: <note>` when the task line carries those markers.
- **`--interactive`** — the overview full screen (TTY only): `tab` moves focus between Attention, Up
  next, Worktrees & agents and Feature completion, `↑`/`↓` move, `enter` opens the feature view and,
  from there, the story detail (tasks, relations, checkout and agent). `esc` goes back (on the
  overview it clears the filters), `f` filters by feature, `s` cycles the status filter, `?` shows
  the keys and glyph legend, `q` quits. The screen is **live**: a change to any checkout's specs or
  activity markers repaints within a second, keeping your place and any filter you're typing. The
  header shows `● live · 3s ago`; where file watching is unavailable it polls every 2 s
  (`◌ polling`), and if monitoring fails it shows `⚠ live paused` and `r` retries. On a
  non-interactive terminal it prints the plain overview, and nothing is watched.
- **Fleet view** (`l` in `--interactive`) — the lanes of the current fleet run (`ambykit fleet`,
  `ambykit run`), live. Each lane is a row with its assistant, state (`working`, `waiting`, `blocked`,
  `paused`, `done`, `unreported`, `unknown`, always as a word as well as a glyph), quiet time and
  directive status (`continue pending`, `pause requested`, `paused`, `obeyed`). A working lane with no
  report and no `tasks.md` change for `fleet.stallMinutes` (default 15) carries the text
  `STALLED <n>m`. The header shows the run, phase and review stage once (`QA round 1/3`,
  `architect round 2/3`, `NEEDS A DECISION`) and `+N more runs` when other runs are unfinished; story
  checkpoint gates waiting for you are listed below the lanes. Keys: `↑`/`↓` select a lane, `p` pause,
  `u` continue, `x` stop (asks `y`/`n`), `P`/`U`/`X` do the same for every lane of the run (always with
  a `y`/`n` confirmation), `a` approves a waiting gate (`←`/`→` choose between several), `esc` goes
  back, `?` lists the keys. Pause, continue and stop are written as directives for the lane's worker,
  which obeys at its next report; approving a gate is the same action as `ambykit run approve` and
  writes no directive. Without a run the view says so. It reads local files only (no network, no model
  tokens) and is loaded only under `--interactive`.
- **`--icons=nerd|unicode|ascii`** — icon set. `nerd` (also `AMBYKIT_ICONS=nerd`) shows the
  worktree tag as the Nerd Font git-branch icon; agent icons stay Unicode. `ascii` uses tags like
  `[CC] Claude` and `wt`. The default is unicode when the terminal supports it. The setting can also
  live in `.amby/config.json` as `"dashboard": { "icons": "nerd" | "unicode" | "ascii" | "auto" }`
  (hand-edited, never written by the dashboard). Precedence: `--icons`, then `AMBYKIT_ICONS`, then
  `dashboard.icons`, then auto. A terminal without unicode is always ASCII. In the Fleet view `nerd`
  draws the same glyphs as `unicode`; every state also has a word.
- **`--json`** — the story list as JSON, unchanged from earlier releases.
- **`--json --overview`** — one object: `stories` (exactly the `--json` list) plus `summary`,
  `statusCounts`, `features`, `attention`, `upNext`, `burndown`, `issues` and the applied `filters`.
  Each feature has a `checkout`: `{ "kind": "main" }`, or
  `{ "kind": "worktree", "branch", "dirty", "stale" }`. A feature also has `blocked` (number of
  open tasks with a `BLOCKED` marker) and `verify` (`{ "verified", "failed", "missing" }` counts of
  phases); each key is omitted when it does not apply (`blocked` when zero, `verify` when the
  feature has no Verify lines). `attention` may contain items of kind `task-blocked` (key
  `<feature>:<task id>`) and `verify-failed` (key `<feature>:phase-N`, reason `verify failed: <why>`).
  When a fleet run is unfinished, the object also has `fleet` (run, feature, status, phase, stage,
  round, limit, needsDecision, `gates[]`, `lanes[]` with state, stalled, lastActivity and directive
  status, and `others[]`); without a run the key is absent, so the output is byte-identical to before
  (`specs/029-fleet-control-room/contracts/dashboard-json-fleet.md`). Bare `--json` is unchanged.

```bash
ambykit dashboard
ambykit dashboard --interactive          # full-screen overview (TTY only)
ambykit dashboard --feature=014          # feature view
ambykit dashboard --next=10              # longer Up next list
ambykit dashboard --status=blocked
ambykit dashboard --stories              # the story table
ambykit dashboard 001:US-3               # story detail (feature-qualified)
ambykit dashboard --json                 # story list
ambykit dashboard --json --overview      # story list + every aggregate
ambykit dashboard --interactive --icons=nerd
```

## `ambykit activity <feature>`

Records that an assistant started a phase on a feature, for the dashboard's agent presence. You
rarely run it yourself: the specify, design, plan, tasks, implement and converge prompts run it,
with `--agent` already set to the tool's id. It writes
`.amby/activity/<feature>.<agent>.json` in the checkout it runs in. The directory has its own
`.gitignore`, so markers never reach git. It never fails the assistant: an unknown feature or a
missing flag is a warning, and the exit code is always 0.

```bash
ambykit activity 017 --agent=claude --phase=implement --task=T014
```

For a fleet lane (feature 025) add `--lane=<lane>` (`lane-1-2`, `1-2` or the full name), `--state=working|waiting|blocked|paused|done`
and `--run=<id>`. A lane puts its short name in the marker's file name, `<feature>.<agent>~lane-1-2.json`, so two lanes of one
assistant never overwrite each other; the marker body gains `lane`, `state` and `run`. Without these flags the marker is
byte-for-byte what it was. It is the same core writer the `report_activity` MCP tool calls.

## `ambykit mcp`

Serves AmbyKit's state tools to an assistant over MCP on stdio (see [the MCP server](./concepts/mcp-server.md)). The assistant
starts it from the project root or a lane worktree; you do not run it by hand. stdout carries protocol messages only. Set
`"mcp": { "enabled": true }` in `.amby/config.json` and run `ambykit sync` to write each verified assistant's MCP config.

## `ambykit directive <feature> <lane> pause|resume|stop`

Tells a fleet lane to pause, resume (writes `continue`) or stop. The worker finishes its current task and obeys at its next
report. `--run=<id>` picks the run when several are unfinished. An unknown lane is refused by name. This is the one writer that
the prompts, the terminal and the dashboard all call.

```bash
ambykit directive 025 lane-1-1 pause
```

## `ambykit fleet <start|status|update|claim|release|note|directive> <feature>`

The helper `/amby.run` and its workers call, so every change to a run goes through one validated path. It
keeps no state of its own: runs, claims, notes and directives are the fleet state under `.amby/fleet/<run>/`,
and stall detection is the same one the dashboard uses.

```bash
ambykit fleet start 019 [--new]          # create run 019-...N; refuses when one is unfinished unless --new
ambykit fleet status 019 [--run=<id>] [--json] [--rebuild]
ambykit fleet update 019 --worker-start=lane-1-1 --assistant=claude --tasks=T001,T002
ambykit fleet update 019 --stage=qa | --phase=2 | --round=2 | --decision="<text>" | --done
ambykit fleet update 019 --pause[=<lane>] | --resume[=<lane>] | --stop[=<lane>]
ambykit fleet update 019 --overlap=squad --lanes=a,b --shared=<path> --writer=<path>:<lane> --order=a,b
ambykit fleet claim 019 T012 src/a.ts [--worker=<id>]   # refused, naming the owner, when held
ambykit fleet release 019 T012
ambykit fleet note 019 T012 --files=src/a.ts "one-line note"
ambykit fleet directive 019 lane-1-1     # prints continue, pause or stop
```

`start` creates nothing for a feature that is already done or whose spec, plan or tasks are missing or draft.
`status` prints the run, the next phase, each lane (state, idle time, directive, restarts left), free slots
under `fleet.concurrency`, and warnings: damaged state, a checked task that still holds claims, a lane edit
with no claim. `--rebuild` rewrites a missing or corrupt `run.json` from `tasks.md` and never touches checked
tasks. `--worker-start` is refused when no slot is free; `--restart` is refused after `fleet.restartLimit`
restarts, pausing the lane and asking a person. `--round` prints `retry` or `escalate` and, on `escalate`,
waits for a decision. Pause, resume and stop go through the same writer as `ambykit directive`.

## `ambykit run <feature>` (experimental)

Run a feature's **prepared lanes** headless: one assistant per lane, in that lane's worktree, supervised,
merged and reviewed, without a person at the keyboard. **Experimental in 1.6** (the flags and the runner
commands may change before it is stable in 2.0). Launching processes that edit code is the riskiest thing
AmbyKit does, so nothing starts without `--yes`, and an assistant without a **verified** runner is refused.

```bash
ambykit run 028                         # print the exact command for each lane, caps, budgets; launch nothing
ambykit run 028 --yes                   # print, then launch the lanes and supervise them to the end
ambykit run 028 --emit-script           # write launch.sh and launch.ps1 under .amby/fleet/028-....scripts/; launch nothing
ambykit run 028 --yes --assistant=claude,codex --unattended --max-minutes=90 --max-tasks=20
ambykit run --continue-run=028-ambykit-run.1 --yes   # continue a stopped or interrupted run
ambykit run --runners [--json]          # the headless runners, what each can do, and why one is not runnable
ambykit run approve|reject <run> [--gate=<id>] [--reason=<text>]
ambykit run approve <run> --reassign=lane-1-1:codex  # a person's approval to move a lane to another assistant
```

- **Prepare first.** `ambykit lane <feature>` creates the lanes; `run` never creates or removes them. It runs
  the prepared sets in ascending phase order and starts a run only on this explicit request, named
  `<feature>.<n>`. A second `run` on a feature with an unfinished run refuses and points at `--continue-run`.
- **What a lane gets.** Its task IDs, the artifacts by `@path` reference, the files it owns and the report
  protocol: nothing else is copied in. A restart lists only the tasks still unchecked.
- **Caps.** `fleet.concurrency` (default 3 in total, 2 of one assistant). Lanes beyond the cap start as slots free.
- **Stalls.** A lane with no report and no `tasks.md` change for `fleet.stallMinutes` (15) is stopped and restarted
  with its work preserved, up to `fleet.restartLimit` (2) times; then it pauses and a person decides. Waiting,
  blocked and paused lanes are never stalled. A lane moves to another assistant only with
  `approve --reassign`.
- **Review before merge.** A finished lane is reviewed by QA, then the architect, each launched as a process of the
  lane's assistant, using spec 019's verdict files (`verdicts/<lane>.<role>.<round>.json`). A failure goes back to
  the same lane's worker as finding IDs only; after `fleet.roundLimit` (3) failed rounds a person is asked. A
  lane whose phase **Verify** line failed is never merged.
- **Merges.** One lane at a time in name order, with the check-off-aware merge of `ambykit lane merge`. A real
  conflict pauses that merge and the run waits; resolve it by hand and the run carries on. A lane that ends with
  tasks open is `unfinished` and never merged.
- **Checkpoints.** When a prepared set completes a user story the run stops for `approve` (or `reject`) before
  the next set starts, unless `--unattended` was given (shown at start). The gate lives in `run.json` `gates[]`;
  the dashboard calls the same function. Non-parallel tasks of a phase are not run headless: the run reports
  them and pauses.
- **Budgets.** Wall-clock (default 120 minutes) and task events (twice the open tasks) are always enforced; a
  token ceiling (`--max-tokens`) only where the runner reports usage, and the run says so when it cannot. Going
  over stops launching, writes a `stop` directive for each running lane, records why, and terminates a lane that
  still has not reported after `fleet.stopGraceMinutes` (10).
- **Directives.** `ambykit directive` (or the dashboard, or `/amby.run`) pauses, resumes or stops a lane from any
  host; the worker finishes its task and obeys at its next report, and the run records it. Ctrl-C saves and
  exits; `--continue-run` carries on and repeats no completed task.
- **State** is `.amby/fleet/<run>/`, the same layout `/amby.run` uses, so either host can inspect, pause or
  continue the other's run. Nothing is written outside the project.

`run` uses the single `fleet` object in `.amby/config.json` (`stallMinutes`, `restartLimit`, `concurrency`,
`roundLimit`, `tickSeconds`, `budgets`, `workerModel`) and adds two keys: `stopGraceMinutes` and `runners` (the
assistants lanes are spread over, in order; default the configured `tools`). Both headless runners start
**unverified** (see the matrix in `docs/tool-compatibility.md`), so `--yes` refuses them until each has been
confirmed on a live install.

## `ambykit analyze`

Validate the story dependency graph, computed locally from `specs/` (no model tokens): detects
**cycles** and **dangling references** (structural errors), and reports **blocked** vs **buildable**
stories and **orphans** (stories with no tasks). Exits non-zero on structural errors, so it can gate
CI. Complements the generative `/amby.analyze` phase.

Also checks **lane ownership**: open tasks in the same phase that declare overlapping file paths,
where at least one is `[P]`, are reported as **Lane conflicts** (by task id and path) and exit
non-zero. Open tasks with no usable path, or a glob, are listed as warnings and do not affect the
exit code.

Also reports, as warnings only (the exit code never changes), what the task file says about itself:

- **Blocked tasks** — open tasks with a `BLOCKED: <reason>` marker, and **Deviations** — tasks with
  a `DEVIATION: <note>` marker. A `BLOCKED` marker with no reason, or on a checked task, is a
  **marker issue**.
- **Verify** — phases whose last recorded Verify result failed, and phases with no `**Verify:**`
  line (only for features that still have open tasks, grouped per feature in text). Phases are named
  `<feature>:phase-N`.

- **Test design** — for every feature that has a [`tests.md`](./artifacts/tests.md): unknown ids, requirements with no
  case and no reason, criteria with neither case nor flag, duplicate case ids, bad or missing manual reasons, more
  than 15 cases for a story and `[stale]` cases. Features without a `tests.md` print nothing.

In `--json` these are the keys `blockedTasks` (`feature`, `task`, `story`, `reason`), `deviations`
(`feature`, `task`, `note`), `markerIssues` (`feature`, `task`, `kind` `missing-reason` or
`checked-but-blocked` or `path-after-marker` (a `(file/path)` group after the marker), `message`) and `verifyIssues` (`feature`, `phase`, `title`, `kind` `missing`
or `failed`, `why` for failed). Each key is absent when it has no entries, so output for a project
without markers is unchanged.

Test design adds one more key, `testDesign`: `findings` (`feature`, `kind`, `message`, optional `ref` and `line`) and
`missing` (the features that have no `tests.md`). It is present only when at least one feature has a `tests.md`,
so a project without test design reports exactly what it did before.

```bash
ambykit analyze
ambykit analyze --json   # includes lanes.conflicts and lanes.declarations
                         # plus blockedTasks, deviations, markerIssues, verifyIssues, testDesign when present
```

## `ambykit graph [feature]`

Print the story and feature dependency graph, built once from `specs/` by the same code that `analyze`
and the dashboard use (no model tokens). A story's `depends-on`, `blocked-by` and `NNN:US-#`
references become **story edges** (kept as separate kinds); a story in feature A that depends on a story
in feature B gives a **feature edge** from A to B that records the story edges causing it. Dependencies
that name something that does not exist are **broken edges**; a dependency loop is a **cycle**. Both are
listed first and make the command exit **1**; otherwise it exits 0. With a feature (its number or
directory name) it shows only that feature and its direct neighbours, in both directions.

```bash
ambykit graph                # readable text
ambykit graph 023            # one feature and its direct neighbours
ambykit graph --json         # versioned machine shape (below)
ambykit graph --mermaid      # Mermaid flowchart: one subgraph per feature
```

`--mermaid`: `A --> B` means A depends on B, a dashed `A -.-> B` means A is blocked by B, and a thick
arrow joins two feature subgraphs for each feature edge. The syntax is checked structurally; paste it
into a Mermaid renderer to view it.

`--json` has `version` (`1`) and the keys below. Fields are only ever added, never removed or renamed
(see `specs/023-dependency-graph/contracts/graph-json.md`).

| Key | Contents |
| --- | --- |
| `nodes[]` | `id` (`NNN:US-#`), `feature` (directory), `story`, `title`, `status`, `priority` |
| `edges[]` | `from`, `to` (node ids), `kind` (`depends-on` or `blocked-by`) |
| `featureEdges[]` | `from`, `to` (feature directories), `via[]` (the causing story edges) |
| `broken[]` | `from`, `to` (as written), `kind`, `reason` (`unknown-story` or `unknown-feature`) |
| `cycles[]` | each cycle as an ordered list of node ids; a self-dependency is a cycle of one |

Output is the same for the same files whatever the directory order.

## `ambykit trace [feature] [--json] [--gate]`

Shows which requirements have tests, computed locally from `specs/` and your test files (no model
tokens, read-only). For each feature it lists every `FR-###` as covered (with the tests that cite it),
uncovered (with its text), or deliberately uncovered. It also lists **orphans** (tests citing an id that
exists in no spec), **ambiguous** bare ids, **skipped** tests that cite a requirement, and **uncited**
tests (no id in the name; the first 20 are shown, all are in `--json`). A feature argument is a number
or directory name and limits the report to that feature.

- `--json` prints the versioned shape in `specs/024-trace/contracts/trace-json.md`; fields are only
  ever added.
- `--gate` exits 1 when any requirement is uncovered, else 0. Without it `trace` always exits 0.
- A requirement left without a test on purpose is not counted uncovered by the gate. Record it as one
  line, `uncovered: FR-### — reason`, in the feature's `tests.md` (or, without a test design, in
  `spec.md`).
- If a feature has a `tests.md` (spec 021), each designed `auto` case is reported `matched` or
  `missing` and each `manual` case is listed as `manual`.
- Tests are found as `*.test.*` / `*.spec.*` files under the project, skipping `node_modules`, `dist`,
  `coverage`, `.git`, `.worktrees`, `.amby` and `specs`. Override with
  `"trace": { "roots": ["src"], "ignore": ["fixtures"] }` in `.amby/config.json`.

### Citing requirements

A test covers a requirement when its name **begins** with the qualified id and a colon:

```ts
it("019:FR-004: rejects an empty name", () => { … });
it("019:FR-004, 020:FR-001: shared behavior", () => { … });   // several ids
```

- Use `NNN:FR-###` (feature number, then requirement). A bare `FR-004` never matches: it is reported
  ambiguous when several features define it, otherwise unqualified.
- An id anywhere but the start (`… (FR-004)`) does not cite. `skip`/`todo` tests never cover.
- Only `it`/`test` titles are read: an id in a `describe(...)` name does not cite the tests beneath it,
  and `.each` titles are not expanded.

## `ambykit check`

Doctor: verify integrations are present and well-formed and that expected assistant CLIs are
installed. Reports drift between the neutral source and emitted files, worktrees whose branch is
already merged, and role problems in `.amby/roles/` (oversized roles, duplicate ids, shipped
defaults that were deleted — `ambykit sync` reinstalls those).

## `ambykit update`

Update the AmbyKit CLI to the latest published version, then refresh this project's tool prompts.

When your CLI is **behind**, `update` installs the latest globally and asks you to **re-run** it — the
first run can only upgrade the CLI, and the re-run (now on the new version) regenerates the prompts. If
it can't self-update (an `npx` run, or a permissions error) it prints the exact `npm install -g`
command and leaves your install untouched. When the CLI is already current, it refreshes the configured
tools' files (a `.amby/` **and** `specs/` dir at the current directory); with nothing to do it prints
`Everything is up to date`.

```bash
ambykit update              # outdated: upgrades the CLI, then asks you to re-run
ambykit update              # current:  refreshes this project's tool prompts
ambykit update --dry-run    # preview the prompt refresh
```
