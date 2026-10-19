# Changelog

All notable changes to AmbyKit are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release notes with full detail live on the
[GitHub releases page](https://github.com/ambystechcom/AmbyKit/releases).

## [Unreleased]

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

[Unreleased]: https://github.com/ambystechcom/AmbyKit/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/ambystechcom/AmbyKit/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/ambystechcom/AmbyKit/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/ambystechcom/AmbyKit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ambystechcom/AmbyKit/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/ambystechcom/AmbyKit/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ambystechcom/AmbyKit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ambystechcom/AmbyKit/releases/tag/v0.1.0
