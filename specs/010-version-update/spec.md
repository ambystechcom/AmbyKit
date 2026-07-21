---
feature: 010-version-update
title: Outdated-version warning + `update` command
branch: 010-version-update
status: ready
created: 2026-07-20
---

# Spec — Outdated-version warning + `update` command

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Users can silently run a stale AmbyKit and miss fixes or prompt improvements. This feature (1) warns
when the installed CLI is behind the latest published version — a prominent callout shown between the
banner and the command output — and (2) adds an `update` command that brings the CLI to the latest
version and, when run inside an AmbyKit project, refreshes that project's emitted tool prompts. When
nothing is out of date, it reports "Everything is up to date." The warning callout reuses the
capability-aware TUI layer (color/box when supported, plain text otherwise); prompt refresh reuses the
author-once / emit-per-tool pipeline (Principle 1) rather than duplicating emit logic (Principle 2).

## User scenarios & testing

<!-- One block per story. Each story is independently testable and prioritized. -->

### US-1 — Warn when running an outdated CLI  (priority: P1)

As an AmbyKit user, I want a clear warning when my installed CLI is older than the latest published
version, shown between the banner and the command's output, so that I know to update.

- **Why this priority:** Visibility is the core ask; a user on a stale version otherwise never learns
  a newer one exists.
- **Independent test:** With an installed version lower than the latest, run a command (e.g.
  `ambykit dashboard`); assert a distinct warning callout appears between the banner and the content,
  naming the installed and latest versions.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the installed version is older than the latest, When I run any banner-printing command, Then a
  highlighted warning callout appears between the banner and the content, naming both versions.
- Given the installed version equals (or exceeds) the latest, When I run a command, Then no warning
  appears.
- Given a terminal without color/box glyphs, When the warning would show, Then it degrades to plain
  text (consistent with the existing TUI degradation rules).
- Given a non-interactive terminal (non-TTY) or `--json` output, When a command runs, Then the warning
  is suppressed entirely.

### US-2 — `ambykit update` updates the CLI when outdated  (priority: P1)

As a user, I want an `update` command that upgrades the CLI to the latest published version when I'm
behind, so I can get current in one step.

- **Why this priority:** The primary action the warning drives the user toward.
- **Independent test:** With an outdated install, run `ambykit update`; assert it performs (or reports
  performing) the upgrade to the latest version.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the installed CLI is older than the latest, When I run `ambykit update`, Then the CLI is
  updated to the latest published version.
- Given the installed CLI is older than the latest, When I run `ambykit update`, Then it attempts a
  global install of the latest version.
- Given the CLI update cannot be performed (an ephemeral `npx` run, or a permissions error), When
  `ambykit update` runs, Then it prints the exact command to run and leaves the existing install intact.

### US-3 — `update` refreshes the project's tool prompts  (priority: P1)

As a user working in an AmbyKit project, I want `update` to refresh my configured tools' emitted
prompt/command files when the source prompts have changed, so my project stays current with the new
version without a separate `sync`.

- **Why this priority:** The value of a new version only reaches the project once its tool files are
  regenerated.
- **Independent test:** In a project whose emitted prompts are stale relative to the source, run
  `ambykit update`; assert the configured tools' files are regenerated to match the source.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the current directory is an AmbyKit project — a `.amby/` directory **and** a `specs/` directory
  at the invocation root — When I run `ambykit update`, Then the emitted prompt/command files for the
  configured tools are refreshed if the source prompts changed.
- Given the CLI version already matches the latest, When I run `ambykit update`, Then it still attempts
  the project prompt refresh.
- Given `ambykit update` runs outside an AmbyKit project, When it completes the CLI check, Then it
  skips the prompt refresh (no project to update).

### US-4 — Clear "up to date" and result reporting  (priority: P2)

As a user, I want `update` to tell me plainly what it did — or that nothing was needed — so I trust the
outcome.

- **Why this priority:** Confidence/UX; the actions in US-2/US-3 are only useful if their result is
  legible.
- **Independent test:** On the latest CLI and an in-sync project, run `ambykit update`; assert it
  reports exactly `Everything is up to date`.
