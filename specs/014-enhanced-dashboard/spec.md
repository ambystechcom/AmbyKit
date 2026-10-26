---
feature: 014-enhanced-dashboard
title: Enhanced dashboard — widgets and charts
branch: 014-enhanced-dashboard
status: done
created: 2026-10-18
---

# Spec — Enhanced dashboard — widgets and charts

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

**Problem.** `ambykit dashboard` today shows one table of stories (status, progress) plus a single
"Overall" line. Users can't see at a glance where the project stands, what is blocked, which
feature is lagging, or what to work on next — they have to scan rows and do the math themselves.

**Goal.** A designed overview that answers those questions with summary widgets and simple charts,
computed locally from existing artifacts at zero model tokens (per Principle 3).

**Delivery surface.** The existing terminal views only (one-shot + `--interactive`); no HTML page.
Charts are drawn with terminal characters. (Clarified 2026-10-18.)

## User scenarios & testing

### US-1 — At-a-glance summary widgets  (priority: P1)

As a developer using AmbyKit, I want a row of summary widgets (headline numbers) at the top of the
dashboard, so that I know the project's overall state in seconds without reading the table.

- **Why this priority:** Delivers most of the value alone; every other story builds on the same aggregates.
- **Independent test:** Run the dashboard on a fixture repo with known stories/tasks and check each widget's value against hand-computed totals.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a repo with 3 features, 10 stories and 40 tasks (25 done), When I open the dashboard, Then I see widgets for total features, total stories, tasks done/total, and overall completion of 63%.
- Given stories in draft, in-progress, blocked, done and deferred, When I open the dashboard, Then a widget shows the count for each status and the counts sum to the story total.
- Given a repo with no `specs/` features, When I open the dashboard, Then widgets show zeros and a hint to run `/amby.specify`, not an error.

### US-2 — Charts of progress and status  (priority: P1)

As a developer or lead, I want visual charts of story status and per-feature completion, so that I
can spot lagging features and the overall distribution without reading numbers.

- **Why this priority:** This is the explicit ask ("charts"); per-feature completion is the comparison users most often do by hand.
- **Independent test:** On the fixture repo, verify each chart's segments/bars match the underlying counts and that every feature appears exactly once.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given stories across several statuses, When I view the status chart, Then each status is shown with its count and share, and statuses with zero stories are omitted or shown as zero consistently.
- Given 3 features at 100%, 40% and 0% task completion, When I view the per-feature chart, Then each feature shows its percentage and they are ordered by feature number.
- Given a feature with stories but no `tasks.md`, When I view the per-feature chart, Then it is shown as "not planned" rather than 0%.
- Given a terminal or viewer without color, When I view the charts, Then status is still distinguishable by label/symbol, not color alone.

### US-3 — Attention widget: blocked and stalled work  (priority: P2)

As a lead, I want a widget that lists blocked stories and stories whose dependencies are unfinished,
so that I can unblock work before it stalls the plan.

- **Why this priority:** High value for multi-story features, but the dashboard is useful without it.
- **Independent test:** Fixture with one `blocked` story and one story whose `depends-on` target is not done; both appear in the widget with the reason.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a story with status `blocked` or a `blocked-by` story that is not done, When I open the dashboard, Then it appears in the attention widget with its unfinished blocker IDs.
- Given a story whose `blocked-by` stories are all done and whose status is not `blocked`, When I open the dashboard, Then it does not appear in the attention widget.
- Given a story whose `depends-on` story is not done, When I open the dashboard, Then it is listed as "waiting on US-#".
- Given nothing is blocked or waiting, When I open the dashboard, Then the widget states "nothing blocked" instead of disappearing silently.
- Given a dependency cycle or a reference to a non-existent story, When I open the dashboard, Then it is flagged as a graph problem, not shown as a normal wait.

### US-4 — "Up next" widget  (priority: P2)

As a developer, I want the dashboard to show the next ready tasks (unblocked, not done), so that I
know what to pick up without opening `tasks.md`.

