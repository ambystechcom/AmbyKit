---
feature: 032-dashboard-redesign-and-metrics
signed_off: true                  # set true by /amby.design after review; makes UI binding
signed_off_by: Gustavo Barrientos
signed_off_date: 2026-11-19
---

# UI Design — Dashboard redesign and workflow metrics

> **Signed off (T050), 2026-11-19.** Binding for plan/tasks/implement; the decisions are recorded under "Decisions" at the end. First-class artifact. Once `signed_off: true`, this UI is binding for plan/tasks/implement.
> Tokens live in `design-tokens.json` (same folder) and **extend 014's, 017's and 029's**
> (`specs/014-enhanced-dashboard/`, `specs/017-live-dashboard/`, `specs/029-fleet-control-room/`): every inherited token keeps
> its name and is cited as-is. Conventions: `@.amby/reference/design-conventions.md`. Terminal-medium rules from 006, 014, 017
> and 029 still hold: focus is the cursor plus the heavy frame; **color is always paired with a glyph or a word**; every screen has
> a plain-text fallback; ADR-004 keeps the hand-rolled renderer, so every renderer here is a pure function of data + selection +
> capabilities.

## Design inputs

- **Built already (not redesigned):** the tab state and keys (`1`-`4`, `]`/`[`, `/` search, `?` help), the metrics model
  (`PhaseSummary[]`, `GapPoint[]`, `enough`, `reason`, `skipped`) and `--json --metrics`. The design gives them a frame and a face.
- **Bodies to host, with no loss of information (FR-003):** overview (cards, status chart, features, up-next, attention,
  burndown, worktrees), fleet (029's Fleet view), graph (023's graph view), quality (024/021 coverage and findings) **plus the new
  metrics panel**.
