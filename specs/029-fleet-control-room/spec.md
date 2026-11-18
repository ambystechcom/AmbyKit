---
feature: 029-fleet-control-room          # NNN-slug
title: Dashboard fleet control room
branch: 029-fleet-control-room
status: in-progress                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — Dashboard fleet control room

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Once `ambykit run` (spec 028) launches several assistants at once, a person needs one place to see who
is doing what, whether work is healthy, and to steer it. This feature adds a **Fleet tab** to the
terminal dashboard: the lanes of a run with the assistant, state and last activity of each, the
review-loop state, stalled lanes highlighted, and **pause, resume, stop and approval gates** sent
through directives. It stays in the terminal, local and at zero model tokens (Principle 3); a web
dashboard is out of scope.

**Out of scope:** a web or hosted dashboard; the runner and scheduler themselves (028); the reporting
and directive mechanism (025); dependency-graph, traceability and metrics views (other specs); the
final tabbed redesign and metrics (spec 032); grouping lanes across several features, which is a 2.0
addition owned by specs 031 and 032. Depends on 025 (activity reports, directive writer, states) and
028 (run). The first UI sketch of the Fleet tab in the roadmap is a starting point for `/amby.design`, not a
final layout.

## User scenarios & testing

### US-1 — See every lane at a glance  (priority: P1)

As a developer running several assistants, I want one view of every lane in a run, so that I know
who is doing what without opening worktrees or logs.

- **Why this priority:** visibility is the base of the control room; the other stories add to it.
- **Independent test:** with one run of three lanes, open the Fleet tab and confirm each lane shows its
  assistant, state and last activity.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a run, When the Fleet tab is opened, Then its lanes are listed under the run and each shows the
  assistant, state (working, waiting, blocked, paused, done) and time since last activity.
- Given a lane's state changes, When the interactive dashboard refreshes, Then the lane updates without
  a manual reload.
- Given two lanes of the same assistant in one feature, When shown, Then they are distinct rows.
- Given no active run, When the Fleet tab is opened, Then it says so and shows nothing stale.
- Given lane data is missing or unreadable, When shown, Then the lane appears as unknown rather than
  failing the whole view.

### US-2 — See the review-loop state  (priority: P1)

As a developer, I want to see whether a lane is working, in QA or in architect review, so that I can
tell progress from rework.

