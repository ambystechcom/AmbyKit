---
feature: 032-dashboard-redesign-and-metrics          # NNN-slug
title: Dashboard redesign and workflow metrics
branch: 032-dashboard-redesign-and-metrics
status: ready                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — Dashboard redesign and workflow metrics

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

By 2.0 the terminal dashboard shows more than it was laid out for: lanes, the dependency graph, quality
and coverage panels, and fleet control, each added with its own feature. This feature gathers them into
one **redesigned dashboard** — tabbed views, keyboard navigation, search and filters, a refreshed
style — and adds **workflow metrics** (how long each phase takes, how often converge finds gaps) computed
from git history. It stays in the terminal, local and at zero model tokens (Principle 3).

**Out of scope:** a web dashboard, any hosted service, new data sources beyond git history and existing
files, and the individual panels' own data (specs 023, 024 and 029 define those). The terminal
foundation was decided in spec 029's spike (ADR-004: the hand-rolled renderer is kept, no UI library);
this feature builds on it and does not revisit it.

## User scenarios & testing

### US-1 — Move between tabbed views  (priority: P1)

As a developer, I want the dashboard organized into overview, fleet, graph and quality tabs, so that I
can find what I need without scrolling one long screen.

- **Why this priority:** the tabbed frame is the redesign; everything else lives inside it.
- **Independent test:** open the interactive dashboard and confirm each of the four tabs shows its own
  content and the active tab is clear.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the interactive dashboard, When it opens, Then it shows the overview tab and a visible list of
  tabs with the active one marked.
- Given a tab is selected, When it renders, Then it shows only that tab's content: overview (features and
  progress), fleet (lanes and assistants), graph (what blocks what) or quality (coverage and findings).
- Given a tab has nothing to show (no fleet, no graph data), When it is selected, Then it says so and
  how to get data, instead of an empty or broken screen.
- Given a panel that exists from an earlier feature, When the redesign ships, Then it appears in its tab
  with no loss of information.
- Given the Fleet view from spec 029 (a full-screen view opened from the dashboard with `l`, grouped by run
  and lane only), When the redesign ships, Then it is the content of the fleet tab, and adds grouping by
  feature across features, using the lane grouping from spec 031.

### US-2 — Navigate with the keyboard  (priority: P1)

As a developer, I want to switch tabs, move through lists and open details with the keyboard, so that I
never need a mouse.

- **Why this priority:** the dashboard is a terminal tool; keyboard control is the expected interface.
- **Independent test:** perform a full tour — change tab, move to an item, open its detail, go back,
  quit — using keys only.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the interactive dashboard, When a person presses the documented keys, Then they can switch tabs,
  move through items, open and close a detail, and quit.
- Given any screen, When a person asks for help, Then the available keys are listed.
- Given a key that does nothing on the current screen, When it is pressed, Then nothing breaks and the
  screen is unchanged.
- Given the dashboard exits, When it quits or is interrupted, Then the terminal is restored to its
  previous state.

### US-3 — Search and filter  (priority: P2)

As a team lead, I want to search and filter features, stories and lanes, so that I can find one item
among many.

- **Why this priority:** it matters as the number of features and lanes grows, but the tabs work without
  it.
- **Independent test:** filter a list by status and search for a feature number and confirm only matching
  items show.
