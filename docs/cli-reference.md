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
available targets instead of blocking. `init` behaves the same when `--tools` is omitted.

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
```

Also installs any newly shipped templates, reference docs, and **roles** into `.amby/` (write-if-absent —
your edits are kept), warns when a role in `.amby/roles/` exceeds 150 words, and refuses to emit
when two roles share an id. Projects with roles get one native sub-agent per role for Claude Code,
OpenCode, and Copilot.

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
    `depends-on`;
  - **Up next** — the next undone tasks whose story is not in Attention (`--next=N`, default 5);
  - **burndown** — remaining vs. done tasks per day/week/month from the git history of `tasks.md`
    (the last column is your working tree); shows "No history available" outside a git repo;
  - **feature completion** — one row per feature with its bar, workflow phase (specified → designed →
    planned → tasked → implementing → done) and open `[NEEDS CLARIFICATION]` count. A feature with no
    `tasks.md` reads "not planned".

  Unreadable files are skipped and named in a notice line. Off a TTY (pipes, CI) the same content is
  printed as plain text.
- **`--feature=X`** — the feature view for one feature (`X` is its number, e.g. `014`, or its
  directory name): artifacts present, open clarifications, status, the story table with a
  `Waiting on` column, and Attention / Up next / burndown scoped to the feature.
- **`--status=X`** — narrow every widget to stories with that status.
- **`--stories`** — the previous story table (`Feat | Story | description | progress | status |
  priority | blocked-by`) with an overall roll-up.
- **`story-id`** — detail for one story. Story ids **restart per feature**, so a bare `US-3` may
  match several; qualify it with the feature ref as `NNN:US-3` (also accepts `NNN/US-3`). A bare id
  that matches more than one feature prints the matches so you can pick.
- **`--interactive`** — the overview full screen (TTY only): `tab` moves focus between Attention, Up
  next, Worktrees & agents and Feature completion, `↑`/`↓` move, `enter` opens the feature view and,
  from there, the story detail (tasks, relations, checkout and agent). `esc` goes back (on the
  overview it clears the filters), `f` filters by feature, `s` cycles the status filter, `?` shows
  the keys and glyph legend, `q` quits. The screen is **live**: a change to any checkout's specs or
  activity markers repaints within a second, keeping your place and any filter you're typing. The
  header shows `● live · 3s ago`; where file watching is unavailable it polls every 2 s
  (`◌ polling`), and if monitoring fails it shows `⚠ live paused` and `r` retries. On a
  non-interactive terminal it prints the plain overview, and nothing is watched.
- **`--icons=nerd|unicode|ascii`** — icon set. `nerd` (also `AMBYKIT_ICONS=nerd`) shows the
  worktree tag as the Nerd Font git-branch icon; agent icons stay Unicode. `ascii` uses tags like
  `[CC] Claude` and `wt`. The default is unicode when the terminal supports it.
- **`--json`** — the story list as JSON, unchanged from earlier releases.
- **`--json --overview`** — one object: `stories` (exactly the `--json` list) plus `summary`,
  `statusCounts`, `features`, `attention`, `upNext`, `burndown`, `issues` and the applied `filters`.
  Each feature has a `checkout`: `{ "kind": "main" }`, or
  `{ "kind": "worktree", "branch", "dirty", "stale" }`.

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

## `ambykit analyze`

Validate the story dependency graph, computed locally from `specs/` (no model tokens): detects
**cycles** and **dangling references** (structural errors), and reports **blocked** vs **buildable**
stories and **orphans** (stories with no tasks). Exits non-zero on structural errors, so it can gate
CI. Complements the generative `/amby.analyze` phase.

```bash
ambykit analyze
ambykit analyze --json
```

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