- **Why this priority:** the review loop is the main source of delay and cost; it must be visible.
- **Independent test:** drive a lane through QA and review and confirm the tab shows each stage and the
  current round.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a run in the review loop, When shown, Then it displays the run's stage (working, QA, architect
  review) and the round number against the limit (these are per run in spec 025's `run.json`).
- Given a run waiting on a person's decision after the round limit, When shown, Then it is marked as
  needing a decision.
- Given a run with no review data, When shown, Then the stage is shown as working, not as an error.

### US-3 — Spot stalled lanes  (priority: P1)

As a developer, I want stalled lanes highlighted, so that I notice a stuck assistant before it wastes
an hour.

- **Why this priority:** a silent stall is the costliest failure in a fleet.
- **Independent test:** leave a working lane with no report and no task change beyond the stall limit and
  confirm it is highlighted.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a lane in state working that exceeded the stall limit (spec 025) with no report and no
  `tasks.md` change, When shown, Then it is highlighted as stalled with how long it has been quiet.
- Given a stalled lane reports again, When the view refreshes, Then the highlight clears.
- Given a lane that is waiting or done, When quiet, Then it is not highlighted as stalled.
- Given the highlight, When viewed in a terminal without color, Then it is still distinguishable by text.

### US-4 — Pause, resume and stop from the dashboard  (priority: P1)

As a developer, I want to pause, resume or stop a lane or a whole run from the dashboard, so that I can
steer without leaving the terminal or killing processes by hand.

- **Why this priority:** control is the point of a control room; without it the tab is read-only.
- **Independent test:** pause a lane, confirm it finishes its current task and pauses at its next
  report, then resume it and confirm it continues.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a selected lane, When the person chooses pause, Then a pause directive is written for that lane
  through the directive writer of spec 025, the worker finishes its current task and pauses at its next
  report, and the lane shows as pause requested until its state is paused.
- Given a paused lane, When the person chooses resume, Then a continue directive replaces the pause and
  the lane continues at its next report.
- Given a stop choice, When confirmed, Then a stop directive is written and the worker finishes its
  current task, then stops at its next report.
- Given an action on a run rather than one lane, When chosen, Then it applies to every lane in the run.
- Given a stop or pause is chosen by mistake, When the action is destructive, Then it asks for
  confirmation first.
- Given a directive is written, When the lane's latest report is older than the directive's time, Then
  the dashboard shows it as pending; once the lane's next report is dated after the directive's time,
  Then it shows it as obeyed. "Pause requested" means a pause directive exists and the lane's state is
  not yet paused.

### US-5 — Approve gates  (priority: P2)

As a developer, I want to approve story checkpoints from the dashboard, so that a run waiting on me
continues as soon as I decide.

- **Why this priority:** gates keep a person in the loop, but a run can also be approved elsewhere.
- **Independent test:** let a lane reach a gate, confirm it is shown as awaiting approval, approve it
  and confirm the lane continues.
- **depends-on:** [US-4]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a lane at an approval gate (spec 028), When shown, Then it is marked awaiting approval with the
  story it concerns.
- Given a person approves, When confirmed, Then the gate is approved through spec 028's `approveGate`
  (the same function as `ambykit run approve`), no continue directive is written, and the gate is shown
  as approved.
- Given a person declines or leaves it, When time passes, Then the lane stays paused at the gate and is
  not silently continued.
- Given several gates are waiting, When the tab is shown, Then they are listed together so none is missed.

### US-6 — Works in any terminal  (priority: P1)

As a developer on any terminal, I want the Fleet tab to look right with or without special fonts, so
that I am never blocked by my terminal.

- **Why this priority:** AmbyKit is portable; a view that needs a Nerd Font would exclude users
  (Principle 7).
- **Independent test:** open the tab in each icon mode and a narrow, plain-text terminal and confirm
  every state is readable.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given `--icons=nerd` or `AMBYKIT_ICONS=nerd`, When shown, Then Nerd Font glyphs are used.
- Given a terminal that supports Unicode but no Nerd Font, When shown, Then Unicode symbols are used.
- Given neither, When shown, Then ASCII tags are used and no state depends on a glyph.
- Given a narrow terminal, When shown, Then the tab degrades to a compact layout without overlapping or
  truncating state names.
- Given a saved `dashboard.icons` setting in `.amby/config.json` (nerd, unicode, ascii or auto), When
  the dashboard starts, Then it is applied unless overridden; precedence is the `--icons` flag, then
  `AMBYKIT_ICONS`, then the config setting, then auto-detect. This spec owns the setting; a person
  edits it by hand in `.amby/config.json` and the dashboard never writes it.

### US-7 — Keep one-shot and JSON output fast and stable  (priority: P1)

As a maintainer of scripts that read the dashboard, I want existing output to stay fast and unchanged in
shape, so that adding the Fleet tab breaks nothing.

- **Why this priority:** the 1-second budget and stable `--json` are existing promises (Principle 3).
- **Independent test:** run one-shot and `--json` on a project with and without a run and confirm timing
  and that existing fields are unchanged.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given one-shot or `--json` output, When fleet data exists, Then fleet fields are added without
  removing or renaming existing ones.
- Given one-shot output, When it runs, Then it completes within the existing 1-second budget.
- Given the heavier fleet view, When not in `--interactive`, Then it is not loaded.
- Given a project with no run, When the dashboard runs, Then output is unchanged from today.

### US-8 — Settle the terminal foundation first  (priority: P2)

As a maintainer, I want the terminal foundation chosen by a short spike before the build starts, so
that we do not commit to a dependency or a rewrite on a guess.

- **Why this priority:** it is a precondition decision, not user-visible, but it controls cost and risk.
- **Independent test:** the spike produces a recorded decision with measured effort for the Fleet tab
  on the chosen option.
- **depends-on:** []
- **blocked-by:** []
- **status:** in-progress

**Acceptance criteria**
- Given the spike, When it ends, Then a decision is recorded (as a decision record, spec 022) with the
  evidence.
- Given the recommended option (extend the existing layer), When the 1-week spike shows its build cost
  exceeds the cost of adopting Ink, Then the decision may move to Ink, with the dependency trade-off
  recorded explicitly. The options are judged on build cost versus dependency cost, terminal restore,
  fallbacks and icon width, and the decision is made before the control room starts.
- Given any option, When chosen, Then terminal restore, fallbacks and icon width behave as today.

## Requirements (EARS)

- FR-001  WHEN the Fleet tab is opened, THE SYSTEM SHALL list the lanes of a run, each with its
  assistant, state (working, waiting, blocked, paused or done) and time since last activity.
- FR-002  WHILE the interactive dashboard is open, THE SYSTEM SHALL refresh lane data without a manual
  reload.
- FR-003  IF lane data is missing or unreadable, THEN THE SYSTEM SHALL show that lane as unknown and
  keep the rest of the view.
- FR-004  THE SYSTEM SHALL show the review-loop stage (working, QA, architect review), round number and
  whether it awaits a person's decision. In spec 025's `run.json` these are recorded once per run, not
  per lane, so they describe the run's current review.
- FR-005  WHEN a working lane exceeds the stall limit with no report and no `tasks.md` change, THE
  SYSTEM SHALL highlight it as stalled with the quiet time, and clear it on the next report.
- FR-006  WHEN a person chooses pause, resume or stop for a lane or run, THE SYSTEM SHALL write a
  directive per lane (`continue`, `pause` or `stop`) through the directive writer of spec 025, last
  write wins.
- FR-007  WHILE a directive is newer than the lane's latest report, THE SYSTEM SHALL show it as pending,
  and WHILE a pause directive exists and the lane's state is not paused, SHALL show the lane as pause
  requested; a directive is obeyed once the lane's next report is dated after it.
- FR-008  IF an action is destructive (stop), THEN THE SYSTEM SHALL ask for confirmation first.
- FR-009  WHEN a lane reaches an approval gate, THE SYSTEM SHALL show it as awaiting approval, and WHEN
  approved SHALL approve the gate through spec 028's `approveGate` and SHALL NOT write a continue
  directive; IF not approved, THEN THE SYSTEM SHALL leave it paused.
- FR-010  THE SYSTEM SHALL use the three icon modes (Nerd Font, Unicode, ASCII) for every state and
  lane, so that no state depends on a Nerd Font, and keep the narrow-terminal and plain-text fallbacks.
- FR-011  WHERE `dashboard.icons` is set in `.amby/config.json`, THE SYSTEM SHALL apply it with
  precedence `--icons` flag, then `AMBYKIT_ICONS`, then the config setting, then auto-detect. This spec
  owns the setting; it is hand-edited and the dashboard SHALL NOT write it.
- FR-012  THE SYSTEM SHALL keep one-shot and `--json` output within the 1-second budget, add fleet
  fields without removing or renaming existing ones, and load the heavier fleet view only in
  `--interactive`.
- FR-013  WHERE no run exists, THE SYSTEM SHALL leave dashboard output unchanged from today.
- FR-014  THE SYSTEM SHALL run entirely locally at zero model tokens, with no network service.
- FR-015  THE SYSTEM SHALL record the terminal-foundation decision, with evidence, before the Fleet tab
  is built (spike).
- FR-016  THE SYSTEM SHALL restore the terminal to its prior state on exit, signal or error.

## Success criteria

- SC-001  A person can identify every lane's assistant, state and last activity within 5 seconds of
  opening the tab on a run of up to 10 lanes.
- SC-002  A stalled lane is highlighted within one refresh after crossing the stall limit.
- SC-003  A pause chosen in the dashboard takes effect after the worker finishes its current task, at its
  next report, in every tested scenario, and resume restores it.
- SC-004  All states are readable in each icon mode and on a narrow plain-text terminal.
- SC-005  One-shot and `--json` output stay within 1 second and keep every existing field.
- SC-006  Every FR maps to at least one test (Principle 5), and `npm run typecheck` and `npm test` pass.
- SC-007  The Fleet tab is used to supervise a real run of AmbyKit's own feature (the 1.6 gate,
  Principle 6).

## Edge cases

- A lane whose worktree was removed while the run is active.
- Two people issuing opposite directives at once: last write wins and is visible.
- A directive written for a lane that has already finished.
- A run with a large number of lanes in a short terminal: scroll, do not truncate state.
- The terminal is resized or detached while the dashboard is open.
- A worker that never reports again after a pause: the lane stays pause requested, not paused.
- Clock differences between worktrees affecting "last activity".

## Assumptions

- Spec 025 provides activity reports with lane and state (including paused), the directive file and
  the directive writer; spec 028 provides runs, lanes, gates and the stall limit. A run belongs to one
  feature until spec 031 introduces multi-feature runs.
- The dashboard already has one-shot, `--json`, `--interactive` and the three icon modes (017).
- The terminal foundation is decided by the spike (US-8) before the build starts; this spec is
  neutral about the choice.
- The redesigned tabbed layout and metrics arrive later (spec 032); this tab must fit that frame.