- **Why this priority:** Turns the dashboard from a report into a work driver; depends on the attention logic.
- **Independent test:** Fixture where only two tasks have all dependencies satisfied; exactly those appear, in task order.
- **depends-on:** [US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given open tasks where some belong to blocked stories, When I view "up next", Then only tasks of unblocked stories are listed, in `T###` order, capped at 5 by default, with the cap configurable.
- Given all tasks are done, When I view "up next", Then it states the work is complete and suggests `/amby.converge`.

### US-5 — Feature drill-down and workflow-phase view  (priority: P3)

As a developer, I want to see for each feature which workflow artifacts exist (spec, ui, plan,
tasks) and the open `[NEEDS CLARIFICATION]` count, so that I know which phase each feature is in.

- **Why this priority:** Useful context, but secondary to progress and blockers.
- **Independent test:** Fixture feature with `spec.md` (2 clarification markers) and `plan.md` but no `tasks.md` shows phase "planned", 2 open clarifications.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature with only `spec.md`, When I view it, Then its phase shows "specified" and missing artifacts are marked as pending.
- Given a spec with N `[NEEDS CLARIFICATION` markers, When I view it, Then the feature shows N open clarifications.
- Given I filter with `--feature=X`, When the dashboard renders, Then all widgets and charts reflect only that feature.

### US-6 — Machine-readable aggregates  (priority: P3)

As a CI author or tool integrator, I want the new aggregates in `--json` output, so that I can
build badges or checks without re-parsing specs.

- **Why this priority:** Low effort and keeps `--json` truthful, but few users need it now.
- **Independent test:** `ambykit dashboard --json --overview` on the fixture contains the summary, status counts, per-feature completion, attention and up-next data matching the visual view.
- **depends-on:** [US-1, US-2, US-3, US-4]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given existing `--json` consumers, When I run `--json`, Then the output is byte-identical to before.
- Given I run `--json --overview`, When it completes, Then the output is one object whose `stories` member equals the bare `--json` output, with the new aggregates as sibling members.

### US-7 — Burndown over time  (priority: P3)

As a lead, I want a burndown chart of open vs. completed tasks over time, so that I can see whether
work is converging and at what pace.

- **Why this priority:** Useful trend signal, but the point-in-time widgets answer the core questions without it.
- **Independent test:** Fixture git repo with commits checking off tasks on known dates; the burndown shows the matching remaining-task count per period.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a git repo where tasks were checked off across several days, When I view the burndown, Then it shows remaining vs. done tasks per period, derived from version history.
- Given a project that is not a git repo or has too little history, When I open the dashboard, Then the burndown shows "no history available" and every other widget renders normally.
- Given `--feature=X`, When I view the burndown, Then it reflects only that feature's tasks.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL compute every widget and chart locally from `specs/*/spec.md` and `specs/*/tasks.md` without invoking a model (Principle 3).
- FR-002  WHEN the dashboard opens, THE SYSTEM SHALL display summary widgets for feature count, story count, tasks done/total, and overall completion percentage.
- FR-003  WHEN the dashboard opens, THE SYSTEM SHALL display the story count per status for every status in use (draft, in-progress, blocked, done, deferred), summing to the story total.
- FR-004  WHEN the dashboard opens, THE SYSTEM SHALL display a status-distribution chart and a per-feature completion chart.
- FR-005  IF a feature has stories but no `tasks.md`, THEN THE SYSTEM SHALL mark it "not planned" instead of reporting 0% completion.
- FR-006  THE SYSTEM SHALL convey status by text label or symbol in addition to color.
- FR-007  WHEN a story has status `blocked`, a `blocked-by` target that is not done, or an unfinished `depends-on` target, THE SYSTEM SHALL list it in an attention widget with the blocking IDs.
- FR-008  IF the story graph contains a cycle or a reference to an unknown story, THEN THE SYSTEM SHALL flag it in the attention widget as a graph problem.
- FR-009  WHEN the dashboard opens, THE SYSTEM SHALL list the next N undone tasks belonging to unblocked stories, in `T###` order, where N defaults to 5 and is configurable.
- FR-010  WHEN the dashboard opens, THE SYSTEM SHALL show per feature which artifacts exist (spec, ui, plan, tasks), its derived phase, and its count of open `[NEEDS CLARIFICATION` markers.
- FR-011  WHERE `--feature` or `--status` filters are given, THE SYSTEM SHALL apply them to all widgets and charts, not only the table.
- FR-012  WHERE `--json --overview` is given, THE SYSTEM SHALL emit one object containing the unchanged bare-`--json` story list as `stories` plus all new aggregates; bare `--json` output SHALL remain unchanged.
- FR-013  IF no features exist, THEN THE SYSTEM SHALL render zeroed widgets with a hint to run `/amby.specify` and exit successfully.
- FR-014  IF a spec or tasks file cannot be parsed, THEN THE SYSTEM SHALL skip it, keep rendering the rest, and name the skipped file.
- FR-015  THE SYSTEM SHALL show the overview as the default one-shot output and keep the existing story table available via `--stories` and the feature view, and the story drill-down (`dashboard <story-id>`) unchanged.
- FR-016  WHILE output is not an interactive terminal, THE SYSTEM SHALL render the overview as static plain text (no color, ASCII, no frames) suitable for logs.
- FR-017  THE SYSTEM SHALL write nothing and add no network access; the dashboard is read-only (Principle 7).
- FR-018  WHERE the project is a git repository, THE SYSTEM SHALL display a burndown of remaining vs. completed tasks over time, derived from the version history of `tasks.md` files.
- FR-019  IF version history is unavailable or insufficient, THEN THE SYSTEM SHALL show "no history available" in place of the burndown and render all other widgets.

## Success criteria

- SC-001  A user can state overall completion, number of blocked stories, and the next task to pick within 10 seconds of opening the dashboard, without scrolling: at 100 columns all three are visible within the first 30 rows (validated by a layout check; revised 2026-10-26, replacing the ≥3-user hallway test).
- SC-002  100% of widget and chart values match hand-computed totals on the test fixtures.
- SC-003  Dashboard renders in ≤1 second for a repo with 30 features and 1,000 tasks.
- SC-004  Zero model tokens are consumed to produce the dashboard.
- SC-005  Every existing `dashboard` test and `--json` field continues to pass/exist unchanged.
- SC-006  Every status is identifiable with color disabled.

## Edge cases

- Empty repo (no `specs/`), a feature with no stories, a story with no tasks.
- Two features sharing a number (e.g. `008-*` twice) — must appear as distinct features.
- Unknown/custom status values in a spec — shown as "other", not dropped.
- Very long feature/story titles and narrow terminals — truncated, layout not broken.
- Hundreds of stories — charts stay readable (aggregate, not one mark per story).
- Tasks with no `US-#` link — counted in totals, shown as "unassigned".

## Out of scope

- Editing specs, stories or tasks from the dashboard (read-only view).
- Velocity and other historical trends beyond the US-7 burndown.
- Multi-repo / organization-level aggregation, hosted or shared dashboards.

## Assumptions

- Story status, priority, `depends-on`/`blocked-by` and task checkboxes in existing artifacts are the only data sources; no new metadata is required for P1/P2.
- The current `--interactive`, `--status`, `--feature` and `--json` flags remain the user-facing controls.
- Visual layout and widget design are produced in `/amby.design` before planning.
