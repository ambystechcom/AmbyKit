---
feature: 028-ambykit-run          # NNN-slug
title: ambykit run (headless lane orchestration)
branch: 028-ambykit-run
status: ready                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — ambykit run (headless lane orchestration)

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

AmbyKit prepares isolated lanes and shows who works where, but a person still starts, watches and
merges every assistant by hand. `ambykit run <feature>` turns prepared lanes into **running work**: it
launches one headless assistant per lane, supervises progress, merges lanes as they finish, enforces
budgets, and stops for a person at approval gates and real conflicts. It runs the **same team
protocol** as the prompt-level `/amby.run` (spec 019) and shares its state under `.amby/fleet/<run>/`,
so either host can inspect, pause or resume a run.

Ships **experimental in 1.6** and **stable in 2.0**. Because headless flags and exit behaviour differ
per assistant and change often, each runner is verified (Principle 4) and an unverified assistant is
simply not runnable.

**Out of scope:** multi-feature fleets (spec 031), the dashboard's controls and layout (spec 029), the
MCP server itself (spec 025), and any hosted service or remote execution. Depends on specs 019, 025,
015 (lanes) and 017 (activity markers).

## User scenarios & testing

### US-1 — Preview and confirm before anything launches  (priority: P1)

As a developer, I want to see the exact commands before any assistant starts, so that nothing runs
without my approval.

- **Why this priority:** launching processes that edit code is the highest-risk action in the feature
  (Principle 7).
- **Independent test:** run `ambykit run <feature>` with no confirmation flag and confirm it prints the
  commands and exits without starting anything.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a feature with prepared lanes, When `ambykit run` is invoked without `--yes`, Then it prints the
  exact command for each lane and exits without launching.
- Given `--yes`, When `ambykit run` is invoked, Then it prints the commands first, then launches them.
- Given `--emit-script`, When `ambykit run` is invoked, Then it writes the commands to a script and
  launches nothing.
- Given a feature with no prepared lanes, When invoked, Then it says so and how to prepare them.
- Given a feature that does not exist, When invoked, Then it stops with a clear error.

### US-2 — Run one headless assistant per lane  (priority: P1)

As a developer, I want each lane started in its own worktree with an assistant chosen from my
configured targets, so that lanes progress in parallel without my attention.

- **Why this priority:** this is the headline capability.
- **Independent test:** run a feature with two lanes on two configured assistants and confirm each lane
  runs in its own worktree and checks off its own tasks.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a feature with N lanes and configured targets, When the run starts, Then one headless assistant
  is launched per lane in that lane's worktree.
- Given a lane, When its assistant starts, Then it receives only its task IDs, the artifacts it needs
  by reference and its file ownership (Principle 3).
- Given an assistant chosen for a lane, When it is launched, Then its target is one of the configured
  targets.
- Given more lanes than the concurrency cap, When the run starts, Then the extra lanes wait and start as
  slots free. The default cap is 3 concurrent assistants in total and at most 2 of one assistant type,
  both configurable. This cap applies when `run` is used alone; spec 031's fleet cap overrides it.
- Given a lane's assistant exits, When it exits, Then the run records the exit status.

### US-3 — Only run verified assistants  (priority: P1)

As a maintainer, I want only assistants whose headless behaviour is verified to be runnable, so that a
changed flag in an upstream tool cannot cause a silent misrun.

- **Why this priority:** unverified headless flags are the main risk named in the roadmap.
- **Independent test:** configure an assistant with no verified runner and confirm the run refuses it
  and names why.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given an assistant with a verified runner recorded in the compatibility matrix, When a lane is
  assigned to it, Then it can run.
- Given an assistant with no verified runner, When a lane is assigned to it, Then the run refuses with
  a message that it is not runnable and why (Principle 4).
- Given a verified runner whose recorded flags no longer work on the installed version, When it is
  launched and fails immediately, Then the run stops that lane and reports the version mismatch.
- Given the list of runnable assistants, When a person asks, Then it is shown with each one's recorded
  capabilities (such as whether it reports usage).
- Given the 1.6 launch, When the runnable list is shown, Then it contains Claude Code and Codex, each
  confirmed on a live install before shipping; every other assistant is not runnable until verified
  (Principle 4).

### US-4 — Supervise and recover stalled lanes  (priority: P1)

As a developer, I want a lane that stops making progress to be detected and restarted, so that one hung
assistant does not stall the whole feature.

- **Why this priority:** a run that cannot recover from stalls is not trustworthy unattended.
- **Independent test:** make one lane's assistant hang and confirm it is detected after the stall limit
  and restarted.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a lane in state working, When it has no activity report and no change in its task list for the
  stall limit (15 minutes by default, configurable), Then it is marked stalled.
- Given a stalled lane, When the supervisor acts, Then it stops that lane's assistant and restarts it on
  the same lane with its work so far preserved.
- Given a lane restarted twice (the restart limit), When it stalls a third time, Then the lane is paused
  and a person is asked.
