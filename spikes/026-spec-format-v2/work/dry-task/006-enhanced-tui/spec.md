---
feature: 006-enhanced-tui
title: Enhanced terminal UI for the AmbyKit CLI
branch: 006-enhanced-tui
status: done
created: 2026-07-07
---

# Spec — Enhanced terminal UI for the AmbyKit CLI

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Today the CLI renders output ad hoc: an ASCII banner, a hand-rolled dashboard table, and plain
`info/success/warn/error` lines. There is no progress feedback during multi-step commands, no
graceful handling of narrow terminals, and styling decisions are scattered across commands. This
feature makes the CLI's terminal experience cohesive, legible, and responsive — while keeping
machine output and non-interactive environments clean (Principle 3, Principle 7).

> **Scope (resolved):** Hybrid. Every command's default output becomes enhanced but stays one-shot
> and non-interactive (US-1–US-5). On top of that, two *opt-in* interactive capabilities are added
> as their own stories: a full-screen navigable dashboard view (US-6) and inline selection prompts
> for `init`/`add` (US-7). Default, flag-driven behavior stays scriptable and unchanged.

## User scenarios & testing

### US-1 — One cohesive visual language across every command  (priority: P1)

As a developer using AmbyKit, I want every command's output to share one visual style (color,
symbols, spacing, headings), so that the tool feels consistent and output is easy to scan.

