---
feature: 006-enhanced-tui
signed_off: true
signed_off_by: Gustavo Barrientos
signed_off_date: 2026-07-07
---

# UI Design — Enhanced terminal UI for the AmbyKit CLI

> First-class artifact. Once `signed_off: true`, this UI is binding for plan/tasks/implement.
> Tokens live in `design-tokens.json` (same folder); cited by name here, never raw values.
> Conventions: `@.amby/reference/design-conventions.md`. Terminal-medium notes: "focus" = the
> keypress cursor; color is **always** paired with a glyph/text so meaning survives `NO_COLOR` and
> monochrome terminals (the terminal analog of "never color-only").

## US-1 — Cohesive message styling (all commands)

### Layout / wireframe
```
  ▄▀█ █▀▄▀█ █▄▄ █▄█ █▄▀ █ ▀█▀                 <- banner  (component.banner.fg)
  Spec-Driven Development for AI assistants   <- tagline (component.banner.tagline-fg)

  Configured tools                            <- H2 heading (component.message.heading)
✓ Synced 12 file(s); 3 unchanged.             <- success (component.message.success)
! 2 user-level file(s) skipped.               <- warn    (component.message.warn)
✗ Not inside an AmbyKit project.              <- error   (component.message.error)
info: plain passthrough line                  <- info    (component.message.info)
```

### Component inventory

#### Banner
- **props:** `color: boolean`
- **states:** default, degraded (no color → plain ASCII art)
- **tokens:** `component.banner.fg`, `component.banner.tagline-fg`
- **behavior:**
  - Given a color TTY, When any command prints the banner, Then art uses `banner.fg` and the tagline
    uses `banner.tagline-fg` (US-1).

#### Message
- **props:** `kind: "info"|"success"|"warn"|"error"|"heading"`, `text: string`
- **states:** default, degraded (glyph→ASCII, color stripped)
- **tokens:** `component.message.{info,success,warn,error,heading}`, symbols from `semantic.symbol.*`
- **behavior:**
  - Given any command, When it emits a message of a given `kind`, Then its glyph, color, and indent
    match every other command's for that kind — all kinds route through one renderer (US-1; Principle 2).
  - Given `kind="info"`, When rendered, Then text passes through unstyled (guards `--json` fidelity).

### Content & accessibility
- Copy: terse, sentence-case, one line where possible.
- States: degraded path drives US-4; see **Capability states** below.
- A11y: every kind carries a distinct **glyph + word**, not color alone; readable under `NO_COLOR`
  and by screen readers reading raw text.

## US-2 — Dashboard progress table

### Layout / wireframe
```
  Feat  Story  Description        Progress         Status       Prio  Blocked-by
  ----  -----  -----------------  ---------------  -----------  ----  ----------
  006   US-1   Cohesive style     ███████░░░  70%  in-progress  P1    -
  006   US-2   Dashboard viz      ██████████ 100%  done         P1    -
  006   US-6   Interactive view   ░░░░░░░░░░   0%  draft        P3    US-2

  Overall: 7 stories · 9/20 tasks · 45%
```
Narrow terminal (width < natural) drops lowest-priority columns, never wraps mid-cell (FR-007):
```
  Story  Description       Progress
  US-1   Cohesive style    ███████░░░  70%
```

### Component inventory

#### ProgressBar (cell)
- **props:** `done: number`, `total: number`, `width = tokens.width`
- **states:** empty (0%), partial, complete (100%), degraded (ASCII `#`/`-`)
- **tokens:** `component.progress-bar.{fill,empty,width,fg-complete,fg-partial,fg-empty}`
- **behavior:**
  - Given done/total, When rendered, Then fill ratio = `round(done/total*width)` and the fg token is
    chosen by state so 0 / partial / 100% are visually distinct beyond the number (US-2).

#### StatusBadge
- **props:** `status: "draft"|"ready"|"in-progress"|"blocked"|"done"`
- **states:** one per status, degraded (text only)
- **tokens:** `component.status-badge.*`
- **behavior:**
  - Given a status, When rendered, Then color comes from its badge token while the status **word**
    always shows (distinguishable without color) (US-2).