- Given a paused lane at the restart limit, When a person approves moving it to a different assistant,
  Then it restarts on that assistant; without that approval it is never reassigned.
- Given a lane that is waiting or blocked by design, When no report arrives, Then it is not marked
  stalled.
- Given the dashboard's own idle limit, When the stall limit is applied, Then the two remain separate.

### US-5 — Merge lanes as they finish  (priority: P1)

As a developer, I want finished lanes merged back automatically, so that I do not merge each by hand and
conflicts reach me only when real.

- **Why this priority:** merging by hand is the remaining manual step the feature removes.
- **Independent test:** finish two lanes, one clean and one conflicting, and confirm the first merges
  and the second pauses for a person.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a lane whose tasks are all checked off, When it finishes, Then it is merged using the existing
  check-off-aware merge.
- Given a real conflict, When a merge is attempted, Then the run pauses that merge, leaves the lane
  intact and waits for a person.
- Given a paused merge, When the person resolves it and resumes, Then the run continues from there.
- Given a lane that finished with tasks still blocked or unchecked, When it ends, Then it is not merged
  and the reason is reported.
- Given several lanes finishing at once, When they merge, Then they merge one at a time in a fixed order.

### US-6 — Enforce budgets  (priority: P1)

As a developer, I want limits on time, tasks and tokens, so that an unattended run cannot run away.

- **Why this priority:** unattended runs cost money and time; limits are a safety control.
- **Independent test:** set a very low wall-clock budget and confirm the run stops and reports it.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a wall-clock budget, When it is exceeded, Then the run stops launching work, asks running lanes
  to stop at their next report and records why.
- Given a task-count budget, When the number of tasks completed reaches it, Then the run stops the same
  way.
- Given a token ceiling and a runner that reports usage, When usage reaches it, Then the run stops the
  same way.
- Given a token ceiling and a runner that does not report usage, When the run starts, Then it says the
  ceiling cannot be enforced for that runner and enforces only the other budgets.
- Given no budgets configured, When the run starts, Then wall-clock and task-count defaults apply and
  are shown.

### US-7 — Approve each user-story checkpoint  (priority: P2)

As a developer, I want the run to stop for my approval at each user-story checkpoint, so that I can check
work before the next story starts.

- **Why this priority:** it keeps a person in control, but a first version can run without gates.
- **Independent test:** run a feature with two stories and confirm the run stops after the first until
  it is approved.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a story whose tasks and verification pass, When its checkpoint is reached, Then the run stops
  and waits for approval before starting the next story.
- Given approval, When it is recorded, Then the run continues and the approval is in the run state.
- Given a rejection, When it is recorded, Then the run does not continue past the checkpoint and the
  person's reason is recorded.
- Given an unattended-run option, When it is explicitly enabled, Then checkpoints are not stopped on and
  this is shown at start.

### US-8 — Pause, resume and stop  (priority: P2)

As a developer, I want to pause, resume or stop a run from the dashboard or the terminal, through the
directive writer and CLI verb that spec 025 provides, so that I stay in control without killing
processes by hand.