- **depends-on:** [US-2, US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the CLI is current **and** no prompt files need regenerating, When I run `ambykit update`, Then
  it reports `Everything is up to date`.
- Given the CLI was updated and/or prompt files were refreshed, When `ambykit update` finishes, Then it
  summarizes what changed.

## Requirements (EARS)

<!-- Numbered, testable. Patterns: SHALL (ubiquitous), WHEN (event), WHILE (state), IF/THEN (unwanted), WHERE (optional). -->

- FR-001  WHEN a banner-printing command runs AND the installed version is older than the latest
  published version, THE SYSTEM SHALL display a warning between the banner and the command output,
  naming the installed and latest versions.
- FR-002  THE SYSTEM SHALL render the warning as a distinct callout (bordered, colored) via the
  capability-aware TUI layer.
- FR-003  WHERE the terminal lacks color or box glyphs, THE SYSTEM SHALL degrade the warning to plain
  text without control sequences.
- FR-004  WHERE output is machine-readable or non-interactive (e.g. `--json`, piped), THE SYSTEM SHALL
  keep the warning out of that output stream (see US-1 clarification).
- FR-005  IF the latest version cannot be determined (offline / registry error), THEN THE SYSTEM SHALL
  suppress the warning and neither block nor noticeably delay the command.
- FR-005a  THE SYSTEM SHALL look up the latest version at most once per day, caching the result
  locally and reading the cache on subsequent runs; on a cache miss the lookup SHALL use a short
  timeout and skip silently on failure.
- FR-006  THE SYSTEM SHALL provide an `update` command implemented as a `BaseCommand` that, WHEN the
  installed CLI is older than the latest published version, attempts a global install of the latest;
  IF that is not possible (ephemeral `npx` run or a permissions error), THEN it SHALL print the exact
  upgrade command and leave the install intact.
- FR-007  WHEN `update` runs with a `.amby/` directory AND a `specs/` directory at the invocation root,
  THE SYSTEM SHALL refresh the emitted prompt/command files for the project's configured tools if the
  source prompts changed, reusing the existing emit pipeline (Principle 1/2).
- FR-008  WHEN the installed CLI already matches the latest version, THE SYSTEM SHALL still attempt the
  project prompt refresh.
- FR-009  IF nothing is out of date (CLI current AND no prompt files need regenerating), THEN THE
  SYSTEM SHALL report `Everything is up to date`.
- FR-010  WHEN `update` runs outside an AmbyKit project, THE SYSTEM SHALL skip the prompt refresh and
  report accordingly.
- FR-011  IF the CLI update cannot be performed, THEN THE SYSTEM SHALL report the reason and leave the
  existing installation intact (no partial/corrupt state).
- FR-012  THE SYSTEM SHALL use a single source of truth for "the latest version" shared by the warning
  (FR-001) and `update` (FR-006), so they never disagree.
- FR-013  WHERE the installed version is a local/development placeholder (not a real published
  release), THE SYSTEM SHALL treat it as current and never warn or attempt to downgrade.
- FR-014  THE SYSTEM SHALL provide `update` as the single command for updating the CLI and refreshing
  prompts; the former `upgrade` command is removed (its behavior is fully covered by `update`).

## Success criteria

<!-- Measurable and tech-agnostic. -->

- SC-001  A user on an outdated version sees the warning on their next command — between banner and
  content — in 100% of cases where the latest version is known.
- SC-002  The warning never appears when the installed version is current (or is a dev placeholder).
- SC-003  `ambykit update` brings an outdated install to the latest published version.
- SC-004  After `update` in a project, the emitted tool files match the source with zero drift (same
  guarantee `sync`/`check` provide).
- SC-005  When nothing needs updating, the user sees exactly `Everything is up to date`.
- SC-006  The version check never blocks a command on network failure; a warm cache adds no network
  cost, and at most one lookup occurs per day.

## Edge cases

- Offline / npm registry unreachable — no warning, no hang.
- Installed via `npx` (ephemeral) — nothing persistent to update.
- Global vs local install; permission errors (e.g. `EACCES`) during CLI update.
- Local version is newer than "latest" (dev build / pre-release) — never warn or downgrade.
- `.amby/` present but no `specs/` (or the reverse) — not a project per the definition.
- Warning must not corrupt `--json`/piped output used by other tools.
- Prompt refresh where a tool's files were hand-deleted or hand-edited.
- The version check firing on every command (including fast machine reads like `dashboard --json`).

## Assumptions

- "Latest version" is the latest published release of `@ambystech/ambykit` on the npm registry.
- The warning callout uses the existing capability-aware TUI layer; the requested styling is a yellow
  border with yellow text where color is supported, degrading otherwise.
- "Update the prompts in the supported tools" means re-emitting via the same pipeline as `sync`
  (author-once / emit-per-tool), not a new bespoke path.
- An AmbyKit project is identified by a `.amby/` directory **and** a `specs/` directory at the
  directory where the command is invoked.
- The development placeholder version is treated as always-current (never triggers the warning).
