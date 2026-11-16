---
feature: 025-mcp-server          # NNN-slug
title: AmbyKit as an MCP server
branch: 025-mcp-server
status: in-progress                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — AmbyKit as an MCP server

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Assistants today learn project state by reading whole files (`tasks.md`, specs) and change it by
free-form edits, which costs tokens and lets a bad edit corrupt state. This feature adds `ambykit mcp`:
a local server through which an assistant **asks** for exactly the state it needs (Principle 3 taken
further) and **changes** state through one validated path. It also carries the small set of fleet tools
that the team protocol of spec 019 needs: reporting activity, claiming files and posting notes.

**Out of scope (deferred until real fleet runs show the need):** a `reassign` directive, `role` and
`note` fields on the activity marker, note kinds, claim timeouts and hook enforcement of claims, and
direct messages between agents. Also out of scope: the headless runner (spec 028) and any hosted
service. Depends by number on 023 (shared dependency graph) and 019 (team protocol).

## User scenarios & testing

### US-1 — Ask for project state, not whole files  (priority: P1)

As an assistant, I want to ask for the next unblocked task, a story's status and blockers, my lane's
task list and the analyze report, so that I read a few lines instead of whole artifacts.

- **Why this priority:** this is the headline token saving and the base for every other tool.
- **Independent test:** ask for the next unblocked task on a sample feature and confirm the answer is
  one task with its ID, text and file ownership, with no full-file read.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature with unchecked tasks, When the next-task tool is asked, Then it returns the first
  unblocked, unchecked task and its file ownership.
- Given a story with blockers, When its status is asked, Then it returns the status and each blocker
  by ID.
- Given a lane, When its task list is asked, Then it returns only that lane's tasks.
- Given the analyze report is asked for, When it runs, Then it returns the same findings as
  `ambykit analyze`, at zero model tokens.
- Given no unblocked task remains, When the next-task tool is asked, Then it says so and why (done or
  all blocked).
- Given an unknown feature, story or lane, When it is asked for, Then it returns a clear error naming
  what was not found.

### US-2 — Change state through one validated path  (priority: P1)

As an assistant, I want to tick a task and update a story's status through tools that validate the
change, so that state cannot be corrupted by a free-form edit.

- **Why this priority:** correctness of shared state is what makes parallel work and fleets safe.
- **Independent test:** tick a task through the tool and confirm only that checkbox changes; attempt an
  invalid status and confirm it is refused.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given an unchecked task, When it is ticked through the tool, Then only that task's checked state
  changes and nothing else in the file.
- Given an already-checked or unknown task ID, When it is ticked, Then the tool reports it and changes
  nothing.
- Given a story status update to a valid value, When applied, Then only that story's status changes.
- Given an invalid status value, When applied, Then it is refused with the allowed values.
- Given two lanes changing different tasks in the same file at once, When both apply, Then both changes
  survive.

### US-3 — Report activity and receive a directive  (priority: P1)

As an assistant working in a lane, I want to report what I am doing and learn whether to continue,
pause or stop, so that the dashboard shows me and a person can steer me at no extra cost.

- **Why this priority:** it is the control channel for fleets and the live dashboard.
- **Independent test:** report from two lanes of the same agent kind and confirm two markers exist; set
  a pause directive and confirm the next report returns it.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a report with feature, agent, phase, state and optional task and lane, When it is made, Then an
  activity marker is written that existing readers still understand.
- Given two agents of the same kind in different lanes, When both report, Then each has its own marker
  and neither overwrites the other.
- Given a report, When it returns, Then it carries a short acknowledgement and a directive of continue,
  pause or stop.
- Given a pause directive written for a lane, When that lane next reports, Then the report returns
  pause, and it keeps returning pause until a new directive is written.
- Given no directive file for a lane, When it reports, Then the directive is continue.
- Given an error while reporting, When the call returns, Then it returns a warning and never fails the
  agent.
- Given progress, When the dashboard shows it, Then it is derived from `tasks.md` and was not supplied
  by the report.
- Given a report that omits the run, When the feature has exactly one unfinished run, Then that run is
  used; When several are unfinished, Then the report returns a warning naming them and does not fail
  the agent.
- Given a lane that reports state `paused`, When its status is read, Then it shows as paused.
- Given a pause directive newer than the lane's latest report and a state other than paused, When
  status is read, Then it shows as pause requested, and pending until the lane's next report.
- Given a lane's next report is dated after a directive's `at`, When status is read, Then the directive
  shows as obeyed.

### US-4 — Claim files and share notes  (priority: P2)

As a worker, I want to claim files before editing and post one-line notes, so that parallel workers
avoid each other and share what matters, as the team protocol of spec 019 describes.

