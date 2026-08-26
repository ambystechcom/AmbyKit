# Changelog

All notable changes to AmbyKit are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release notes with full detail live on the
[GitHub releases page](https://github.com/ambystechcom/AmbyKit/releases).

## [Unreleased]

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

[Unreleased]: https://github.com/ambystechcom/AmbyKit/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/ambystechcom/AmbyKit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ambystechcom/AmbyKit/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/ambystechcom/AmbyKit/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ambystechcom/AmbyKit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ambystechcom/AmbyKit/releases/tag/v0.1.0