#### Table (responsive)
- **props:** `columns: {header, min, priority}[]`, `rows`, `width`
- **states:** full, fitted (columns dropped by priority), degraded (rule/gutter ASCII)
- **tokens:** `component.table.{header-fg,rule-fg,gutter}`
- **behavior:**
  - Given `width < natural`, When rendered, Then lowest-`priority` columns drop until every line
    fits `width`; alignment is preserved (US-2/US-4; FR-007).
  - Given `--json`, When the dashboard runs, Then no table/bar/badge styling is emitted (FR-009).

### Content & accessibility
- Copy: `Overall:` footer summarizes totals for quick scanning.
- Empty: "No user stories found. Run /amby.specify to create one." (unchanged).
- A11y: progress conveyed by **bar length + `NN%` number + color** (triple-encoded); status by word.

## US-3 — Multi-step feedback & change summary

### Layout / wireframe
```
⠋ Emitting tool files…                        <- spinner (component.spinner), transient, TTY-only
✓ Synced 12 file(s); 3 unchanged.
  created    4                                 <- summary.created-fg
  updated    8                                 <- summary.updated-fg
  unchanged  3                                 <- summary.unchanged-fg
  skipped    2   (use --include-user)          <- summary.skipped-fg
```
Dry-run wording:
```
⠋ Checking what would change…
✓ Would sync 12 file(s); 3 unchanged.
```

### Component inventory

#### Spinner
- **props:** `label: string`
- **states:** active (animating), succeed (→ ✓ line), stop, degraded (no-op: prints label once, no frames)
- **tokens:** `component.spinner.{fg,frames}`
- **behavior:**
  - Given a non-TTY, When a spinner starts, Then no frames/control codes are emitted — a single
    static line at most (US-3/US-4; FR-005).

#### ChangeSummary
- **props:** `result: WriteResult`, `dryRun: boolean`
- **states:** default, dry-run ("would"), empty (all unchanged)
- **tokens:** `component.summary.{created,updated,unchanged,skipped}-fg`
- **behavior:**
  - Given a completed command, When it finishes, Then created/updated/unchanged/skipped counts are
    shown, each in its token color plus label (US-3; FR-006).
  - Given `--dry-run`, When rendered, Then the header/verbs use "would" and imply no change occurred.

### Content & accessibility
- Copy: counts left-aligned in a fixed column for scanability; `skipped` names the remedy flag.
- A11y: counts are labelled words; spinner is decorative and never the sole signal of progress.

## US-5 — Errors & warnings with next steps

### Layout / wireframe
```
✗ Not inside an AmbyKit project (no .amby/ found).
  → Run `ambykit init` first.                  <- next-step (component.message.next-step)
! No tools configured.
  → Run `ambykit add <tool>`.
```

### Component inventory

#### NextStep (attaches to Message error/warn)
- **props:** `hint: string`
- **states:** present, absent
- **tokens:** `component.message.next-step.{fg,symbol,indent}`
- **behavior:**
  - Given a recoverable error/warning, When shown, Then it is visually distinct from each other and
    from normal output, and a `→` next-step line names a concrete command (US-5; FR-008).

### Content & accessibility
- Copy: error states *what* + *why*; next-step states the *fix* as a runnable command.
- A11y: error vs warn distinguished by glyph (`✗` vs `!`) and wording, not color alone.

## US-6 — Interactive full-screen dashboard (opt-in, TTY-only)

### Layout / wireframe
List mode (`ambykit dashboard --interactive`):
```
┌ AmbyKit · dashboard ───────────────────────────────────┐
│ ▸ 006 US-1  Cohesive style     ███████░░░  70%  P1      │  <- cursor row (menu.cursor / cursor-fg)
│   006 US-2  Dashboard viz      ██████████ 100%  P1      │
│   006 US-6  Interactive view   ░░░░░░░░░░   0%  P3      │
│                                                         │
│ ↑/↓ move   enter open   q quit                          │  <- hints (menu.hint-fg)
└─────────────────────────────────────────────────────────┘
```
Detail mode (after `enter`):
```
┌ AmbyKit · 006 US-1 ────────────────────────────────────┐
│ Cohesive style              in-progress · P1 · 70%      │
│ depends-on: -    blocked-by: -                          │
│ tasks:                                                  │
│   [x] T001 shared render layer                          │
│   [ ] T002 refactor BaseCommand                         │
│                                                         │
│ ←/esc back   q quit                                     │
└─────────────────────────────────────────────────────────┘
```