- **Why this priority:** it makes parallel work safer, but a single worker is useful without it.
- **Independent test:** claim a file from two workers and confirm the second is refused with the owner's
  name; check off the task and confirm the claim is released.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given an unclaimed file, When a worker claims it, Then the claim records worker, task ID and file.
- Given a file claimed by another worker, When a second worker claims it, Then the claim is refused and
  the owner is named.
- Given a task is checked off, When the tick is recorded, Then that task's claims are released.
- Given a worker posts a note with a task ID, files and text, When it is stored, Then it is one line and
  readable by teammates and the lead.
- Given a note with no task ID or more than one line, When it is posted, Then it is refused with the
  expected form.

### US-5 — Know when a lane has stalled  (priority: P2)

As a lead or supervisor, I want a defined rule for a stalled lane, so that stuck work is detected
without constant polling.

- **Why this priority:** unattended runs need it, but manual runs do not.
- **Independent test:** leave a lane in working state with no report and no task change past the limit
  and confirm it reads as stalled.
- **depends-on:** [US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a lane in state working with no report and no `tasks.md` change for 15 minutes, When it is
  read, Then it is reported as stalled.
- Given the stall limit is configured, When it is read, Then the configured value is used.
- Given a lane in state waiting, blocked or done, When time passes, Then it is not reported as stalled.
- Given the dashboard's own idle limit, When both apply, Then they are independent of each other.

### US-6 — Set up and fall back safely  (priority: P1)

As a maintainer, I want the server to be opt-in, project-local and optional, so that nothing breaks for
people who do not use it.

- **Why this priority:** least surprise and portability (Principles 4 and 7) must hold.
- **Independent test:** run every phase prompt with the server absent and confirm it works from files;
  enable the server for one target and confirm only that project config changes.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the server is not configured, When any phase prompt runs, Then it works from files as today.
- Given a target whose MCP config format is verified in the compatibility matrix, When the server is
  enabled for it, Then the project-level config is written there and nowhere else.
- Given a target whose format is not verified, When the server is enabled for it, Then nothing is
  written and the user is told why.
- Given a user-level config would be needed, When enabling, Then it is written only with explicit
  consent and kept out of the repo-in-sync check.
- Given `ambykit sync` runs twice, When no sources changed, Then the second run produces no diff.

### US-7 — Steer a lane from any host  (priority: P1)

As a person or supervisor, I want one way to pause, resume or stop a lane from the prompt, the terminal
or the dashboard, so that every host controls workers the same way and the result is visible.

- **Why this priority:** without one owner of directives, pausing works in one host and not another.
- **Independent test:** pause a lane from the terminal, confirm its next report returns pause and it
  then shows paused; resume it and confirm the next report returns continue.
- **depends-on:** [US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a lane, When a person pauses it from any host, Then a pause directive is written through the one
  directive writer and the lane's next report returns pause.
- Given a paused lane, When a person resumes it, Then `continue` is written and the next report returns
  continue.
- Given a stop request, When it is written, Then the lane finishes its current task and stops at its
  next report.
- Given two hosts writing a directive for the same lane, When both write, Then the last write wins.
- Given a lane name that does not exist in the run, When a directive is written for it, Then the writer
  refuses it and names the lane.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL provide read tools that return the next unblocked task, a story's status and
  blockers, a lane's task list and the analyze report, each by stable ID and without whole-file reads.
- FR-002  IF a requested feature, story, task or lane does not exist, THEN THE SYSTEM SHALL return an
  error naming it.
- FR-003  WHEN a task is ticked through a write tool, THE SYSTEM SHALL change only that task's checked
  state and SHALL refuse unknown or already-checked tasks.
- FR-004  WHEN a story status is updated, THE SYSTEM SHALL accept only valid status values and SHALL
  change only that story.
- FR-005  WHILE several lanes write different tasks of one file, THE SYSTEM SHALL preserve all of their
  changes.
- FR-006  THE SYSTEM SHALL provide `report_activity` taking feature, agent, phase, optional task, lane
  and run, and state (working, waiting, blocked, paused or done), and SHALL NOT accept progress as
  input.
- FR-007  THE `report_activity` tool and the `ambykit activity` verb SHALL both call one core writer, and
  the marker SHALL remain a superset of the existing 017 marker so existing readers keep working.
- FR-008  WHERE a lane is given, THE SYSTEM SHALL name the marker file `<feature>.<agent>~<lane>.json`,
  readers SHALL take the agent from the file body, and single-lane runs SHALL behave as today.
- FR-009  WHEN `report_activity` completes, THE SYSTEM SHALL return a short acknowledgement and a
  directive of continue, pause or stop.
- FR-010  THE SYSTEM SHALL store one directive per lane at `.amby/fleet/<run>/directives/<lane>.json` in
  the primary checkout, with the shape `{ action, at }`.
- FR-011  WHILE a directive exists for a lane, THE SYSTEM SHALL keep returning it until a new one is
  written, the last write winning; a lane with no directive file SHALL mean continue.
- FR-012  IF `report_activity` fails, THEN THE SYSTEM SHALL return a warning and SHALL NOT fail the agent.
- FR-013  THE SYSTEM SHALL have a worker report at task start, at task end, and when blocked or waiting,
  and SHALL NOT report on a timer.
- FR-014  WHEN a lane in state working has no report and no `tasks.md` change for 15 minutes, THE SYSTEM
  SHALL report it as stalled; the limit SHALL be configurable and independent of the dashboard's
  30-minute idle limit.
- FR-015  THE SYSTEM SHALL provide `claim_file`, refusing a claim on an already-claimed file and naming
  the owner, and SHALL release a task's claims when it is checked off.
- FR-016  THE SYSTEM SHALL provide `post_note` accepting one line holding a task ID, files and text, and
  SHALL refuse notes that are not in that form.
- FR-017  WHERE the server is not configured, THE SYSTEM SHALL leave every phase prompt working from
  files.
- FR-018  THE SYSTEM SHALL write a target's project-level MCP config only where
  `docs/tool-compatibility.md` verifies its format, and SHALL write user-level config only with explicit
  consent (Principles 4 and 7).
- FR-019  THE SYSTEM SHALL emit its setup per tool from the neutral source, with `ambykit sync`
  producing no diff on a repeat run (Principles 1 and 6).
- FR-020  WHEN a directive of pause or stop is returned, THE SYSTEM SHALL apply it as the worker's
  protocol defines: the worker finishes its current task, then obeys the pause or stop at its next
  report.
- FR-021  THE SYSTEM SHALL expose a lane and a state on the `ambykit activity` verb through optional
  flags `--lane=<id>` and `--state=working|waiting|blocked|paused|done`, and invocations without them
  SHALL behave exactly as today.
- FR-022  THE SYSTEM SHALL derive directive status from the directive and the lane's reports: "pause
  requested" WHILE a pause directive exists and the lane's state is not paused; "paused" WHEN the lane's
  state is paused; "pending" WHILE a directive is newer than the lane's latest report; "obeyed" WHEN
  the lane's next report is dated after the directive's `at`.
- FR-023  THE SYSTEM SHALL provide one core directive writer and a CLI verb (named in the plan) that
  write a lane's directive of continue, pause or stop to `.amby/fleet/<run>/directives/<lane>.json`;
  pause, resume and stop from any host (the prompt, the terminal or the dashboard) SHALL call it, and
  resume SHALL write `continue`.
- FR-024  WHERE `report_activity` is called without a run, THE SYSTEM SHALL use the feature's single
  unfinished run, and IF several are unfinished, THEN THE SYSTEM SHALL return a warning naming them
  and SHALL NOT fail the agent.

## Success criteria

- SC-001  Asking for the next task or a story's status returns under 1 KB, and under 10% of the size of
  the `tasks.md` or spec it was read from, at zero model tokens on the server side.
- SC-002  No tool call can leave `tasks.md` in a state that existing tooling cannot parse.
- SC-003  A report returns a directive within the dashboard's one-second budget and never fails the
  calling agent.
- SC-004  With the server absent, 100% of phase prompts complete from files.
- SC-005  Two lanes of the same agent kind produce two distinct activity markers and no overwrites.
- SC-006  Every FR maps to at least one test (Principle 5), and `npm run typecheck` and `npm test` pass.
- SC-007  Feature 025 is itself built with its tools used by at least one lane (the 1.5 gate, Principle
  6).

## Edge cases

- A task ticked by a tool while a person edits the same line by hand.
- A stale claim left by a crashed worker: claims are advisory in 1.x and have no timeout yet.
- A directive file left from a previous run with the same lane name.
- A lane that moves between worktrees; the primary checkout still holds its directive.
- Several unfinished runs for one feature and a report that names none: a warning, never a failure.
- A git repository without worktrees: the primary checkout is the only place.
- Two assistants of the same kind with no lane given.
- A very large feature: tools return slices, not the full set.
- The server started in a project with no `.amby/` directory.

## Assumptions

- The activity marker (017), parallel lanes (015) and `ambykit analyze` already exist and keep their
  current shape; this feature extends them additively.
- The shared dependency graph (023) is available for blockers; without it blockers come from today's
  `depends-on` and `blocked-by` fields.
- Per-target MCP config formats are recorded in `docs/tool-compatibility.md`; nothing is assumed
  beyond it.
- The team protocol (019) owns what claims and notes mean; this feature only provides the tools.
- Progress is always derived from `tasks.md`, never reported.
