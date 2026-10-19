---
feature: 014-enhanced-dashboard
signed_off: true                  # set true by /amby.design after review; makes UI binding
signed_off_by: Gustavo Barrientos
signed_off_date: 2026-10-18
---

# UI Design — Enhanced dashboard — widgets and charts

> First-class artifact. Once `signed_off: true`, this UI is binding for plan/tasks/implement.
> Tokens live in `design-tokens.json` (same folder), extending 006's terminal tokens; cited by name
> here, never raw values. Conventions: `@.amby/reference/design-conventions.md`. Terminal-medium
> notes carried over from 006: "focus" is the keypress cursor plus a heavy panel frame, and color is
> **always** paired with a glyph, fill pattern or text (FR-006). Wireframes show unicode glyphs;
> ASCII fallbacks are the `a` values of each glyph token. Wireframe data is illustrative.

## Design inputs (confirmed 2026-10-18)

Answers to the spec's open questions, confirmed by the reviewer at sign-off and recorded in
`spec.md`.

| Spec question | Answer | Affects |
| --- | --- | --- |
| Delivery surface | **(a) terminal only** — the one-shot view and `--interactive`. No HTML page. | All; makes FR-016's note moot and FR-017 needs no output path. |
| Per-feature chart order (US-2) | By feature number (directory order), so the chart reads like `specs/`. | US-2 |
| "Up next" cap (US-4) | 5 tasks by default, configurable (mechanism decided in `plan.md`); the panel title shows `<shown> of <total>`. | US-4 |
| Time-based burndown | **In scope as US-7 (P3)**, from git history of `tasks.md` (spec amended at clarify). | US-7 |

Two layout decisions, confirmed at sign-off:

1. **Default one-shot output becomes the overview** (US-1 to US-4 plus the feature chart). The
   existing story table stays available as `ambykit dashboard --stories`, inside the feature view
   (`--feature=X`), and via `dashboard <story-id>` (FR-015). No current test asserts the default
   output; `--json` is untouched (FR-012).
2. **Non-TTY output is the overview in plain text** (no color, ASCII glyphs, no frames) rather than
   the old table, so logs get the same answers as the terminal (FR-016).

## US-1 — At-a-glance summary widgets

### Layout / wireframe

Wide one-shot view (columns ≥ `component.layout.wide-min`), shown at 100 columns. This is the
reference layout for US-1 to US-5; later sections zoom into their part of it.

```
◆ AmbyKit · dashboard                                           ~/src/ambystech/oss/AmbyKit · v1.2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╭─ FEATURES ───────╮ ╭─ STORIES ────────╮ ╭─ TASKS ──────────╮ ╭─ COMPLETE ────────────────────────╮
│ 16               │ │ 69               │ │ 222 / 239        │ │ 93%                               │
│ 13 done · 3 open │ │ 60 done · 9 open │ │ 17 open          │ │ █████████████████████████████▊░░  │
╰──────────────────╯ ╰──────────────────╯ ╰──────────────────╯ ╰───────────────────────────────────╯

STORY STATUS
███████████████████████████████████████████████████████████████████████████████████████▓▓▓░░░░░░░▚▚·
✓ done 60 (87%)   ◐ in-progress 2 (3%)   ○ draft 5 (7%)   ✗ blocked 1 (1%)   – deferred 1 (1%)

╭─ ATTENTION · 3 ───────────────────────────────╮ ╭─ UP NEXT · 5 of 17 ────────────────────────────╮
│ ✗ 015:US-4  blocked-by US-2                   │ │ T010  014:US-3  Attention widget model         │
│ → 014:US-6  waiting on US-3, US-4             │ │ T011  014:US-3  Graph-problem detection        │
│ ⚠ 015:US-3  depends-on US-9 — unknown story   │ │ T014  014:US-4  Up-next selector               │
╰───────────────────────────────────────────────╯ │ T015  014:US-4  Cap + completion state         │
                                                  │ T016  014:US-4  Snapshot tests                 │
                                                  ╰────────────────────────────────────────────────╯

FEATURE COMPLETION                                                       phase         clarif.
001 core-and-claude-emitter        ██████████████████████████████ 100%   done          ·
002 copilot-emitters               ██████████████████████████████ 100%   done          ·
003 opencode-cursor-antigravity    ██████████████████████████████ 100%   done          ·
004 templates-and-ui-depth         ██████████████████████████████ 100%   done          ·
005 analyze-and-release            ██████████████████████████████ 100%   done          ·
006 enhanced-tui                   ██████████████████████████████ 100%   done          ·
007 documentation-site             ██████████████████████████████ 100%   done          ·
008 brownfield-support             ██████████████████████████████ 100%   done          ·
008 codex-integration              ██████████████████████████████ 100%   done          ·
009 continue-spec                  ██████████████████████████████ 100%   done          ·
010 version-update                 ██████████████████████████████ 100%   done          ·
011 converge                       ██████████████████████████████ 100%   done          ·
012 worktree-isolation             ██████████████████████████████ 100%   done          ·
013 multi-agent-roles              ██████████████████████████████ 100%   done          ·
014 enhanced-dashboard             ██████████▌░░░░░░░░░░░░░░░░░░░  35%   implementing  ·
015 mcp-server                     ╌╌╌ not planned ╌╌╌╌╌╌╌╌╌╌╌╌╌╌        planned       1
```