- **Why this priority:** control completes the loop but a run can be stopped with a basic fallback first.
- **Independent test:** pause a running lane and confirm it stops at its next report and resumes on
  request.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a running lane, When a person pauses it (through spec 025's directive writer or CLI verb), Then
  the worker finishes its current task and stops at its next report.
- Given a paused lane, When a person resumes it, Then it continues from where it stopped.
- Given a stop, When it is requested, Then the lane ends and its state is saved.
- Given the same run, When the prompt-level `/amby.run` or another session inspects it, Then it sees the
  same pause, resume and stop state, because both share one state under `.amby/fleet/<run>/`.

### US-9 — Same team protocol as the prompt-level run  (priority: P2)

As a developer, I want headless lanes to get the same QA, architect review, review loop and claims as
`/amby.run`, so that unattended work is checked the same way as attended work.

- **Why this priority:** it keeps quality equal across hosts, but a first version can merge without it.
- **Independent test:** run a lane headless with a failing Verify line and confirm it goes through QA and
  the bounded review loop exactly as in spec 019.
- **depends-on:** [US-2, 019:US-3, 019:US-4]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a headless lane whose phase finishes, When QA runs, Then it runs the phase's Verify line and
  records the result as in spec 019.
- Given a failed review, When the loop runs, Then the verdict returns to the same lane's assistant with
  finding IDs and stops at the round limit, as in spec 019.
- Given a lane edits files, When it claims them, Then claims are advisory and released at check-off, as
  in spec 019.

## Requirements (EARS)

- FR-001  WHEN `ambykit run <feature>` is invoked without `--yes`, THE SYSTEM SHALL print the exact
  command for each lane and exit without launching.
- FR-002  WHEN `--yes` is given, THE SYSTEM SHALL print the commands first and then launch them.
- FR-003  WHEN `--emit-script` is given, THE SYSTEM SHALL write the commands to a script and SHALL NOT
  launch anything.
- FR-004  THE SYSTEM SHALL launch one headless assistant per lane in that lane's worktree, chosen from
  the configured targets, and give each only its task IDs, needed artifacts by reference and file
  ownership.
- FR-005  WHILE lanes outnumber the concurrency cap, THE SYSTEM SHALL start the remaining lanes as slots
  free. The default cap is 3 assistants in total and at most 2 of one type, configurable, and applies
  when `run` is used alone; spec 031's fleet cap overrides it.
- FR-006  IF an assistant has no verified runner recorded in the compatibility matrix, THEN THE SYSTEM
  SHALL refuse to run it and say why (Principle 4).
- FR-007  THE SYSTEM SHALL record per runner the verified headless command, its exit behaviour and
  whether it reports usage, in the compatibility matrix.
- FR-008  WHEN a lane has no activity report and no task-list change for the stall limit, THE SYSTEM
  SHALL mark it stalled, stop its assistant and restart it with its work preserved.
- FR-009  IF a lane is restarted beyond the restart limit, THEN THE SYSTEM SHALL pause it and ask a
  person. The restart limit is 2 restarts per lane, and a lane SHALL move to a different assistant only
  with that person's approval.
- FR-010  WHILE a lane is waiting or blocked by design, THE SYSTEM SHALL NOT mark it stalled.
- FR-011  WHEN a lane's tasks are all checked off, THE SYSTEM SHALL merge it using the check-off-aware
  merge, one lane at a time in a fixed order.
- FR-012  IF a merge has a real conflict, THEN THE SYSTEM SHALL pause that merge, leave the lane intact
  and wait for a person.
- FR-013  THE SYSTEM SHALL enforce a wall-clock budget and a task-count budget always, and a token
  ceiling only where the runner reports usage, stating when it cannot be enforced.
- FR-014  WHEN a budget is exceeded, THE SYSTEM SHALL stop launching work, ask running lanes to stop at
  their next report and record the reason.
- FR-015  WHEN a user-story checkpoint is reached, THE SYSTEM SHALL stop for approval before the next
  story starts, unless unattended mode was explicitly enabled and shown at start.
- FR-016  WHEN a person pauses, resumes or stops a lane, from any host, THE SYSTEM SHALL write it as a
  directive through spec 025's core directive writer or CLI verb, and the worker SHALL finish its
  current task and obey at its next report, which the run records.
- FR-017  THE SYSTEM SHALL keep run state under `.amby/fleet/<run>/`, in the same form as the
  prompt-level `/amby.run`, so either host can inspect, pause or resume it.
- FR-018  THE SYSTEM SHALL run the same team protocol as `/amby.run`, including QA, architect review,
  the review loop and claims, with the assistants launched as processes.
- FR-019  THE SYSTEM SHALL label `ambykit run` experimental in 1.6 and stable in 2.0.
- FR-020  THE SYSTEM SHALL NOT write user-level or out-of-tree files without consent (Principle 7).

## Success criteria

- SC-001  A feature with two prepared lanes runs headless on two different assistants, with both lanes
  merged and every task checked off, without a person starting or merging anything.
- SC-002  Nothing is launched without `--yes`, verified by running with and without it.
- SC-003  A hung lane is detected and restarted within the stall limit plus one check interval.
- SC-004  A run that exceeds a budget always stops and records why, in every tested scenario.
- SC-005  A run started by `ambykit run` can be paused and resumed from the prompt-level `/amby.run`, and
  the reverse, with no repeated completed tasks.
- SC-006  No unverified assistant is ever launched.
- SC-007  Every FR maps to at least one test (Principle 5), and `npm run typecheck` and `npm test` pass.
- SC-008  Feature 028 is itself run on two assistants as the 1.6 gate (Principle 6).
- SC-009  A headless lane with a failing Verify line is never merged and goes through the same bounded
  review loop as under `/amby.run`.

## Edge cases

- An assistant that exits successfully without checking off any task.
- An assistant that edits files outside its ownership, or in another lane's worktree.
- A run interrupted by closing the terminal, a crash or a reboot.
- A restarted lane whose partial edits conflict with its own earlier work.
- Two runs started for the same feature at once.
- An assistant's headless flags change after an upgrade.
- A merge that succeeds but breaks the build or tests.
- A budget reached mid-merge.
- A lane's worktree deleted while the run is active.
- Headless runs on Windows versus other platforms.

## Assumptions

- Spec 019 defines the team protocol and the shared run-state shape; spec 025 provides the activity
  reports and directives that supervision and control use; specs 015 and 017 provide lanes, merge and
  activity markers.
- The compatibility matrix gains a runner section per assistant; only rows marked verified are runnable.
- Merging uses the existing check-off-aware merge and keeps working when spec 030 moves per-task data
  into fenced blocks at 2.0; spec 030 extends the merge to read the v2 form.
- The spec format v2 decision from spike 026 precedes `run`, so `run` targets the final shape.
- The 15-minute stall limit is configurable and separate from the dashboard's 30-minute idle limit.
- One feature per run; multiple features run together only through spec 031.
