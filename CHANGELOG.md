# Changelog

All notable changes to AmbyKit are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release notes with full detail live on the
[GitHub releases page](https://github.com/ambystechcom/AmbyKit/releases).

Plugin authors: a line that starts with `[plugin-api]` changes the plugin API or something plugins depend on.
Every release states whether plugins are affected, with such a line or with "Plugins: not affected."
(see `docs/plugin-api.md`).

## [Unreleased]

Plugins: not affected.

### Added

- Spec format v2 (feature 030, **breaking in 2.0**): a spec's story data (priority, status, `depends-on`, `blocked-by`) lives
  in the frontmatter `stories:` list, headings carry the title only, and each `tasks.md` phase ends with one `yaml` block
  holding `files:` (what each task owns) and `verify:` (the phase's check and last result). Both files carry `format: 2`.
  Prose, checkboxes, `[P]`/`[US#]` tags and the `⚠ BLOCKED:` / `↪ DEVIATION:` markers are unchanged. 2.0 reads 1.x and v2
  files side by side, per file, including old revisions read from git history and other branches.
- `ambykit migrate [feature] [--dry-run] [--diff] [--dual-write]` converts 1.x specs and task lists without rewriting prose. A
  file that is not provably safe is left untouched and listed with the fix, every conversion is read back before it is
  written, each file is written once (temp file, then rename) after checking nobody edited it, and a second run changes
  nothing. `--dual-write` keeps the 1.x lines beside the v2 data for tools still on 1.x. See `docs/migration.md`: a 1.x
  AmbyKit reads a v2 file without an error but loses statuses, dependencies, ownership and Verify results.
- `ambykit edit files|verify|status` sets a task's files, a phase's Verify result or a story's status in the right place for
  the file's format (1.x and v2), reads the file back, and refuses an unknown task, story or phase, an invalid status or
  result, or a glob path. The phase prompts use it, so nobody hand-edits the YAML.
- A feature can declare `depends-on: [019, 023-dependency-graph]` in its frontmatter: `ambykit graph` shows the declared
  edges (JSON `declared`, text, Mermaid) and `ambykit analyze` reports a name that matches no feature.
- `ambykit analyze` lists located problems in v2 files (file, line, kind) as `Spec format issues`; `--json` gains an
  optional `formatIssues` key. Errors exit 1; warnings never change the exit status.
- `.amby/config.json` gets a `schemaVersion` (2); a config without one is read as version 1 and only `migrate` upgrades it,
  keeping every setting. A newer or unparseable config is left unmodified and reported.

### Changed

- **Node 22 or newer** (breaking): `engines` is `>=22`, CI no longer runs Node 20, and the `bin` entry checks the version
  before the CLI loads, so an older Node exits with a message naming the required version.
- Commands that read 1.x files print one line on stderr (once per run, never in `--json`) with the count and how to migrate;
  silence it with `"legacyWarning": false` in `.amby/config.json` or `AMBYKIT_LEGACY_WARNING=0`. `ambykit check` lists the
  features still on 1.x. From 2.1 1.x files are no longer read.
- The spec and tasks templates and the `/amby.specify`, `/amby.tasks`, `/amby.implement`, `/amby.revise`, `/amby.converge` and
  `/amby.run` prompts and the worker persona write v2 for new features and change statuses and Verify results through
  `ambykit edit`; `/amby.converge` is also granted `ambykit edit` in Claude Code.
- A migrated task's description no longer ends with its `(file/path)` group, so the dashboard's "Up next" lines and the
  `upNext` descriptions in `--json --overview` show the description alone.

## [1.6.0] — 2026-11-18

Plugins: not affected.

### Added

- `ambykit run <feature>` (feature 028, **experimental**): run a feature's prepared lanes headless, one
  assistant per lane in its own worktree. Without `--yes` it prints the exact command for each lane and
  launches nothing; `--emit-script` writes `launch.sh` and `launch.ps1`; only a verified runner is ever
  launched, and both runners start unverified (`ambykit run --runners`, matrix in
  `docs/tool-compatibility.md`). The run starts lanes under `fleet.concurrency`, restarts stalled lanes
  (`laneStatus`, up to `fleet.restartLimit`, then asks a person; moving a lane to another assistant needs
  `approve --reassign`), reviews each finished lane with QA then the architect before merging (the verdict
  files of `/amby.run`, bounded by `fleet.roundLimit`), merges one lane at a time, pauses on a real conflict,
  never merges a lane whose Verify line failed, stops at story checkpoints until `ambykit run approve` (or
  `--unattended`), and enforces wall-clock and task-count budgets (a token ceiling only where the runner reports
  usage). `--continue-run` carries on a stopped or interrupted run and repeats no completed task. State is
  `.amby/fleet/<run>/`, shared with `/amby.run`. The check-off-aware lane merge is now a core function shared
  with `ambykit lane merge`, and the `fleet` config gains `stopGraceMinutes` and `runners`.

## [1.5.0] — 2026-11-16

### Added

- `[plugin-api]` Emitter plugins (feature 027, **experimental** until 2.0): list a package named
  `ambykit-emitter-<name>` with an exact version under `plugins` in `.amby/config.json`, and `ambykit sync`
  loads it from the project's own `node_modules` and emits its targets like built-in ones. Nothing unlisted,
  unpinned or version-mismatched is ever loaded; a plugin that fails is reported by name, the other targets
  still sync, and `sync` exits 1. Plugin files must stay inside the project; files in the home directory need
  `--include-user`. Authors import `BaseEmitter`, `SkillsEmitter` and `TomlCommandEmitter` from
  `@ambystech/ambykit/plugin`, declare `"ambykit": { "pluginApi": "^1" }`, and test against their host's
  matrix row with `@ambystech/ambykit/testkit`. Projects with no `plugins` key behave exactly as before. No
  built-in target moves to a plugin in this release. Plugins: this is the first release of the API.
- `/amby.run` (feature 019): the 13th phase. The assistant you call it from is the lead: it starts worker
  subagents (`amby-worker`, write-capable; the review roles stay read-only), gives each only its task IDs, file
  ownership and artifacts by reference, then runs QA (the phase's Verify line, acceptance criteria and the
  `tests.md` cases) and an architect review before a phase passes. A failed review returns only finding IDs to
  the same worker; at the round limit (default 3) the lead stops and asks. State is plain files under
  `.amby/fleet/<feature>.<n>/`, so a run resumes in a new session, and pause, resume and stop are directives
  workers obey at their next report. Assistants without verified subagent support get the same prompt and the
  lead does every step in sequence. `ambykit fleet start|status|update|claim|release|note|directive` is the thin
  helper the prompt calls. Worker files are emitted for Claude Code, OpenCode and Copilot.
- AmbyKit as an MCP server (feature 025): `ambykit mcp` serves state tools over stdio so an assistant asks for
  state instead of reading files: `next_task`, `story_status`, `lane_tasks`, `lane_status`, `analyze_report`,
  validated one-line writes `tick_task` and `set_story_status`, and `report_activity`, `claim_file` and
  `post_note` for fleets. Opt-in with `"mcp": { "enabled": true }`; `ambykit sync` then adds an `ambykit` entry
  to Claude Code (`.mcp.json`), Copilot (`.vscode/mcp.json`), Cursor and Cursor CLI (`.cursor/mcp.json`) and
  Antigravity CLI (`.agents/mcp_config.json`), and, only with `--include-user`, the Copilot CLI's user-level file.
  Existing keys are preserved and a file with comments is left alone. OpenCode, the Antigravity IDE and the other
  targets are not written (their MCP format is unconfirmed); `sync` says which and why. Every phase still works from
  files when the server is absent.
- Fleet state foundation (feature 025): a `fleet` config object (`stallMinutes` 15, `restartLimit` 2,
  `concurrency`, `roundLimit`), the run record `.amby/fleet/<run>/run.json`, per-lane directives, file claims and a
  notes board in the primary checkout, and a single stall check for lanes. `ambykit directive <feature> <lane>
  pause|resume|stop` steers a lane from any host; the worker obeys at its next report.
- `ambykit activity` gains `--lane`, `--state` and `--run`: a lane's marker is `<feature>.<agent>~lane-p-k.json`, so
  two lanes of one assistant no longer overwrite each other. Without the flags the marker is unchanged.

## [1.4.0] — 2026-11-16

Plugins: not affected.

### Added

- `ambykit trace [feature] [--json] [--gate]` (feature 024): a local, read-only matrix from each `FR-###` to
  the tests that cite it. A test cites a requirement by starting its name with `NNN:FR-###:`; the report
  lists uncovered requirements, orphans, ambiguous bare ids, skipped and uncited tests, designed cases
  from `tests.md`, and `uncovered: FR-### — reason` notes. `--gate` exits 1 on uncovered requirements.
  `/amby.converge` now starts from the trace matrix, and Claude Code grants prompts a scoped shell for
  each `ambykit <verb>` they run. The dashboard shows coverage per feature next to task progress.
- Blocked markers and Verify lines (feature 020): a task line can end with `⚠ BLOCKED: <reason>` and an
  optional `↪ DEVIATION: <note>` (the glyph-less `BLOCKED:` and `DEVIATION:` forms are read the same),
  and each `tasks.md` phase ends with one `**Verify:**` line that `/amby.implement` runs before the
  checkpoint and marks with a result suffix: `✓ passed`, `✗ failed: <why>` or `? unverified`. The tasks
  template and `/amby.tasks` now emit a Verify line per phase.
- `ambykit dashboard` and `ambykit analyze` surface blocked tasks, deviations, marker problems, and
  phases that lack a Verify line or whose last Verify failed, at zero model tokens. Blocked tasks leave
  the dashboard's "Up next" list, the feature chart and feature view show plain-text counts, and
  `analyze` reports the new findings as warnings that never change its exit status.

- Test design before code (feature 021): `/amby.tasks` also writes `tests.md` in the same phase, one case per
  acceptance criterion with an automate-or-manual decision (manual only for a reason from a fixed list), each
  citing its criterion `US-n#k` and `FR-###`, with a one-line `skipped: <reason>` form (`--skip-tests`).
  `/amby.implement` builds to the cases and names tests `NNN:FR-###`, `/amby.converge` treats them as the
  expected tests, and `/amby.revise` marks cases `[stale]` or `[obsolete]`. `ambykit analyze` checks each
  feature's `tests.md` at zero model tokens (warnings only).
- `ambykit graph [feature] [--json] [--mermaid]` (feature 023): one story and feature dependency graph built from
  `specs/`, shared by `analyze` and the dashboard so all three name the same blockers. Broken references and
  cycles are listed first and exit 1. The interactive dashboard opens a graph view with `g`.
- Decision records (feature 022): `/amby.decide` writes a numbered record `.amby/decisions/ADR-###.md`
  (context, decision, alternatives, consequences) and patches the index, from any phase. It points to an
  existing record instead of duplicating one, keeps a decision that conflicts with a constitution principle
  `proposed`, and `--supersede ADR-###` marks the old record superseded on both sides. Cite decisions as
  `ADR-###`. A seventh read-only role, `security`, is installed for `/amby.review --as security`.

### Changed

- `ambykit analyze` checks decision records at zero model tokens and adds a `decisions` key to `--json`, only
  when records or `ADR-###` citations exist. A citation with no record, a supersede mismatch or loop, and an
  accepted record with a conflict are errors (exit status 1); a record missing from the index is a warning.

- `ambykit analyze --json` gains `testDesign` (`findings` and `missing`), present only when a feature has a
  `tests.md`. The `tests.md` template is installed into `.amby/templates/` by `ambykit sync`.
- The `--json` output of `dashboard --overview` and `analyze` gains new optional keys (`blockedTasks`,
  `deviations`, `markerIssues`, `verifyIssues`, and per-feature `blocked` and `verify`), present only when
  they have content. Existing keys are unchanged, and every existing `tasks.md` is read exactly as before.

## [1.3.1] — 2026-11-04

### Added

- Parallel lanes (feature 015): task lines declare the files they own, `ambykit analyze` reports
  lane conflicts (same phase, overlapping paths, at least one `[P]`) and exits non-zero, and
  `ambykit lane` splits a phase's `[P]` tasks into isolated worktrees, then lists, merges and removes
  them. Check-off-only `tasks.md` conflicts merge automatically. Lane progress shows in the
  dashboard's WORKTREES & AGENTS panel and in `--json --overview`, and counts toward the feature.
- Eight more assistants (feature 016): Gemini CLI and LLxprt Code (TOML commands), Qwen Code, Kilo
  Code and Augment Code (Markdown commands), Windsurf (workflows), Kiro (skills) and Pi (shares the
  Codex output), for eighteen selectable targets. Only formats documented by the vendor are emitted;
  Amazon Q is out of scope because it is now Kiro CLI.
- The target selector scrolls when the list is taller than the terminal.
- `ambykit check` names the owners of outputs shared by several targets.
- The dashboard recognizes the new assistants (glyph, color and process detection).
- `ambykit sync --prune-legacy` backs up and removes the workflow files that earlier releases generated
  for Antigravity (feature 018). Without it they are left in place and reported by `sync` and `check`.

### Changed

- Shared output is written once, and two targets that would write different contents to one path now
  fail with an error naming both, instead of the last one silently winning. Antigravity IDE and CLI,
  which differ only in their self-report id, keep the old behavior.
- **Antigravity IDE and CLI now emit skills** at `.agents/skills/<name>/SKILL.md` instead of
  `.agents/workflows/*.md`, which Antigravity stopped running on 2026-10-19 (feature 018). Existing
  `.agents/workflows/amby.*.md` files are not deleted unless you pass `--prune-legacy`. The files are
  shared with Codex and Pi and are written once, reporting `codex`, then `antigravity`, then
  `antigravity-cli`. In the CLI the phases appear as `/amby-specify` and so on.
- Skill files (Codex, Kiro, Pi, Antigravity) are never overwritten when the existing file was not
  generated by AmbyKit; `sync` reports it and `check` fails until it is moved.

## [1.3.0] — 2026-10-26

Live dashboard: worktree-aware, realtime, with agent presence.

### Added

- The dashboard reads every feature worktree under `.worktrees/` (feature 017), so progress made in
  a worktree shows from any checkout. Worktree rows carry a checkout tag (`⎇`, dirty `●`, merged
  `⊘`), a **Worktrees & agents** panel lists them, and `--json --overview` adds a `checkout` to each
  feature. Projects without worktrees look as before.
- `ambykit dashboard --interactive` is live: changes to any checkout's specs repaint within a second,
  keeping your place and any filter you're typing. Falls back to polling where file watching is
  unavailable; `r` retries if monitoring pauses.
- Agent presence: the new `ambykit activity` command records which assistant is on which feature
  and phase. Interactive mode also detects running CLI agents (Claude Code, Codex, OpenCode, Copilot
  CLI, Cursor CLI) from the process list.
- New interactive screens: story detail (tasks, relations, checkout and agent), a `?` help overlay,
  and empty states.
- `--icons=nerd|unicode|ascii` (or `AMBYKIT_ICONS`): Nerd Font mode shows the worktree tag as a
  git-branch icon.

### Changed

- **Phase prompts now self-report.** The specify, design, plan, tasks, implement and converge
  commands run `ambykit activity …` with the tool's id. Run `ambykit update` to pick this up; the
  step's errors are ignored, so assistants without `ambykit` on PATH are unaffected. In Claude Code,
  phases without shell access are granted only `Bash(ambykit activity:*)`.
- The interactive story view is replaced by the new story detail screen.

### Fixed

- Faster worktree resolution: git state is read concurrently, keeping one-shot output under 1 s
  with 10 worktrees on Windows.

## [1.2.0] — 2026-10-18

Dashboard overview: widgets, charts, attention, up next, and burndown.

### Added

- `ambykit dashboard` overview (feature 014): summary cards, a story-status chart, an Attention panel
  (blocked/waiting stories and dependency-graph problems), an Up next list of ready tasks
  (`--next=N`), a burndown from the git history of `tasks.md`, and a per-feature completion chart
  with workflow phase and open clarifications. Wide, narrow and plain (non-TTY) layouts; 24-bit
  color when the terminal advertises it.
- `ambykit dashboard --feature=X` feature view: artifacts, open clarifications, status, and the story
  table with a `Waiting on` column.
- `ambykit dashboard --json --overview`: the `--json` story list plus every aggregate.

### Changed

- **`ambykit dashboard` with no flags now shows the overview instead of the story table.** The table
  is still available as `ambykit dashboard --stories`; `--json` output is unchanged.
- `ambykit dashboard --interactive` opens the full-screen overview (feature view and story detail
  are reachable from it); off a TTY it prints the plain overview.
- The overview skips unreadable spec/task files and names them instead of failing.

## [1.1.1] — 2026-09-11

Packaging fix.

### Fixed

- `ambykit init` failed with `ENOENT` on `src/roles/pm.md` when installed from npm: the default
  role files were missing from the published package. A test now checks the packed tarball for
  every runtime asset.

### Changed

- The npm package now also ships `LICENSE`, `CHANGELOG.md`, and `docs/`.

## [1.1.0] — 2026-08-26

Converge, worktree isolation, and multi-agent roles.

### Added

- **`/amby.converge` phase** — checks the codebase against every `FR-###`, `SC-###`, plan decision,
  and checked-off `T###`, classifying each as covered, gap, or unverified. Appends one unchecked
  task per gap under a `## Convergence` section in `tasks.md` (`[VERIFY]` for inconclusive items)
  and marks fully covered stories `done`. Append-only and idempotent; cannot edit source.
- **`ambykit worktree`** — per-feature git worktrees (`create` / `list` / `remove`) so several
  features, or several assistants, progress side by side without checkout switching. `.worktrees/`
  is added to `.gitignore` automatically; `ambykit check` flags worktrees whose branch is merged.
- **Multi-agent roles** — each phase acts as a role defined in `.amby/roles/<id>.md` (Product
  Manager, UX Designer, Architect, Tech Lead, Developer, QA), shipped as editable defaults.
  `--as <id>` gives any phase a one-run alternative perspective. Roles are emitted as native
  sub-agents for `.claude/agents/`, `.opencode/agents/`, and `.github/agents/`.
- **`/amby.review`** — has a different role critique an artifact, returning findings keyed by stable
  ID with severity and a suggested fix. Read-only unless `--apply`. Advisory; no phase waits on it.

### Changed

- `ambykit sync` warns when a role exceeds 150 words and refuses duplicate role ids.

## [1.0.0] — 2026-07-21

First stable release.

### Added

- **Brownfield support** — `ambykit init` is non-destructive. An existing `CLAUDE.md` / `AGENTS.md`
  is preserved; AmbyKit adds and updates only its own `### AmbyKit usage` section, idempotently,
  writing a timestamped backup under `.amby/backups/` first. Hand-edited AmbyKit sections are left
  untouched and reported as skipped.
- **`ambykit restore [file]`** — rolls an agent-doc file back from its backup.
- **`--dry-run`** — preview any run.
- **`/amby.revise` phase** — continues an existing feature's spec (or `ui.md`) in place, adding and
  refining stories, requirements, and success criteria while preserving every stable ID. Makes no
  edits when the spec is already `done`.
- **`ambykit update`** — updates the CLI, then refreshes the project's generated prompts. An
  outdated-version callout is backed by a 24h cached registry lookup that never blocks the hot path.

### Changed

- `src/cli` reorganized: UI and IO grouped, `emit` moved to `core`.
- Docs cover the full nine-phase workflow and all eight CLI verbs; the docs-sync checker now keeps
  the README, `docs/`, the workflow overview, and `AGENTS.md` from drifting.
- `codex` added to the package keywords.

## [0.2.0] — 2026-07-13

### Added

- **OpenAI Codex CLI target** — `ambykit init` / `ambykit sync` emit Codex-native files: the
  `skills` command surface (`.agents/skills/amby-*/SKILL.md`) plus a native `AGENTS.md` rules file.
  `$ARGUMENTS` is rewritten to free-text prose, since Codex skills have no placeholder convention.

### Fixed

- Cross-platform path handling in `src/core/paths.ts` and `src/cli/fsops.ts`, so emitted paths and
  fs operations behave on Windows as well as POSIX. CI matrix extended to cover it.

## [0.1.1] — 2026-07-11

Packaging fixes.

## [0.1.0] — 2026-07-11

Initial release: the enhanced terminal UI and the AmbyKit documentation site.

[Unreleased]: https://github.com/ambystechcom/AmbyKit/compare/v1.3.1...HEAD
[1.3.1]: https://github.com/ambystechcom/AmbyKit/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/ambystechcom/AmbyKit/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/ambystechcom/AmbyKit/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/ambystechcom/AmbyKit/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/ambystechcom/AmbyKit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ambystechcom/AmbyKit/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/ambystechcom/AmbyKit/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ambystechcom/AmbyKit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ambystechcom/AmbyKit/releases/tag/v0.1.0