### Component inventory

#### MenuList
- **props:** `items: Story[]`, `cursor: number`, `mode: "list"|"detail"`
- **states:** list, detail, empty, first/last-row (cursor clamps)
- **tokens:** `component.menu.{cursor,cursor-fg,hint-fg,box-fg}`, reuses ProgressBar/StatusBadge
- **behavior:**
  - Given list mode, When `↑`/`↓` pressed, Then the cursor moves and the highlighted row uses
    `menu.cursor` + `cursor-fg` (US-6; FR-013).
  - Given a highlighted story, When `enter` pressed, Then detail mode shows its tasks; `←`/`esc`
    returns to the list.
  - Given `q` (or `SIGINT`), When pressed, Then the alt-screen is exited and the terminal restored
    (cooked mode, normal buffer).
  - Given `--interactive` on a non-TTY, When invoked, Then it falls back to the US-2 one-shot table,
    never entering full-screen (FR-014).

### Content & accessibility
- Copy: a persistent key-hint footer is always visible (discoverability).
- A11y: fully keyboard-driven; non-TTY/screen-reader path is the plain US-2 table (no trap).
- Focus: exactly one cursor row; movement is predictable and clamped at ends.

## US-7 — Interactive multi-select prompt for init/add (opt-in, TTY-only)

### Layout / wireframe
```
? Select tools to configure   (space toggle · enter confirm · esc cancel)
  ▸ ◉ Claude Code                            <- cursor + checked (prompt.cursor / prompt.checked)
    ◯ GitHub Copilot
    ◉ Cursor
    ◯ OpenCode
    ◯ Antigravity
```
Non-TTY (missing selection, no flags) → no prompt, actionable error:
```
✗ No tools specified and not an interactive terminal.
  → Pass --tools=claude,cursor (comma-separated).
```

### Component inventory

#### MultiSelectPrompt
- **props:** `message: string`, `options: {value,label}[]`, `preselected: string[]`
- **states:** default, cursor-on-item, checked, unchecked, submitted, cancelled, degraded-nonTTY (error)
- **tokens:** `component.prompt.{message-fg,hint-fg,checked,unchecked,cursor}`
- **behavior:**
  - Given tool flags are absent on a TTY, When `init`/`add` runs, Then this prompt appears; `space`
    toggles, `enter` confirms, `esc` cancels (US-7; FR-015).
  - Given tool flags are present, When the command runs, Then no prompt appears — flags win, output
    stays scriptable (FR-015).
  - Given a non-TTY with a missing required selection, When invoked, Then it errors with the `→`
    guidance above and does **not** block on input (US-7; FR-016).

### Content & accessibility
- Copy: inline hint states every key; checked state shown by glyph (`◉`/`◯`), not color alone.
- A11y: keyboard-only; non-interactive environments get a deterministic error, never a hang.

## Capability states (US-4 — cross-cutting degradation)

US-4 is not a screen; it is the **degraded state** every component above must render. One
`Capabilities` object (`@plan.md`, `@data-model.md`) drives all of it:

| Condition | Effect on tokens/components |
|---|---|
| non-TTY | color stripped, spinner = no-op, interactive views fall back to one-shot (FR-002/005/014). |
| `NO_COLOR` | all `sgr` color params dropped; glyphs + words remain (FR-003). |
| `unicode=false` | every `primitive.glyph.*` uses its `.a` ASCII form; bars → `#`/`-` (FR-012). |
| `columns < natural` | Table drops columns by `priority`; no mid-cell wrap (FR-007). |
| `--json` | zero styling on any component; raw machine output (FR-009/010). |

- A11y (WCAG-AA-equivalent for terminal): meaning is never color-only; keyboard reachability for all
  interactive views; deterministic non-TTY fallbacks; conservative defaults (ASCII/no-color when
  capability is unknown). Honors constitution **Principle 3** (frugal, zero-dep rendering) and
  **Principle 7** (least surprise: safe defaults, no out-of-tree writes).

## Sign-off

- [x] Reviewed and approved. — Gustavo Barrientos, 2026-07-07
