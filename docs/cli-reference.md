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
- Narrow terminals: the dashboard drops lower-priority columns rather than wrapping.
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

## `ambykit restore [file]`

Recover an agent-doc file (`AGENTS.md`, `CLAUDE.md`, a tool's rules file) from the timestamped backup
AmbyKit writes to `.amby/backups/` before modifying it. With no argument, lists the backups available
to restore (newest first).

```bash
ambykit restore                 # list available backups
ambykit restore CLAUDE.md       # restore the most recent backup of CLAUDE.md
ambykit restore CLAUDE.md --dry-run
```

## `ambykit dashboard [story-id]`

Progress view over the story/task graph, computed locally from `specs/*/spec.md` + `tasks.md` (no
model tokens).

- **No arg** — a table of all user stories: `Feat | Story | description | X of Y tasks | % | status | priority | blocked-by`, with an overall roll-up.
- **`story-id`** — detail for one story. Story ids **restart per feature**, so a bare `US-3` may
  match several; qualify it with the feature ref as `NNN:US-3` (also accepts `NNN/US-3`). A bare id
  that matches more than one feature prints the matches so you can pick.
- **`--interactive`** — opt-in full-screen navigable view (TTY only): `↑`/`↓` move, `enter` opens a
  story's tasks, `←`/`esc` goes back, `q` quits. On a non-interactive terminal it falls back to the
  one-shot table.

```bash
ambykit dashboard
ambykit dashboard --interactive   # full-screen navigable view (TTY only)
ambykit dashboard 001:US-3        # feature-qualified (recommended)
ambykit dashboard --status blocked
ambykit dashboard --feature 001-password-reset
ambykit dashboard --json
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
installed. Reports drift between the neutral source and emitted files.

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