- **depends-on:** [US-1, US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a list view, When a person searches by text or ID, Then only matching items show and the match
  is clear.
- Given a list view, When a person filters by state (for example blocked, in progress, done), Then only
  items in that state show, and the active filter is visible.
- Given a filter that matches nothing, When applied, Then it says so and how to clear it.
- Given a filter or search, When it is cleared, Then the full list returns.

### US-4 — See workflow metrics  (priority: P1)

As a team lead, I want cycle time per phase and the converge gap rate over time, so that I can see
where the workflow is slow and whether quality is improving.

- **Why this priority:** the roadmap's new insight for 2.0; it turns history into signals.
- **Independent test:** run on a repository with several features' history and confirm each phase shows
  a cycle time and converge shows a gap rate over time, without any model call.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given git history for features, When metrics are computed, Then each phase shows a cycle time per
  feature and a typical value across features. Cycle time is the elapsed time from the first commit
  touching the phase's artifact to the commit that first sets that artifact to its completed state
  (spec `ready`, tasks all checked, or converge done), from git history alone.
- Given converge runs recorded in history, When metrics are computed, Then the converge gap rate is
  shown as a trend over time, defined as gap tasks appended by converge divided by the feature's
  requirement count, tracked per converge run. Converge runs are recovered from the commits that append
  gap tasks. This feature owns the trend; spec 024 does not show it.
- Given little or no history, When metrics are requested, Then it says there is not enough data instead
  of showing misleading numbers.
- Given metrics are computed, When they are shown, Then no model is called and no data leaves the
  machine.
- Given a very large history, When metrics are requested, Then the interactive view loads them without
  blocking the rest of the dashboard.

### US-5 — Keep one-shot and JSON output fast and stable  (priority: P1)

As a script author, I want the non-interactive output to stay fast and keep its shape, so that scripts
and CI keep working through the redesign.

- **Why this priority:** a redesign must not break existing consumers.
- **Independent test:** compare one-shot and `--json` output and timing before and after the redesign on
  the same project.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given one-shot or `--json` output, When it runs, Then it finishes within the existing one-second
  budget.
- Given `--json`, When new fields are added, Then existing fields keep their names and meaning.
- Given the heavier views (graph, metrics), When output is one-shot or `--json`, Then they are not
  loaded unless requested; they load in the interactive dashboard.
- Given a script reading today's output, When the redesign ships, Then it still works.

### US-6 — Work on any terminal  (priority: P1)

As a developer on a narrow, plain or older terminal, I want the dashboard to degrade cleanly, so that I
can use it anywhere.

- **Why this priority:** AmbyKit's dashboard already promises fallbacks; the redesign must keep them.
- **Independent test:** run on a narrow terminal, with no color, and with icons off, and confirm every
  state remains distinguishable.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a narrow terminal, When the dashboard renders, Then tabs and content adapt without cut-off
  information.
- Given no color or icon support, When the dashboard renders, Then states are distinguishable by text.
- Given the icon modes defined in spec 029 FR-011 (including the `dashboard.icons` setting and its
  precedence), When one is chosen, Then every new tab, state and lane in this redesign uses the same icon
  tokens for that mode.
- Given the terminal is resized, When it changes, Then the dashboard redraws to fit.
- Given output is not a terminal (piped), When run, Then it falls back to plain output.

### US-7 — A refreshed, consistent look  (priority: P2)

As a user, I want a coherent visual style across tabs, so that the dashboard is easy to scan.

- **Why this priority:** polish; valuable but not blocking.
- **Independent test:** review the design produced for the dashboard and confirm all tabs follow it.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the redesign, When it is specified, Then its layout and tokens come from an approved design
  produced with the design phase.
- Given the tabs, When they render, Then spacing, headings, colors and states are consistent across
  tabs.
- Given a state (working, blocked, done, stalled), When it appears anywhere, Then it looks the same
  everywhere.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL present the interactive dashboard as tabs: overview, fleet, graph and
  quality, with the active tab marked.
- FR-018  THE SYSTEM SHALL host spec 029's Fleet view as the fleet tab and add grouping by feature across
  features, which spec 029 provides grouped by run and lane only.
- FR-002  IF a tab has no data, THEN THE SYSTEM SHALL say so and how to get data.
- FR-003  THE SYSTEM SHALL show every panel from earlier features in its tab without loss of
  information.
- FR-004  THE SYSTEM SHALL let a person switch tabs, move through items, open and close a detail and quit
  using the keyboard, and list the keys on request.
- FR-005  WHEN the dashboard exits or is interrupted, THE SYSTEM SHALL restore the terminal.
- FR-006  WHEN a person searches or filters a list, THE SYSTEM SHALL show only matching items, show the
  active filter, and say so when nothing matches.
- FR-007  THE SYSTEM SHALL compute cycle time per phase and the converge gap rate over time from git
  history, locally and with zero model tokens. Cycle time is elapsed time from the first commit
  touching a phase's artifact to the commit that first sets it to its completed state (spec `ready`,
  tasks all checked, or converge done); the gap rate is gap tasks appended by converge divided by the
  feature's requirement count, per converge run, recovered from the commits that append gap tasks, and
  shown as a trend.