- **Why this priority:** Consistency is the foundation the other stories build on; without a single
  rendering layer, every later enhancement re-scatters styling. Directly serves Principle 2
  (shared logic, don't duplicate).
- **Independent test:** Run each command and confirm colors, status glyphs, headings, and spacing
  are drawn from one shared style — no command styles output on its own.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given any AmbyKit command, When it prints normal, success, warning, or error output, Then the
  visual treatment (glyph, color, indentation) matches every other command's for that message kind.
- Given the banner and headings, When shown across commands, Then they use one consistent palette
  and spacing.

### US-2 — Dashboard progress is readable at a glance  (priority: P1)

As a developer tracking feature progress, I want the dashboard to show visual progress indicators
and status-colored rows, so that I can see how far along each story is without reading numbers.

- **Why this priority:** The dashboard is the primary read-surface of the tool; its legibility is
  the highest-value UI win.
- **Independent test:** Run `ambykit dashboard` on a project with mixed-progress stories and confirm
  each story shows a visual completion indicator and status-distinct styling.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given stories at 0%, partial, and 100% completion, When the dashboard renders, Then each row
  shows a progress indicator that visually distinguishes those three states.
- Given stories with different statuses, When the dashboard renders, Then status is visually
  distinguishable beyond the raw text value.
- Given `--json`, When the dashboard renders, Then the output contains no styling or progress glyphs
  (unchanged machine contract).

### US-3 — Feedback during multi-step commands  (priority: P2)

As a developer running `init`, `add`, `sync`, or `upgrade`, I want live feedback while the command
works and a clear summary of what changed, so that I know it is progressing and what it did.

- **Why this priority:** These commands do file I/O across many targets; silence reads as a hang,
  and a final summary aids trust. Lower than the read-surfaces because they already exit with a
  result.
- **Independent test:** Run each of these commands and confirm progress feedback appears while
  working and a change summary appears at the end.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a multi-step command, When it is executing, Then progress feedback appears within a short,
  perceptible delay of start.
- Given a completed multi-step command, When it finishes, Then it prints a summary of files
  created/updated/skipped.
- Given `--dry-run`, When the command runs, Then feedback and summary reflect what *would* change
  without implying it did.

### US-4 — Clean degradation in non-interactive, no-color, and narrow terminals  (priority: P2)

As a developer or CI pipeline, I want output to degrade to plain, uncolored, unwrapped-safe text
when the terminal is not interactive, `NO_COLOR` is set, or the width is small, so that logs stay
clean and machine-readable (Principle 7 — least surprise).

- **Why this priority:** AmbyKit output lands in CI logs and redirected files; broken control codes
  or misaligned tables there are worse than plain text.
- **Independent test:** Pipe each command to a file and set `NO_COLOR`; confirm zero ANSI sequences
  and intact layout. Shrink the terminal and confirm the dashboard stays aligned.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given stdout is not a TTY, When any command runs, Then output contains no ANSI/control sequences.
- Given `NO_COLOR` is set, When any command runs, Then output contains no color sequences.
- Given a terminal narrower than the dashboard's natural width, When the dashboard renders, Then
  columns adapt (truncate/wrap/drop) without breaking alignment or overflowing.
- Given a terminal or font without extended glyph support, When output renders, Then an ASCII
  fallback is used.

### US-5 — Errors and warnings are distinct and actionable  (priority: P3)

As a developer, I want errors and warnings to be visually distinct and to tell me the next step, so
that I can recover quickly.

- **Why this priority:** Improves recovery but the current `✗`/`!` prefixes already function; this
  is polish.
- **Independent test:** Trigger a known error (e.g. run a project command outside an AmbyKit
  project) and confirm the message is visually distinct and includes a suggested next action.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a recoverable error, When it is shown, Then it is visually distinct from normal output and
  names a concrete next step.
- Given a warning, When it is shown, Then it is visually distinguishable from both errors and normal
  output.

### US-6 — Opt-in interactive dashboard view  (priority: P3)

As a developer, I want an opt-in full-screen, navigable dashboard (e.g. `ambykit dashboard
--interactive`), so that I can browse stories and drill into their tasks without re-running the
command.

- **Why this priority:** A convenience layer on top of the enhanced dashboard; the default one-shot
  view (US-2) already covers the core need. Additive, so it ships last.
- **Independent test:** Run the dashboard with the interactive flag, navigate between stories, open
  a story's task detail, and quit — all without leaving the view or re-invoking the command.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the interactive flag, When the dashboard launches, Then the user can move a selection across
  stories and open one to see its tasks.
- Given the interactive view, When the user requests to quit, Then it exits cleanly and restores the
  terminal.
- Given no interactive flag, When the dashboard runs, Then behavior is the unchanged one-shot output
  (US-2) — the interactive view never activates by default.
- Given stdout is not a TTY, When the interactive flag is passed, Then the command falls back to
  one-shot output rather than attempting a full-screen view.

### US-7 — Interactive selection prompts for init/add  (priority: P3)

As a developer setting up AmbyKit, I want `init`/`add` to prompt me to select tools when I don't
pass the corresponding flags, so that I can configure without memorizing flag values.

- **Why this priority:** Improves first-run ergonomics but is redundant with existing flags;
  additive and lowest urgency.
- **Independent test:** Run `init`/`add` without tool flags and confirm an interactive prompt
  appears; run again with the flags and confirm no prompt appears.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given required selections are not supplied via flags, When `init`/`add` runs interactively, Then
  the user is prompted to choose and the choices drive the command.
- Given the selections are supplied via flags, When the command runs, Then no prompt appears
  (flags win; behavior is unchanged and scriptable).
- Given stdout/stdin is not a TTY, When required selections are missing, Then the command does not
  block on a prompt (it errors with guidance or uses documented defaults rather than hanging).

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL route all human-facing command output through a single shared rendering
  layer so that message kinds (info/success/warn/error/heading) render identically across commands.
- FR-002  WHEN stdout is not a TTY, THE SYSTEM SHALL emit plain text containing no ANSI or control
  sequences.
- FR-003  WHEN `NO_COLOR` is set, THE SYSTEM SHALL emit output containing no color sequences.
- FR-004  WHEN the dashboard renders a story, THE SYSTEM SHALL display a per-story visual completion
  indicator and status-distinct styling.
- FR-005  WHILE a multi-step command (`init`, `add`, `sync`, `upgrade`) is executing, THE SYSTEM
  SHALL display live progress feedback.
- FR-006  WHEN a multi-step command completes, THE SYSTEM SHALL print a summary of what was
  created, updated, and skipped.
- FR-007  IF the terminal width is below a rendered table's natural width, THEN THE SYSTEM SHALL
  adapt the layout (truncate, wrap, or drop columns) without breaking alignment.
- FR-008  THE SYSTEM SHALL render warnings and errors with visual treatment distinct from each
  other and from normal output.
- FR-009  WHERE a command produces machine output (e.g. `--json`), THE SYSTEM SHALL emit it free of
  any styling, progress indicators, or control sequences.
- FR-010  THE SYSTEM SHALL preserve every command's existing exit codes and `--json` output
  contract unchanged (no behavioral regression).
- FR-011  THE SYSTEM SHALL NOT write user-level or out-of-tree files as part of rendering
  (Principle 7).
- FR-012  WHERE extended glyphs are unsupported by the terminal, THE SYSTEM SHALL fall back to an
  ASCII representation.
- FR-013  WHERE the interactive dashboard is requested, THE SYSTEM SHALL present a navigable
  full-screen view and restore the terminal cleanly on exit.
- FR-014  IF the interactive dashboard is requested while stdout is not a TTY, THEN THE SYSTEM SHALL
  fall back to the one-shot dashboard output.
- FR-015  WHEN `init`/`add` runs and a required selection is not supplied via flags, THE SYSTEM
  SHALL prompt for it interactively; WHERE the selection is supplied via flags, THE SYSTEM SHALL NOT
  prompt.
- FR-016  IF a required selection is missing while stdin/stdout is not a TTY, THEN THE SYSTEM SHALL
  fail with guidance (or documented defaults) rather than block on a prompt.

## Success criteria

- SC-001  Every human-facing output path routes through the shared rendering layer — no command
  emits its own color/glyph styling directly.
- SC-002  Output contains zero ANSI escape sequences whenever stdout is not a TTY or `NO_COLOR` is
  set (verifiable by scanning captured output).
- SC-003  In a quick usability check, a user can identify the least-complete story in the dashboard
  in ≤ 5 seconds.
- SC-004  All existing tests pass and `--json` output is byte-identical to the pre-change output for
  the same input (no machine-contract regression).
- SC-005  Multi-step commands surface progress feedback within a perceptible-but-fast delay of
  starting (target ≤ 200 ms).
- SC-006  Runtime dependencies added for rendering stay within budget: at most 3 new direct
  dependencies with a small install footprint, none requiring network access at runtime. The
  specific library choice remains a `plan.md` decision; this is the ceiling it must satisfy.

## Edge cases

- Output piped to a file or another process (non-TTY) — must be plain text.
- `NO_COLOR` set while stdout *is* a TTY — must drop color but may keep layout.
- Terminal narrower than the dashboard's natural width — must adapt, not overflow.
- Very tall output (many stories) — must remain readable when scrolled in a pager.
- Terminal/font without extended-glyph support — must fall back to ASCII.
- `--json` combined with a TTY — machine output must stay unstyled.
- `--dry-run` — progress/summary must not imply changes were made.
- Concurrent redirection of stdout vs stderr — error styling must not corrupt piped stdout.

## Assumptions

- "Enhance the TUI" means (a) improving the terminal *output* of all existing one-shot commands and
  (b) adding two opt-in interactive capabilities (US-6, US-7). Default behavior stays one-shot and
  scriptable.
- No new *commands* are added; the interactive dashboard is an opt-in flag on `dashboard`, and the
  prompts are opt-in behavior on `init`/`add`. Enhanced commands: `init`, `add`, `sync`,
  `dashboard`, `analyze`, `check`, `upgrade`, help/banner.
- Which specific rendering library to add is a HOW decision deferred to `plan.md`; this spec only
  sets the behavioral constraints and the footprint ceiling (SC-006) it must satisfy.