Layout rules:
- Order, top to bottom: header, summary cards, story status chart, Attention + Up next, burndown
  (US-7), feature completion. The first four answer SC-001 (completion, blocked count, next task) above the fold in
  a 100×30 terminal; the feature chart may scroll.
- Four summary cards share the row equally (`component.layout.card-gap` between them); COMPLETE
  takes the remainder so its bar is as long as possible.

### Component inventory

#### Header
- **props:** crumb: string[], cwd: string, version: string, mode: "one-shot" | "interactive"
- **states:** default, drill-down (crumb extended, right meta shows the feature's phase and %)
- **tokens:** component.header.brand, component.header.brand-fg, component.header.title-weight,
  component.header.breadcrumb, component.header.meta-fg, component.header.rule,
  component.header.rule-fg
- **behavior:**
  - Given a narrow terminal, When the header renders, Then the right meta drops the path first,
    then the version, and never wraps.

#### SummaryCard
- **props:** label: "FEATURES" | "STORIES" | "TASKS" | "COMPLETE", value: string, caption: string,
  bar?: number (COMPLETE only)
- **states:** default, empty
- **tokens:** component.panel.frame-fg, component.panel.title-fg, component.summary-card.value-fg,
  component.summary-card.value-weight, component.summary-card.caption-fg,
  component.summary-card.empty, component.completion-bar.fill, component.completion-bar.empty,
  component.completion-bar.eighths, component.completion-bar.fg-partial,
  component.completion-bar.fg-complete
- **behavior:**
  - Given the fixture (3 features, 10 stories, 25/40 tasks), When the view renders (FR-002), Then
    the cards read FEATURES 3, STORIES 10, TASKS 25 / 40 and COMPLETE 63%.
  - Given COMPLETE is 100%, When it renders, Then the bar uses `fg-complete`; otherwise
    `fg-partial`, drawn to eighth-cell precision on unicode terminals.
  - Given no features (FR-013), When the cards render, Then values are `0` (COMPLETE shows the
    `empty` glyph, not `0%`) and the hint line below reads the `/amby.specify` hint.

### Content & accessibility

- Captions: FEATURES `N done · M open`; STORIES `N done · M open`; TASKS `N open`. "Done" for a
  feature means every story is done.
- Empty state:

```
◆ AmbyKit · dashboard                                                     v1.2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╭─ FEATURES ──────╮ ╭─ STORIES ───────╮ ╭─ TASKS ─────────╮ ╭─ COMPLETE ───────╮
│ 0               │ │ 0               │ │ 0 / 0           │ │ —                │
│ —               │ │ —               │ │ —               │ │ ░░░░░░░░░░░░     │
╰─────────────────╯ ╰─────────────────╯ ╰─────────────────╯ ╰──────────────────╯

No features yet. Run /amby.specify in your assistant to create the first spec.
```

- A11y: values are plain numbers; the bar always has the percentage beside it.

## US-2 — Charts of progress and status

### Layout / wireframe

Two charts from the reference layout: the full-width **story status** stacked bar, and the
**feature completion** bar chart (one row per feature).

```
STORY STATUS
███████████████████████████████████████████████████████████████████████████████████████▓▓▓░░░░░░░▚▚·
✓ done 60 (87%)   ◐ in-progress 2 (3%)   ○ draft 5 (7%)   ✗ blocked 1 (1%)   – deferred 1 (1%)

FEATURE COMPLETION                                                       phase         clarif.
008 brownfield-support             ██████████████████████████████ 100%   done          ·
008 codex-integration              ██████████████████████████████ 100%   done          ·
014 enhanced-dashboard             ██████████▌░░░░░░░░░░░░░░░░░░░  35%   implementing  ·
015 mcp-server                     ╌╌╌ not planned ╌╌╌╌╌╌╌╌╌╌╌╌╌╌        planned       1
```

### Component inventory

#### StatusChart
- **props:** counts: Record<status, number>, width: number
- **states:** default, single-status (one solid bar), empty (hidden; the hint line covers it)
- **tokens:** component.status-chart.done, component.status-chart.in-progress,
  component.status-chart.ready, component.status-chart.draft, component.status-chart.blocked,
  component.status-chart.deferred, component.status-chart.other, component.status-chart.legend-fg,
  component.status-chart.share-fg
- **behavior:**
  - Given stories across statuses (FR-003/004), When the chart renders, Then segments appear in the
    fixed order done, in-progress, ready, draft, blocked, deferred, other; segment widths use
    largest-remainder rounding so they fill the bar exactly, and any non-zero status gets at least
    one cell.
  - Given a status with zero stories, When the legend renders, Then it is omitted (consistently, in
    both chart and legend), and the legend counts sum to the STORIES card.
  - Given an unknown status value in a spec, When it renders, Then it is counted under `other`.

#### FeatureRow (completion chart)
- **props:** ref: string, name: string, tasks: {done, total} | null, phase: Phase, clarifications:
  number
- **states:** default, complete, not-planned, selected (interactive)
- **tokens:** component.feature-row.ref-fg, component.feature-row.name-fg,
  component.feature-row.phase-fg, component.feature-row.phase-done-fg,
  component.feature-row.clarif-fg, component.feature-row.clarif-none,
  component.feature-row.bar-width-wide, component.feature-row.bar-width-narrow,
  component.feature-row.name-width-wide, component.feature-row.name-width-narrow,
  component.completion-bar.not-planned, component.completion-bar.not-planned-fg, component.row.*
- **behavior:**
  - Given features, When the chart renders (FR-004), Then every feature appears exactly once,
    ordered by number then name, so two `008-*` features are two distinct rows.
  - Given a feature with stories but no `tasks.md` (FR-005), When it renders, Then the bar is
    replaced by the dashed `not planned` label and no percentage is shown.
  - Given a long name, When it renders, Then it is truncated with `…` at the name width.

### Content & accessibility

- Every status segment has its own fill pattern (`█ ▓ ▒ ░ ▚ ·`; ASCII `# = + - ! .`) and the legend
  pairs glyph + word + count + share, so the chart reads correctly with color off (FR-006, SC-006).
- Hundreds of stories still produce one bar (aggregate), never one mark per story.

## US-3 — Attention widget: blocked and stalled work

### Layout / wireframe

```
╭─ ATTENTION · 3 ───────────────────────────────╮
│ ✗ 015:US-4  blocked-by US-2                   │
│ → 014:US-6  waiting on US-3, US-4             │
│ ⚠ 015:US-3  depends-on US-9 — unknown story   │
╰───────────────────────────────────────────────╯

╭─ ATTENTION · 0 ───────────────────────────────╮
│ Nothing blocked.                              │
╰───────────────────────────────────────────────╯
```

### Component inventory

#### AttentionItem
- **props:** key: string, kind: "blocked" | "waiting" | "graph-problem", refs: string[], reason:
  string
- **states:** blocked, waiting, graph-problem, selected (interactive)
- **tokens:** component.attention-item.blocked, component.attention-item.waiting,
  component.attention-item.graph-problem, component.attention-item.id-fg,
  component.attention-item.reason-fg, component.attention-item.max-items, component.row.*
- **behavior:**
  - Given a story with status `blocked` or a `blocked-by` story that is not done (FR-007), When
    the widget renders, Then it shows `✗ <key>  blocked-by <ids>`, listing only unfinished blockers;
    a story whose blockers are all done (and status not `blocked`) is not shown.
  - Given a story whose `depends-on` target is not done, When it renders, Then it shows
    `→ <key>  waiting on <ids>`.
  - Given a cycle or an unknown reference (FR-008), When it renders, Then it shows
    `⚠ <key>  <problem>` and graph problems sort first, then blocked, then waiting.
  - Given more than `max-items` entries, When it renders, Then the last line reads `+N more` (and
    in interactive mode the panel scrolls).

### Content & accessibility

- Story keys are feature-qualified (`015:US-4`). If two features share a number, the key uses the
  full directory prefix (`008-codex:US-1`) so it stays unambiguous.
- Empty: `Nothing blocked.` (the panel never disappears).

## US-4 — "Up next" widget

### Layout / wireframe

```
╭─ UP NEXT · 5 of 17 ────────────────────────────╮
│ T010  014:US-3  Attention widget model         │
│ T011  014:US-3  Graph-problem detection        │
│ T014  014:US-4  Up-next selector               │
│ T015  014:US-4  Cap + completion state         │
│ T016  014:US-4  Snapshot tests                 │
╰────────────────────────────────────────────────╯

╭─ UP NEXT ──────────────────────────────────────╮
│ All tasks done — run /amby.converge.           │
╰────────────────────────────────────────────────╯
```

### Component inventory

#### UpNextItem
- **props:** taskId: string, storyKey: string, description: string
- **states:** default, selected (interactive), complete (panel-level)
- **tokens:** component.up-next-item.task-id-fg, component.up-next-item.story-id-fg,
  component.up-next-item.text-fg, component.up-next-item.max-items, component.hint-line.command-fg,
  component.row.*
- **behavior:**
  - Given open tasks (FR-009), When the widget renders, Then it lists undone tasks whose story is
    not in Attention, ordered by feature number then `T###`, up to the configured cap (default `max-items`); the title shows
    `<shown> of <total eligible>`.
  - Given every task is done, When it renders, Then the single line suggests `/amby.converge`.
  - Given tasks with no `US-#` link, When totals are computed, Then they count toward TASKS and may
    appear here with the story column showing `unassigned`.

### Content & accessibility

- Descriptions are truncated with `…` at the panel edge; the task id is never truncated.

## US-5 — Feature drill-down and workflow-phase view

### Layout / wireframe

Phase and open clarifications also appear as the last two columns of the feature chart (US-2).
Opening a feature — `--feature=X` in one-shot, `⏎` on a feature row in interactive — shows:

```
◆ AmbyKit · dashboard › 014 enhanced-dashboard                                    implementing · 35%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╭─ ARTIFACTS ───────────────────╮ ╭─ OPEN CLARIFICATIONS · 0 ─────╮ ╭─ STATUS ─────────────────────╮
│ ✓ spec.md      6 stories      │ │ None — spec fully clarified.  │ │ ✓ 2  ◐ 2  ○ 2  ✗ 0  – 0      │
│ ✓ ui.md        signed off     │ ╰───────────────────────────────╯ │ █████████▓▓▓▓▓▓▓▓▓░░░░░░░░░  │
│ ✓ plan.md                     │                                   ╰──────────────────────────────╯
│ ◐ tasks.md     9 / 26         │
╰───────────────────────────────╯

STORIES
  ID    Title                              Progress           Status        Prio  Waiting on
  US-1  At-a-glance summary widgets        ██████████ 100%   ✓ done        P1    —
  US-2  Charts of progress and status      ██████████ 100%   ✓ done        P1    —
▸ US-3  Attention widget                   ████░░░░░░  40%   ◐ in-progress P2    —
  US-4  "Up next" widget                   ██░░░░░░░░  20%   ◐ in-progress P2    —
  US-5  Feature drill-down and phases      ░░░░░░░░░░   0%   ○ draft       P3    —
  US-6  Machine-readable aggregates        ░░░░░░░░░░   0%   ○ draft       P3    US-3, US-4

esc back  ↑↓ move  ⏎ story detail  q quit
```

### Component inventory

#### PhaseLabel
- **props:** artifacts: {spec, ui, plan, tasks}: boolean, tasks: {done, total} | null,
  storiesDone: boolean
- **states:** specified, designed, planned, tasked, implementing, done
- **tokens:** component.feature-row.phase-fg, component.feature-row.phase-done-fg
- **behavior:**
  - Given a feature's artifacts (FR-010), When the phase is derived, Then it is the furthest step
    reached: only `spec.md` → `specified`; + `ui.md` → `designed`; + `plan.md` → `planned`;
    + `tasks.md` with no task done → `tasked`; some tasks done → `implementing`; every story done →
    `done`. A missing `ui.md` does not block later phases (features without UI).

#### ArtifactItem
- **props:** file: string, state: "present" | "partial" | "pending", detail: string
- **states:** present, partial, pending
- **tokens:** component.artifact-item.present, component.artifact-item.partial,
  component.artifact-item.pending
- **behavior:**
  - Given a feature, When ARTIFACTS renders, Then spec, ui, plan and tasks each show a state and a
    detail (story count, `signed off` / `draft`, task done/total); `tasks.md` is partial until all
    tasks are checked.

#### ClarificationsPanel
- **props:** items: {line: number, text: string}[]
- **states:** default, empty
- **tokens:** component.notice.symbol, component.notice.fg, component.panel.*
- **behavior:**
  - Given N `[NEEDS CLARIFICATION` markers in `spec.md`, When the panel renders, Then its title
    shows N and each item shows the line number and the question, truncated.

#### StoryTable (existing, reused)
- **props:** stories: StoryProgress[]
- **states:** default, selected (interactive)
- **tokens:** component.story-row.bar-width, component.story-row.waiting-fg,
  component.status-chart.*, component.row.*
- **behavior:**
  - Given the feature view, When the table renders, Then it is the existing table filtered to the
    feature, plus a `Waiting on` column; `⏎` on a story opens the existing story detail (FR-015).
  - Given `--feature=X` or `--status=Y` (FR-011), When any view renders, Then cards, charts,
    Attention and Up next are computed from the filtered set only.

### Content & accessibility

- Phase names follow the spec's wording ("specified", "planned", …); the spec's US-5 independent
  test was aligned to `planned`.

## US-6 — Machine-readable aggregates

No visual surface. `--json` keeps today's array of stories untouched and adds the aggregates
(summary, status counts, per-feature completion and phase, attention, up next) alongside it; the
exact shape belongs in `plan.md` (data contract), with field names matching the widget names here.

## US-7 — Burndown over time

### Layout / wireframe

A full-width panel between Attention/Up next and Feature completion. Stacked columns, one per
period: solid = remaining tasks (bottom), shade = done tasks (top), so column height is the task
total at that time and added scope shows as a taller column. Wide (100 columns):

```
╭─ BURNDOWN · weekly ─────────────────────────────────────────────────────────────────── 120 tasks ─╮
│ 120 ┤                         ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░            │
│     │ ███████ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░            │
│     │ ███████ ███████ ███████ ███████ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░            │
│     │ ███████ ███████ ███████ ███████ ███████ ███████ ░░░░░░░ ░░░░░░░ ░░░░░░░ ░░░░░░░            │
│     │ ███████ ███████ ███████ ███████ ███████ ███████ ███████ ███████ ░░░░░░░ ░░░░░░░            │
│   0 ┤ ███████ ███████ ███████ ███████ ███████ ███████ ███████ ███████ ███████ ███████            │
│     └─────────────────────────────────────────────────────────────────────────────────           │
│       Aug 10                          Sep 14                                  Oct 12             │
│                                                                                                  │
│ █ remaining   ░ done   now: 17 remaining · 103 done · −7 this week                               │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
```

Narrow (80 columns): same panel, `component.burndown.height-narrow` rows, narrower columns:

```
╭─ BURNDOWN · weekly ─────────────────────────────────────────────── 120 tasks ─╮
│ 120 ┤                   ░░░░░ ░░░░░ ░░░░░ ░░░░░ ░░░░░ ░░░░░ ░░░░░            │
│     │ █████ █████ ░░░░░ ░░░░░ ░░░░░ ░░░░░ ░░░░░ ░░░░░ ░░░░░ ░░░░░            │
│     │ █████ █████ █████ █████ █████ ░░░░░ ░░░░░ ░░░░░ ░░░░░ ░░░░░            │
│     │ █████ █████ █████ █████ █████ █████ █████ ░░░░░ ░░░░░ ░░░░░            │
│   0 ┤ █████ █████ █████ █████ █████ █████ █████ █████ █████ █████            │
│     └─────────────────────────────────────────────────────────────           │
│       Aug 10                  Sep 14                        Oct 12           │
│                                                                              │
│ █ remaining   ░ done   now: 17 remaining · 103 done · −7 this week           │
╰──────────────────────────────────────────────────────────────────────────────╯
```

Layout rules:
- **Period** is the finest of daily → weekly → monthly whose period count fits the plot width at one
  column plus one gap per period; the chosen period is named in the title.
- Columns stretch to fill the plot width, up to `component.burndown.bar-width-max` columns each.
- Each period shows the state at its end (last commit in the period); a period with no commits
  carries the previous value. The last column is the **current working tree**, so uncommitted
  check-offs count.
- Heights are whole cells: column height = total, rounded; the remaining/done split rounded within
  it; any non-zero remaining keeps at least one solid cell.
- X labels: first, middle, last period start dates. Y labels: the max total and `0`.

### Component inventory

#### BurndownChart
- **props:** points: {periodStart: date, total: number, remaining: number}[], period: "daily" |
  "weekly" | "monthly", feature?: string, width: number, height: number, status: "ready" |
  "computing" | "no-history"
- **states:** default, computing (interactive only), no-history, filtered
- **tokens:** component.panel.*, component.burndown.remaining-fill, component.burndown.remaining-fg,
  component.burndown.done-fill, component.burndown.done-fg, component.burndown.axis-tick,
  component.burndown.axis-v, component.burndown.axis-h, component.burndown.axis-corner,
  component.burndown.axis-fg, component.burndown.label-fg, component.burndown.height-wide,
  component.burndown.height-narrow, component.burndown.bar-width-max,
  component.burndown.min-points, component.burndown.empty, component.burndown.empty-fg
- **behavior:**
  - Given a git repo where tasks were checked off on several days (FR-018), When the dashboard
    renders, Then each column's solid part matches the remaining count at that period's end and the
    legend's `now:` numbers match the TASKS card.
  - Given the project is not a git repo or has fewer than `component.burndown.min-points` periods
    with data (FR-019), When the dashboard renders, Then the panel body is the no-history line and
    every other widget renders as usual.
  - Given `--feature=014` (FR-011), When the chart renders, Then it uses only that feature's
    `tasks.md` history and the title reads `BURNDOWN · 014 · weekly`.
  - Given interactive mode, When history is still being read, Then the panel shows `computing
    history…` and fills in place without moving other panels; one-shot output waits and never
    shows this state.

### Content & accessibility

- Title: `BURNDOWN · <period>` (`· <feature>` inserted when filtered); right side `<total> tasks`.
- Legend: `█ remaining   ░ done   now: <R> remaining · <D> done · <±N> this <period-noun>`; `±N` is
  the change in remaining since the previous period (negative is progress), shown as text, not color.
- No-history copy (one line, `component.burndown.empty` glyph):
  - `— No history available: not a git repository.`
  - `— No history available yet: tasks need changes in at least 2 periods.`
- Remaining vs. done is carried by fill pattern (solid vs. shade; ASCII `#` vs `:`) and the legend,
  never color alone (FR-006, SC-006). The panel is not focusable; it adds no keys.
- Plain layout (non-TTY) replaces the chart with one series line (see Capability states).

## Interactive mode (`--interactive`)

Same overview, full screen, with focusable panels:

```
◆ AmbyKit · dashboard                             ~/src/ambystech/oss/AmbyKit · v1.2.0 · interactive
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╭─ FEATURES ───────╮ ╭─ STORIES ────────╮ ╭─ TASKS ──────────╮ ╭─ COMPLETE ────────────────────────╮
│ 16               │ │ 69               │ │ 222 / 239        │ │ 93%                               │
│ 13 done · 3 open │ │ 60 done · 9 open │ │ 17 open          │ │ █████████████████████████████▊░░  │
╰──────────────────╯ ╰──────────────────╯ ╰──────────────────╯ ╰───────────────────────────────────╯

STORY STATUS
███████████████████████████████████████████████████████████████████████████████████████▓▓▓░░░░░░░▚▚·
✓ done 60 (87%)   ◐ in-progress 2 (3%)   ○ draft 5 (7%)   ✗ blocked 1 (1%)   – deferred 1 (1%)

┏━ ATTENTION · 3 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ╭─ UP NEXT · 5 of 17 ────────────────────────────╮
┃ ▸ ✗ 015:US-4  blocked-by US-2                 ┃ │   T010  014:US-3  Attention widget model       │
┃   → 014:US-6  waiting on US-3, US-4           ┃ │   T011  014:US-3  Graph-problem detection      │
┃   ⚠ 015:US-3  depends-on US-9 — unknown story ┃ │   T014  014:US-4  Up-next selector             │
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │   T015  014:US-4  Cap + completion state       │
                                                  │   T016  014:US-4  Snapshot tests               │
                                                  ╰────────────────────────────────────────────────╯

FEATURE COMPLETION                                                       phase         clarif.
  001 core-and-claude-emitter        ██████████████████████████████ 100%   done          ·
  ⋮  (rows 002–013 elided in this wireframe; the panel lists every feature)
  014 enhanced-dashboard             ██████████▌░░░░░░░░░░░░░░░░░░░  35%   implementing  ·
  015 mcp-server                     ╌╌╌ not planned ╌╌╌╌╌╌╌╌╌╌╌╌╌╌        planned       1

tab panel  ↑↓ move  ⏎ open  f filter  s status  q quit
```

- `tab` / `⇧tab` cycle focus: Attention → Up next → Feature completion. The focused panel uses the
  heavy frame (`component.panel.focused.*`), so focus is visible without color.
- `↑↓` move the cursor inside the focused panel; `⏎` opens: Attention/Up next item → its feature
  view with the story selected; feature row → feature view. `esc` goes back.
- `f` prompts for a feature filter, `s` cycles the status filter; both apply to every widget
  (FR-011). `q` quits and restores the terminal (as in 006).

## Capability states (cross-cutting)

| Condition | Behavior |
| --- | --- |
| columns ≥ `component.layout.wide-min` | Wide layout as shown. |
| `component.layout.min-columns` ≤ columns < `component.layout.wide-min` | Narrow layout (below): cards 2×2, Attention and Up next stacked, shorter feature bars and names. |
| columns < `component.layout.min-columns` | Plain layout (below) regardless of TTY. |
| `caps.unicode` false | ASCII glyphs and fill patterns; frames become `+ - |`. |
| `NO_COLOR` | No SGR; meaning carried by glyphs and patterns (SC-006). |
| non-TTY | Plain layout: static, no frames, no color, ASCII (FR-016). |
| `--json` | Unchanged existing fields plus aggregates (FR-012). |
| not a git repo / too little history | Burndown panel shows the no-history line; nothing else changes (FR-019). |

Narrow layout (80 columns):

```
◆ AmbyKit · dashboard                                                     v1.2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╭─ FEATURES ──────────────────────────╮ ╭─ STORIES ────────────────────────────╮
│ 16                                  │ │ 69                                   │
│ 13 done · 3 open                    │ │ 60 done · 9 open                     │
╰─────────────────────────────────────╯ ╰──────────────────────────────────────╯
╭─ TASKS ─────────────────────────────╮ ╭─ COMPLETE ───────────────────────────╮
│ 222 / 239                           │ │ 93%                                  │
│ 17 open                             │ │ ███████████████████████████████▋░░   │
╰─────────────────────────────────────╯ ╰──────────────────────────────────────╯

STORY STATUS
██████████████████████████████████████████████████████████████████████▓▓░░░░░░▚·
✓ done 60  ◐ in-progress 2  ○ draft 5  ✗ blocked 1  – deferred 1

╭─ ATTENTION · 3 ──────────────────────────────────────────────────────────────╮
│ ✗ 015:US-4  blocked-by US-2                                                  │
│ → 014:US-6  waiting on US-3, US-4                                            │
│ ⚠ 015:US-3  depends-on US-9 — unknown story                                  │
╰──────────────────────────────────────────────────────────────────────────────╯
╭─ UP NEXT · 5 of 17 ──────────────────────────────────────────────────────────╮
│ T010  014:US-3  Attention widget model                                       │
│ T011  014:US-3  Graph-problem detection                                      │
│ T014  014:US-4  Up-next selector                                             │
│ T015  014:US-4  Cap + completion state                                       │
│ T016  014:US-4  Snapshot tests                                               │
╰──────────────────────────────────────────────────────────────────────────────╯

FEATURE COMPLETION                                   phase         clarif.
001 core-and-claude-emitter  ████████████████ 100%   done          ·
⋮  (all 16 features listed; rows 002–013 elided in this wireframe)
013 multi-agent-roles        ████████████████ 100%   done          ·
014 enhanced-dashboard       █████▋░░░░░░░░░░  35%   implementing  ·
015 mcp-server               ╌╌╌ not planned         planned       1
```

Plain layout (non-TTY, `NO_COLOR`, ASCII):

```
AmbyKit dashboard  ~/src/ambystech/oss/AmbyKit  v1.2.0

FEATURES 16 (13 done)   STORIES 69 (60 done)   TASKS 222/239   COMPLETE 93%

STORY STATUS
####################################################=----!!.
[#] done 60 (87%)  [=] in-progress 2 (3%)  [-] draft 5 (7%)  [!] blocked 1 (1%)  [.] deferred 1 (1%)

ATTENTION
  [x] 015:US-4  blocked-by US-2
  [>] 014:US-6  waiting on US-3, US-4
  [!] 015:US-3  depends-on US-9 - unknown story
UP NEXT (5 of 17)
  T010  014:US-3  Attention widget model
  ...

BURNDOWN (weekly, Aug 10 - Oct 12)  now 17 remaining of 120, -7 this week
  remaining: 96 90 81 72 66 52 41 33 24 17

FEATURE COMPLETION                                     phase         clarif.
008 brownfield-support      ##########  100%           done          .
014 enhanced-dashboard      ####------   35%           implementing  .
015 mcp-server              -- not planned --          planned       1
```

- Parse errors (FR-014): one `⚠ skipped specs/NNN-x/tasks.md: <reason>` notice line under the
  header (`component.notice.*`); everything else still renders.

## Sign-off

<!-- /amby.design records approval here and flips `signed_off` in the frontmatter. -->
- [x] Reviewed and approved (US-1 to US-6) — Gustavo Barrientos, 2026-10-18.
- [x] US-7 amendment reviewed and approved — Gustavo Barrientos, 2026-10-18.