- FR-008  IF there is too little history, THEN THE SYSTEM SHALL say so instead of showing metrics.
- FR-019  THE SYSTEM SHALL read every historical revision of a spec, task list or converge commit through
  spec 030's per-file reader (026:D-9), so metrics are the same for 1.x, 2.x and mixed history, and a
  revision that cannot be read is skipped and counted, not fatal.
- FR-020  THE SYSTEM SHALL keep one-shot and `--json` output within the one-second budget with spec 030's
  reader in place, and SHALL measure it (030:FR-022).
- FR-009  THE SYSTEM SHALL keep one-shot and `--json` output within the existing one-second budget.
- FR-010  THE SYSTEM SHALL keep existing `--json` fields unchanged and only add fields.
- FR-011  WHERE the output is one-shot or `--json`, THE SYSTEM SHALL NOT load the graph or metrics
  views; those load only in the interactive dashboard.
- FR-012  WHILE the terminal is narrow or lacks color or icon support, THE SYSTEM SHALL keep every state
  distinguishable by text.
- FR-013  THE SYSTEM SHALL apply the icon modes, the `dashboard.icons` setting and its precedence defined
  in spec 029 FR-011 to every tab, state and lane added by this redesign, using the same icon tokens.
- FR-014  WHEN the terminal is resized, THE SYSTEM SHALL redraw to fit; WHEN output is piped, THE SYSTEM
  SHALL fall back to plain output.
- FR-015  THE SYSTEM SHALL render every state identically across tabs, following an approved design
  produced with the design phase.
- FR-016  THE SYSTEM SHALL stay terminal-only, local and at zero model tokens, and SHALL send no data off
  the machine (Principles 3 and 7).
- FR-017  THE SYSTEM SHALL keep working for existing users who do not use the interactive dashboard.

## Success criteria

- SC-001  A person completes a tour of all four tabs, a search and a filter using keys only.
- SC-002  One-shot and `--json` output stay within one second on the largest project in this repository,
  and existing `--json` fields are unchanged.
- SC-003  Every state remains distinguishable with colors and icons off.
- SC-004  Metrics for a project with history are computed with zero model calls and zero network use.
- SC-005  The terminal is restored in every exit path tested (quit, interrupt, error).
- SC-006  Every FR maps to at least one test or verification step (Principle 5), and `npm run typecheck`
  and `npm test` pass.
- SC-007  The redesign is itself designed with the design phase and built with AmbyKit (the 2.0 gate,
  Principle 6).

## Edge cases

- A repository with very little or rewritten git history (squashed, rebased).
- A very wide or very narrow terminal; a terminal that reports no size.
- A project with hundreds of features or lanes: lists must stay scrollable and fast.
- Metrics for a feature still in progress.
- A tab whose data source fails: the other tabs keep working.
- Output redirected to a file or another program.
- Terminals that mis-measure icon widths.

## Assumptions

- Specs 023 (graph), 024 (trace and quality) and 029 (Fleet view) are merged (1.6.0). Spec 030 (reader and
  writer for the 1.x and 2.x formats) and spec 031 (cross-feature lane grouping) land first and provide the
  data the tabs show.
- The terminal foundation is ADR-004's hand-rolled renderer; this feature does not revisit it.
- The dashboard's layout and tokens need a signed-off `/amby.design` (a person task, as in 029) before any
  tab is built; the plan puts that sign-off ahead of the tab work.
- Git history is the only source for metrics; converge runs are recoverable from the commits that
  append gap tasks.
- The existing one-second budget and `--json` shape are the compatibility baseline.
