---
feature: 010-version-update
signed_off: true
signed_off_by: Gustavo Barrientos
signed_off_date: 2026-07-20
---

# UI Design — Outdated-version warning + `update` command

> First-class artifact. Once `signed_off: true`, this UI is binding for plan/tasks/implement.
> Tokens live in `design-tokens.json` (same folder); cited by name here, never raw values.
> Terminal UI — styling flows through the capability-aware `theme.ts`/`render.ts` layer (Principle 2).

## US-1 — Outdated-version warning callout

### Layout / wireframe

Placement: emitted immediately **below the banner and above the first line of command output**.

Full capability (color + unicode), the whole box in `callout.warn.border-fg` / `text-fg` (yellow):

```
  ▄▀█ █▀▄▀█ █▄▄ █▄█ █▄▀ █ ▀█▀              <- banner (unchanged)
  █▀█ █░▀░█ █▄█ ░█░ █░█ █ ░█░
  Spec-Driven Development for AI coding assistants

  ┌──────────────────────────────────────────────┐   <- callout.warn (yellow)
  │ ! Update available — AmbyKit 0.2.0 → 1.0.0    │
  │   Run `ambykit update` to upgrade.            │
  └──────────────────────────────────────────────┘

  <command output begins here>                        <- unchanged content
```

ASCII fallback (`Capabilities.unicode` false) — box + arrow degrade, meaning preserved:

```
  +----------------------------------------------+
  | ! Update available - AmbyKit 0.2.0 -> 1.0.0  |
  |   Run `ambykit update` to upgrade.           |
  +----------------------------------------------+
```

Monochrome (`NO_COLOR` / no color, unicode ok): identical box, **no** ANSI — the `!` symbol and the
word "Update available" carry the meaning (never color-only).

Suppressed (renders nothing): non-TTY, `--json`, latest-unknown/offline, installed == latest, or a
dev-placeholder version.

### Component inventory

#### VersionWarningCallout
- **props:**
  - `installed: string` — the running version.
  - `latest: string` — the newest published version.
  - `caps: Capabilities` — drives color/unicode/suppression.
- **states:** default (color+unicode), ascii (no unicode), monochrome (no color), suppressed (empty
  render). No hover/focus/disabled — non-interactive output.
- **tokens:** `component.callout.warn.border-fg`, `.text-fg`, `.symbol`, `.version-arrow`,
  `.corner-tl/-tr/-bl/-br`, `.edge-h`, `.edge-v`, `.pad-x`, `.gutter`.
- **behavior:**
  - Given `installed` < `latest` and an interactive human terminal, When any banner-printing command
    runs, Then the callout renders between banner and content naming both versions (US-1).
  - Given `installed` >= `latest` or a dev-placeholder version, When a command runs, Then the callout
    renders nothing (US-1, FR-013).
  - Given `caps.color` is false, When the callout renders, Then it emits the box + `!` + words with no
    ANSI (US-1, FR-003).
  - Given a non-TTY or `--json`, When a command runs, Then the callout renders nothing (US-1, FR-004).
  - Given the latest version is unknown (offline), When a command runs, Then the callout renders
    nothing (FR-005).

### Content & accessibility

- Copy line 1: ``! Update available — AmbyKit <installed> <version-arrow> <latest>``.
- Copy line 2: `` Run `ambykit update` to upgrade.``
- Width: fit content, capped at `caps.columns` minus the `gutter`; wrap/truncate copy, never overflow.
- A11y: meaning is glyph + word, never color-only; degrades to ASCII on limited terminals; absent from
  machine/piped streams so it can't corrupt them. Yellow relies on the user's terminal theme for
  contrast — the `!`+word guarantee comprehension if contrast is poor.

## US-2 / US-3 / US-4 — `update` command output

Line output only (no box); reuses `render.ts` message kinds. Shown in invocation order.

### Component inventory

#### UpdateResultReport
- **props:** `cliOutcome: "updated" | "current" | "manual-required"`, `from?: string`, `to?: string`,
  `promptChanges: WriteResult`, `inProject: boolean`.
- **states:** cli-updated, cli-current, manual-required, prompts-refreshed, nothing-to-do,
  outside-project.
- **tokens:** `component.update-result.updated-fg` (warn), `.uptodate-fg` (text),
  `.manual-step-fg`/`.manual-step-symbol` (muted `→` hint); prompt refresh reuses
  `component.summary.*` and `message.success`.
- **behavior:**
  - Given the CLI was updated, When `update` finishes, Then a success line reports
    ``Updated AmbyKit <from> → <to>`` (US-2).
  - Given the CLI can't self-update (npx/EACCES), When `update` runs, Then a warn line states the
    reason and a muted `→` next-step prints the exact `npm i -g …@latest` command (US-2, FR-011).
  - Given an in-project run, When prompts change, Then the standard created/updated/unchanged summary
    prints (US-3) — same surface as `sync`.
  - Given the CLI is current and no prompt files need regenerating, When `update` finishes, Then it
    prints exactly ``Everything is up to date`` (US-4, SC-005).
  - Given a run outside a project, When the CLI check completes, Then no prompt summary prints (US-3,
    FR-010).

### Content & accessibility

- Exact string `Everything is up to date` (SC-005) — no glyph required, but rendered via the success
  kind for consistency.
- Every line carries a word (not color-only); machine output paths (`info`) stay unstyled.

## Sign-off

<!-- /amby.design records approval here and flips `signed_off` in the frontmatter. -->
- [x] Reviewed and approved. — Gustavo Barrientos, 2026-07-20