- **Capability tiers (inherited):** wide ≥ `component.layout.wide-min` (100); narrow < `component.layout.min-columns` (60, the same
  compact breakpoint as 029's Fleet view; this closes plan risk R4); plain / `NO_COLOR` / non-TTY; icons nerd | unicode | ascii
  (`dashboard.icons`, `--icons`, precedence from 029 FR-011).

## US-1 — Tabbed frame

### Layout / wireframe

Wide, unicode icons, overview tab active, cursor on the second feature:

```
┏━ ◆ AMBYKIT · overview ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ● live ━┓
┃  [1 overview]   2 fleet   3 graph   4 quality                                                 ┃  <- tab bar
┃  / search · s state: all                                                                      ┃  <- filter line (only when set or `/` open)
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                               ┃
┃   (the tab body: the existing overview panels, unchanged)                                     ┃
┃                                                                                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  1-4 tab · ] [ next/prev · ↑↓ item · enter detail · / search · s state · esc clear · ? help · q quit
```

Tab bar variants (the active tab is bracketed AND bold AND `semantic.color.accent-strong`; the number is always shown):

```
wide / unicode :  [1 overview]   2 fleet   3 graph   4 quality
a tab with a problem or news :   1 overview   [2 fleet ●]   3 graph   4 quality ⚠
narrow (< 60)  :  [1 ovw] 2 flt 3 gph 4 qlt
plain / ASCII  :  TABS: [1 overview] 2 fleet 3 graph 4 quality   (active tab marked with brackets, nothing else needed)
```

A tab shows a badge only when its body has something to read first: `fleet ●` = a lane is stalled, blocked or a run needs a decision;
`graph ⚠` = cycles or dangling references; `quality ⚠` = findings. The badge is a glyph; the body repeats the same fact in words.

Empty tab body (FR-002), one per tab, same shape:

```
┃  FLEET                                                                                        ┃
┃  No fleet run is active.                                                                      ┃
┃  Start one with `ambykit run <feature>` or `ambykit run 030 031`.      » 1 back to overview   ┃
```

| Tab | Empty title | How to get data |
| --- | --- | --- |
| overview | `No features yet.` | `Run ambykit init, then /amby.specify.` |
| fleet | `No fleet run is active.` | `Start one with ambykit run <feature>.` |
| graph | `No story dependencies yet.` | `Add depends-on to stories, or run ambykit graph.` |
| quality | `No coverage data yet.` | `Run ambykit trace <feature> after tests exist.` |

### Component inventory

#### tab-bar
- **props:** `tabs: Tab[]`, `active: Tab`, `badges: Partial<Record<Tab, "attention" | "warn">>`, `columns: number`, `plain: boolean`.
- **states:** default, active, badge-attention, badge-warn, narrow (short names), plain (no glyph, no color).
- **tokens:** `component.tab-bar.active.{fg,weight,open,close}`, `component.tab-bar.inactive.fg`, `component.tab-bar.number-fg`, `component.tab-bar.badge.*`, `component.tab-bar.narrow.names`.
- **behavior:**
  - Given the dashboard opens, When it renders, Then overview is active and all four tabs are listed with their numbers (US-1).
  - Given any tab is active, When it renders, Then exactly one tab is bracketed and it is the active one, with or without color.
  - Given the terminal is narrower than 60 columns, When it renders, Then names shorten to three letters and the numbers and brackets stay, so the bar never wraps.

#### tab-body-frame
- **props:** `tab: Tab`, `body: string[]`, `loading: boolean`, `error: string | null`, `empty: EmptyState | null`.
- **states:** default, loading (`loading…` with the 017 `polling` glyph), error (`could not read <source>: <reason>` in `semantic.color.warn`), empty.
- **tokens:** `component.panel` (014), `component.tab-body.loading.fg`, `component.tab-body.error.*`, `component.empty-state.*` (017).
- **behavior:**
  - Given a tab's data source fails, When it is selected, Then it shows its error line and the other three tabs still work (edge case).
  - Given metrics are still being read, When the quality tab is selected, Then the panel shows `reading history…` and the rest of the tab is usable.

### Content & accessibility

- Tab names are fixed words: `overview`, `fleet`, `graph`, `quality`. The number is the jump key and is always printed.
- Moving to a tab keeps the filter text and clears nothing else; the cursor returns to that tab's last position.
- A11y (WCAG AA): the active tab is distinguished by brackets and weight, never by color alone; contrast is inherited from 014 `$contrast`.

## US-2 — Keyboard

### Layout / wireframe

Help overlay (`?`, on every screen, same frame as 017's `overlay`):

```
┏━ KEYS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 1-4       jump to a tab                       ┃
┃ ] [       next / previous tab                 ┃
┃ ↑ ↓       move through items                  ┃
┃ enter     open detail      esc  close / clear ┃
┃ /         search           s    cycle state   ┃
┃ ? help    q quit                              ┃
┃ (this tab)  fleet: p u x pause/continue/stop  ┃
┃                    a approve                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Component inventory

#### help-overlay (extends 029's table)
- **props:** `tab: Tab`, `keys: KeyRow[]` (one map, FR-004).
- **states:** open, closed.
- **tokens:** `component.overlay.*` (017), `component.key-hints.*` (014), `component.tab-bar.number-fg`.
- **behavior:**
  - Given `?` on any screen, When pressed, Then the global keys and the current tab's own keys are listed; any key closes it.
  - Given a key with no meaning on this screen, When pressed, Then nothing changes and no notice appears (FR-004, no crash).
  - Given the app exits by `q`, interrupt or error, When it ends, Then the terminal is restored (FR-005, 017's `fullscreen`).

### Content & accessibility

Key hint line at the bottom is the long form when wide and drops to `1-4 tab · ? help · q quit` when narrow. Keys never use color to mean anything.

## US-3 — Search and filter

### Layout / wireframe

The filter line sits directly under the tab bar and shows only while a search or a state filter is set or the search prompt is open.
It applies to the list of the current tab (features, stories, lanes) and is the same row on every tab:

```
┃  / 03_ ▌            s state: blocked      3 of 41 match      esc clear                         ┃   <- typing
┃  / 030              s state: all          1 of 41 match      esc clear                         ┃   <- applied
┃  / zzz              s state: all          0 of 41 match · nothing matches · esc clears it      ┃   <- no match
```

### Component inventory

#### filter-line (17's `input` + 014's `notice`)
- **props:** `text: string`, `typing: boolean`, `state: StateFilter`, `shown: number`, `total: number`.
- **states:** hidden (nothing set), typing, applied, no-match.
- **tokens:** `component.input.*` (017), `component.filter-line.state-fg`, `component.filter-line.count-fg`, `component.notice.*` (014).
- **behavior:**
  - Given `/`, When typed text matches a feature number, name or story ID, Then only matching items show and the match is highlighted in `semantic.color.accent`.
  - Given `s`, When pressed, Then the state filter cycles `all → blocked → in progress → done → all` and the line names it.
  - Given a filter that matches nothing, When applied, Then the body says `Nothing matches "zzz". Press esc to clear.` instead of an empty list.
  - Given `esc`, When pressed with a filter set, Then both text and state clear and the full list returns.

### Content & accessibility

The match count is words (`3 of 41 match`). The active state filter is spelled out, never only a color. `/` while typing a search is text; `esc` always leaves.

## US-4 — Workflow metrics (quality tab)

### Layout / wireframe

The panel sits under the coverage and findings content of the quality tab, titled `FLOW`:

```
┏━ FLOW · from git history · 33 spec cycles · 2 converge runs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ CYCLE TIME           TYPICAL    FEATURES  (longest 3)                                         ┃
┃ spec                 1h 40m     ██████░░░░  014 3h 12m  017 2h 05m  009 1h 58m                ┃
┃ plan                 3h 10m     ████████░░  023 6h 40m  027 5h 02m  019 4h 30m                ┃
┃ tasks                2h 05m     ██████░░░░  026 4h 15m  022 3h 20m  029 3h 01m                ┃
┃ converge             —          no completed cycle yet                                        ┃
┃                                                                                               ┃
┃ CONVERGE GAP RATE    gap tasks per requirement, per converge run                              ┃
┃ ▁▃▅▂▁   latest 0.12 (3 gap tasks / 25 requirements)  ·  trend ↓ improving since 011         ┃
┃ 011 0.30 · 020 0.21 · 025 0.15 · 028 0.14 · 030 0.12                                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

Loading, too little history and a skipped-revisions note (FR-008, FR-019):

```
┏━ FLOW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ reading history…                                                                              ┃   <- loading (the rest of the tab is usable)
┃ Not enough history for metrics yet: only 1 feature has a finished phase.                      ┃   <- too-little-history
┃ Not a git repository, so there is no history to read.                                         ┃   <- not-a-repo
┃ git is not available, so metrics cannot be computed.                                          ┃   <- git-missing
┃ 2 revisions could not be read and were skipped.                                               ┃   <- footer when skipped > 0
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

Narrow (< 60 columns): one metric per row, no bars, no longest-3 list:

```
┏━ FLOW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ spec      1h 40m typical
┃ plan      3h 10m typical
┃ tasks     2h 05m typical
┃ gap rate  0.12 now, ↓ improving
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

Plain / ASCII (bars become `#`/`.`, the sparkline becomes `_.-=`, `↓` becomes `down`):

```
FLOW  from git history  33 spec cycles  2 converge runs
cycle time    typical   longest
spec          1h 40m    014 3h 12m, 017 2h 05m, 009 1h 58m
gap rate: latest 0.12 (3 gap tasks / 25 requirements), trend down (improving)
  011 0.30, 020 0.21, 025 0.15, 028 0.14, 030 0.12
```

### Component inventory

#### metrics-panel
- **props:** `metrics: Metrics | null`, `loading: boolean`, `columns: number`, `plain: boolean`.
- **states:** loading, ready, too-little-history, not-a-repo, git-missing, skipped-note, narrow, plain.
- **tokens:** `component.metrics.title-fg`, `component.metrics.label-fg`, `component.metrics.value-fg`, `component.metrics.bar.{fill,empty,fg}`, `component.metrics.spark.{glyphs,fg}`, `component.metrics.trend.{improving,worsening,flat}`, `component.metrics.note-fg`, `component.panel` (014).
- **behavior:**
  - Given `enough` is false, When the panel renders, Then it shows the `reason` sentence and no numbers (FR-008).
  - Given a phase with no completed cycle, When it renders, Then its typical column is `—` and the row says `no completed cycle yet`; an in-progress feature is not counted as a cycle.
  - Given gap points, When it renders, Then the sparkline, the latest value with its two counts, and a trend word (`improving`, `worsening`, `flat`) all show; the word carries the meaning, the arrow only reinforces it.
  - Given `skipped > 0`, When it renders, Then the footer says how many revisions were skipped (FR-019).
  - Given metrics are computed, Then nothing in this panel names a model, a network call or a path outside the repo (FR-016).

### Content & accessibility

- Durations: `<n>m`, `<h>h <m>m`, `<d>d <h>h`; never seconds. Rates: two decimals. Phase names are fixed words.
- The bar is relative to the longest feature in that phase and always has the number beside it; it is decoration.
- Trend threshold: improving when the latest rate is at least 10% below the median of the previous runs, worsening when at least 10% above, flat otherwise (stated here so the renderer and its test share one rule).

## US-5 — Fast and stable one-shot / `--json`

No visual change. The tab frame, the tab bar and the filter line exist only in the interactive dashboard. One-shot text and `--json` keep their shape; metrics add fields only under `--metrics` (built). No component here is imported by the one-shot path (FR-011, guarded by T091).

## US-6 — Any terminal

### Layout / wireframe

Narrow overview tab (< 60 columns; header, tab bar and hint line adapt, the body uses 014's existing compact layout):

```
┏━ ◆ AMBYKIT · overview ━━━━ ● ┓
┃ [1 ovw] 2 flt 3 gph 4 qlt
┃ / 030        1 of 41 match
┃ …compact overview body…
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
 1-4 tab · ? help · q quit
```

States stay distinguishable without color or icons: every state is its word (`working`, `waiting`, `blocked`, `paused`, `done`,
`stalled`, `unreported`, `unknown`) and the glyph is decoration. Icon modes follow 029: unicode, ascii, and nerd (which reuses the
unicode glyph until code points are verified). New glyphs this design adds (tab badge, sparkline, bar) have unicode and ascii forms
in `primitive.glyph`. Resize re-flows between wide, narrow and plain without losing the active tab, the cursor or the filter.

### Component inventory

#### terminal-layout (extends 029's `fleet-layout`)
- **props:** `columns: number`, `rows: number`, `color: boolean`, `unicode: boolean`, `icons: "nerd" | "unicode" | "ascii"`.
- **states:** wide, narrow, plain.
- **tokens:** `component.layout.wide-min`, `component.layout.min-columns` (014), `component.dashboard-layout.*`.
- **behavior:**
  - Given a piped or non-TTY output, When it runs, Then the plain one-shot output is used and no tab frame is drawn (FR-014).
  - Given a resize, When the terminal changes size, Then the frame redraws to fit on the next frame.
  - Given a terminal that reports no size, When it renders, Then it assumes 80 columns and the wide-to-narrow rule applies.

## US-7 — One consistent look

### Layout / wireframe

One state vocabulary across all four tabs. A state has one word, one glyph pair and one color token, used by every tab, panel and row:

| State | Word | Glyph (u / a) | Color token | Seen in |
| --- | --- | --- | --- | --- |
| working | `working` | `▶` / `[>]` | `semantic.state.working` | overview features, fleet lanes, graph nodes |
| waiting | `waiting` | `◷` / `[~]` | `semantic.state.waiting` | fleet lanes, features waiting on a dependency |
| blocked | `blocked` | `⊘` / `[x]` | `semantic.state.blocked` | stories, lanes, graph nodes |
| paused | `paused` | `‖` / `[\|]` | `semantic.state.paused` | lanes, features paused by a fleet |
| done | `done` | `✓` / `[v]` | `semantic.state.done` | stories, lanes, features, converge |
| stalled | `STALLED <n>m` | `⚠` / `[!]` | `semantic.state.stalled` + bold | lanes |

`semantic.state.*` is an alias layer over 029's `fleet-*` colors and glyphs, which already reuse 014's (working = `state-in-progress`,
done = `state-done`, blocked and stalled = `state-blocked`, paused = `warn`, waiting = `muted`), so no color or glyph changes in the
panels that exist today; only the *name* becomes shared. Spacing: one blank row between panels
(`semantic.space.panel-gap`), titles use `semantic.weight.heading`, panels use `component.panel` with the heavy frame for focus.

### Component inventory

#### state-badge
- **props:** `state: State`, `quietMinutes?: number`, `icons: "nerd" | "unicode" | "ascii"`.
- **states:** one per row of the table above.
- **tokens:** `component.state-badge.<state>.{glyph,fg}`, `semantic.state.*`.
- **behavior:**
  - Given a state appears in any tab, When it renders, Then it uses the same glyph, word and color as every other tab (FR-015).
  - Given `NO_COLOR` or ascii icons, When it renders, Then the word alone identifies the state.

## US-1 (fleet tab) — Grouping by feature across features

029's Fleet view groups lanes by run and lane. In the fleet tab, when a fleet run (031) exists, lanes are grouped by feature, features in
fleet order, and each feature header carries its fleet-level state. A single-feature run shows no group header (it looks exactly like
029's view, so nothing changes for 1.6 users).

```
┏━ FLEET · fleet-1 · 3 features · 4 of 6 assistants · caps 3 total / 2 per type ━━━━━━━━━ ● live ━┓
┃ ▾ 030-spec-v2-and-migrate     done      3 of 3 lanes merged                                     ┃
┃ ▾ 031-multi-feature-fleets    working   waits for: —                                            ┃
┃ ▸   lane-1-1   ✸ Claude    ▶ working   1m   —                                                  ┃
┃     lane-1-2   ◎ Codex     ▶ working   21m  STALLED 21m                                         ┃
┃ ▾ 032-dashboard-redesign…     waiting   waits for: 031-multi-feature-fleets (merging)           ┃
┃ ▸ 033-example                 paused    cause: lane-2-1 failed twice · 033 and 0 dependents     ┃
┣━ GATES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 031 phase-2 · after US-3, US-4 · awaiting approval                                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  ↑↓ item · ←/→ collapse/expand feature · p u x lane · P U X whole fleet · a approve · ? help
```

### Component inventory

#### fleet-feature-row
- **props:** `feature`, `state: State`, `lanes`, `expanded: boolean`, `waitsFor: string[]`, `pauseCause: string | null`.
- **states:** expanded (`▾`), collapsed (`▸`), selected, waiting, paused, done.
- **tokens:** `component.fleet-feature.{glyph-open,glyph-closed,name-fg,cause-fg}`, `component.state-badge.*`, `component.fleet-lane.*` (029).
- **behavior:**
  - Given a feature waits on another, When it renders, Then the row names what it waits for and why (`merging`, `not started`).
  - Given a feature is paused, When it renders, Then the row names the cause and the affected dependents (031 US-4).
  - Given `←`/`→` on a feature row, When pressed, Then its lanes collapse or expand; collapsed features show their lane count and worst state.
  - Given directives, When `p`/`u`/`x` act on a lane and `P`/`U`/`X` on the whole fleet, Then 029's confirm dialog and directive rules apply unchanged.

## Help overlay additions

| Key | Where | Action |
| --- | --- | --- |
| `1`-`4` | any tab | jump to a tab |
| `]` `[` | any tab | next / previous tab |
| `/` | list tabs | search by text or ID |
| `s` | list tabs | cycle the state filter |
| `esc` | any | clear filter, close a detail or the overlay |
| `← →` | fleet | collapse / expand the feature under the cursor |

## Decisions

Answered by the person on 2026-11-19 (questions 1, 2 and 3 were asked; 4, 5 and 6 are the draft's choices, approved with the sign-off):

1. **Metrics placement: inside the quality tab** as the `FLOW` panel below coverage and findings. Four tabs stay (FR-001); no fifth tab.
2. **Filter scope: one shared filter line** under the tab bar, applied to the active tab's list and kept when changing tabs.
3. **Tab badges: yes.** `fleet ●` and `graph ⚠` / `quality ⚠` only when the body has something to read first; the body says it in words.
4. **Tab bar position:** its own row directly under the header, numbers always shown.
5. **Narrow width:** 029's compact breakpoint (60 columns) for every tab, tab names shorten to `ovw/flt/gph/qlt`; no second breakpoint. (Closes plan risk R4.)
6. **Trend rule:** improving or worsening at a 10% move from the median of earlier converge runs; otherwise flat.

## Sign-off

<!-- /amby.design records approval here and flips `signed_off` in the frontmatter. -->
- [x] Reviewed and approved (2026-11-19, Gustavo Barrientos; decisions above).
