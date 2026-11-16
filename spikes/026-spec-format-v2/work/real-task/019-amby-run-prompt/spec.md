---
feature: 019-amby-run-prompt          # NNN-slug
title: Amby run (prompt-level pipeline and team protocol)
branch: 019-amby-run-prompt
status: ready                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
stories:
  - id: US-1
    priority: P1
    status: draft
  - id: US-2
    priority: P1
    status: draft
    depends-on: [US-1]
  - id: US-3
    priority: P1
    status: draft
    depends-on: [US-2, "020:US-3"]
  - id: US-4
    priority: P1
    status: draft
    depends-on: [US-3]
  - id: US-5
    priority: P1
    status: draft
    depends-on: [US-1]
  - id: US-6
    priority: P2
    status: draft
    depends-on: [US-2]
  - id: US-7
    priority: P3
    status: draft
    depends-on: [US-6]
  - id: US-8
    priority: P1
    status: draft
    depends-on: [US-1]
---

# Spec — Amby run (prompt-level pipeline and team protocol)

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Today a person drives each AmbyKit phase by hand and the assistant implements tasks alone, with no
independent check before a phase is called done. This feature adds `/amby.run <feature>`: one prompt
that carries a feature through its remaining phases, with the assistant acting as a **lead** that
hands tasks to **workers**, has **QA** and **architect** reviewers check each phase, and stops for a
person when it cannot resolve a disagreement. All run state lives in files, so a run can be inspected,
paused and resumed, and a later headless CLI can take over the same run.

**Out of scope:** the headless `ambykit run` CLI (spec 028), the MCP server and its tools (025),
multi-feature fleets (031), dashboard controls (029) and any enforced (non-advisory) file locking.
Depends on spec 020 (BLOCKED markers, Verify lines); spec 021 (test design) is a soft dependency used
where present, and 019 works without it.

## User scenarios & testing

### US-1 — Run a feature from where it stands  (priority: P1)

As a developer, I want to run one command for a feature and have it continue from the first
incomplete phase, so that I do not chain phases by hand or restate where I left off.

- **Why this priority:** this is the headline capability; everything else hangs off it.
- **Independent test:** on a feature with an approved spec and no plan, run `/amby.run` and confirm it
  starts at planning; on one with a half-checked task list, confirm it resumes implementation.

**Acceptance criteria**
- Given a feature whose spec is `ready` and which has no plan, When the run starts, Then it begins at
  the plan phase and does not redo the spec.
- Given a feature with some tasks checked, When the run starts, Then it resumes at the first unchecked,
  unblocked task and does not redo checked ones.
- Given a feature whose required artifact for the next phase is missing or not approved (for example a
  spec still `draft`), When the run starts, Then it stops before that phase and says which artifact is
  needed.
- Given a feature that is already `done`, When the run starts, Then it reports that and changes nothing.
- Given a feature number that does not exist, When the run starts, Then it stops with a clear error.

### US-2 — Workers implement tasks  (priority: P1)

As a developer, I want implementation done by worker subagents, one per task group, so that the lead
stays focused on coordination and my main context stays small.

- **Why this priority:** without workers there is no team protocol to build on.
- **Independent test:** run a phase with three tasks and confirm each is done by a worker that checks
  off its own task and reports back a short summary to the lead.

**Acceptance criteria**
- Given a phase with unblocked tasks, When the lead delegates, Then each worker receives only the task
  IDs, the artifacts it needs by reference, and its file ownership.
- Given a worker finishes a task, When it reports, Then the task is checked off and the report is one
  short line per task, not the full diff.
- Given a worker cannot proceed, When it reports, Then the task carries a BLOCKED marker (spec 020) and
  the lead continues with other unblocked tasks.
- Given an optional model preference for workers is configured, When a worker starts, Then that
  preference is applied; when none is configured, Then the host's default is used.
- Given all review roles (the six existing roles and the security role from spec 022), When a run
  executes, Then they remain read-only reviewers and are never given write access.
- Given more workers could run in parallel than the concurrency cap allows, When the lead delegates,
  Then at most 3 run at once and at most 2 of one assistant type (defaults, configurable), and the rest
  wait.
- Given a delegated task shows no report and no `tasks.md` change for 15 minutes (configurable), When
  the lead checks, Then it treats the lane as stalled and restarts it, up to 2 times; after that the
  lane pauses and the lead asks a person, and moving it to another assistant needs that person's
  approval.

### US-3 — QA verifies each phase before it passes  (priority: P1)

As a developer, I want an independent QA check of every phase, so that "done" means the phase's
Verify line and acceptance criteria actually pass.

- **Why this priority:** it is the quality payoff of the team protocol and of spec 020.
- **Independent test:** make a phase's Verify line fail and confirm the run does not pass the
  checkpoint and returns the failure to the worker.

**Acceptance criteria**
- Given all tasks in a phase are checked, When QA runs, Then it runs the phase's Verify line and checks
  the related acceptance criteria, and records the result per spec 020.
- Given a Verify failure, When QA reports, Then the checkpoint is not passed and the verdict names the
  failing finding IDs.
- Given a phase with no Verify line, When QA runs, Then it checks the acceptance criteria only and
  notes the missing Verify line.
- Given a check QA cannot run itself, When it reaches it, Then it asks the person and records the phase
  as unverified rather than passed.

### US-4 — Architect review and a bounded review loop  (priority: P1)

As a developer, I want an architect reviewer to check correctness, simplification and fit with the
plan, and failed reviews to loop back to the same worker a limited number of times, so that quality
improves without burning tokens forever.

- **Why this priority:** the loop is what turns reviews into fixes, and the bound protects cost.
- **Independent test:** force a failing review and confirm it returns to the same worker with finding
  IDs, and that after the round limit the run stops and asks a person.

**Acceptance criteria**
- Given a phase passes QA, When architect review runs, Then it reports findings by stable ID or
  approves.
- Given a failed review, When the lead returns it, Then it goes to the same worker as a short verdict
  listing finding IDs, not the full review text.
- Given the review loop has reached its round limit, When the phase still fails, Then the lead stops,
  summarizes the unresolved findings and asks a person to decide.
- Given a person decides, When they answer, Then the run continues from that decision and records it.
- Given a review approves, When the loop ends, Then the phase checkpoint is passed.

### US-5 — Pause, inspect and resume from files  (priority: P1)

As a developer, I want a run's state in files I can read, so that I can stop for the day, check what
happened and continue, in this assistant or another host.

- **Why this priority:** resumability and tool independence are core to AmbyKit's identity (Principles
  1 and 3).
- **Independent test:** stop a run mid-phase, start a new session, run `/amby.run` again and confirm it
  resumes the same run with no repeated work.

**Acceptance criteria**
- Given a run in progress, When a person inspects `.amby/fleet/<run>/`, Then the run's phase, task
  assignments, review rounds and pending decisions are readable without running a model.
- Given a run that stopped mid-phase, When `/amby.run` is invoked again for that feature, Then it
  resumes that run, not a new one.
- Given a feature with several unfinished runs, When `/amby.run` is invoked without naming one, Then
  the lead lists them and asks which to resume.
- Given a person explicitly asks for a new run on a feature, When it starts, Then it gets its own ID of
  the form `<feature>.<n>` and its own state directory.
- Given a person asks to pause, resume or stop, When it is requested, Then the request is written as a
  directive through the directive writer owned by spec 025 (019 has no writer of its own), the worker
  finishes its current task and obeys at its next report, and the state is recorded in the run state.
- Given the state files were written by one assistant, When another assistant resumes the run, Then it
  reads them and continues.
- Given a state file is missing or corrupt, When the run starts, Then it reports it and falls back to
  rebuilding state from `tasks.md`, never silently discarding work.

### US-6 — Share notes and claim files  (priority: P2)

As a worker, I want to claim files before editing and post short notes to teammates, so that parallel
workers avoid stepping on each other and share what matters.

- **Why this priority:** it makes parallel work safer, but a single-worker run is still useful without it.
- **Independent test:** have two workers claim the same file and confirm the second is told who owns it;
  confirm a note is one line with task ID, files and text.

**Acceptance criteria**
- Given a worker is about to edit files, When it claims them, Then the claim records the worker, task ID
  and files in the run's state.
- Given a file already claimed by another worker, When a second worker claims it, Then the claim is
  refused advisorily and names the owner.
- Given a task is checked off, When the check-off is recorded, Then that task's claims are released.
- Given a worker has something teammates need, When it posts a note, Then the note is a single line
  with task ID, files and text, and anything blocked goes through the lead.
- Given a worker edits a file it did not claim, When the run is checked, Then this is reported as a
  warning and not enforced.

### US-7 — Resolve overlapping work with a squad or serialization  (priority: P3)

As a lead, I want a defined way to handle overlapping claims, so that conflicting edits are avoided
without stalling the whole run.

- **Why this priority:** overlap is the rare case once file ownership is planned well.
- **Independent test:** create two tasks whose files overlap and confirm the lead either serializes them
  or forms a squad with one writer per file and a fixed merge order.

**Acceptance criteria**
- Given two workers whose claims overlap, When the lead decides, Then it either serializes them or forms
  a squad and records which.
- Given a squad, When it works, Then each file has exactly one writer and the merge order is fixed and
  recorded before work starts.
- Given a squad member needs a change in a file it does not own, When it asks, Then the request goes
  through the file's writer or the lead.

### US-8 — Work without extra infrastructure  (priority: P1)

As a developer on any supported assistant, I want `/amby.run` to work from files alone and degrade
gracefully, so that I am never blocked by missing features of my assistant.

- **Why this priority:** AmbyKit is portable across assistants; a feature that only works on one tool
  breaks that promise (Principles 1 and 4).
- **Independent test:** run on an assistant without subagent support and confirm the lead performs the
  roles itself in sequence and says so.

**Acceptance criteria**
- Given the MCP server is absent, When a run executes, Then every step works from files.
- Given the host assistant has no subagent support, When a run starts, Then the lead says so, performs
  the worker, QA and review steps itself in sequence, and keeps the same state files.
- Given an assistant whose subagent support is unverified, When a run starts, Then it is treated as
  unsupported rather than assumed to work (Principle 4).
- Given the same run is resumed on a different assistant, When it continues, Then it uses that
  assistant's capabilities without changing the state files' shape.

## Requirements (EARS)

- FR-001  WHEN a person invokes `/amby.run <feature>`, THE SYSTEM SHALL determine the feature's current
  phase from its artifacts and task state and continue from the first incomplete phase.
- FR-002  IF the artifact a phase needs is missing or not approved, THEN THE SYSTEM SHALL stop before
  that phase and name the artifact.
- FR-003  WHEN a feature is already done, THE SYSTEM SHALL report so and change nothing.
- FR-004  THE SYSTEM SHALL assign tasks to worker subagents, giving each only its task IDs, the
  artifacts it needs by reference, and its file ownership.
- FR-005  WHERE a worker model preference is configured, THE SYSTEM SHALL apply it to workers; otherwise
  THE SYSTEM SHALL use the host default.
- FR-006  THE SYSTEM SHALL keep all review roles, including the security role from spec 022, read-only
  and SHALL NOT grant them write access.
- FR-007  WHEN a worker finishes a task, THE SYSTEM SHALL check off that task and return a one-line
  summary to the lead.
- FR-008  IF a worker cannot proceed, THEN THE SYSTEM SHALL mark the task with a BLOCKED marker and
  continue with other unblocked tasks.
- FR-009  WHEN all tasks in a phase are checked, THE SYSTEM SHALL run QA, which runs the phase's Verify
  line and checks the related acceptance criteria and records the result.
- FR-010  IF QA or architect review fails a phase, THEN THE SYSTEM SHALL NOT pass the checkpoint and
  SHALL return a short verdict listing finding IDs to the same worker.
- FR-011  WHEN QA passes a phase, THE SYSTEM SHALL run architect review for correctness, simplification
  and fit with the plan, and report findings by stable ID.
- FR-012  WHEN the review loop reaches its round limit with findings unresolved, THE SYSTEM SHALL stop,
  summarize the findings and ask a person to decide. The default limit is 3 rounds per phase and is
  configurable in `.amby/config.json`.
- FR-013  THE SYSTEM SHALL keep all run state in files under `.amby/fleet/<run>/`, readable without a
  model.
- FR-014  WHEN a run is invoked for a feature with exactly one unfinished run, THE SYSTEM SHALL resume
  it; IF several are unfinished, THEN THE SYSTEM SHALL ask which to resume; a new run SHALL start only
  on explicit request and SHALL be identified as `<feature>.<n>`. A feature MAY have several runs.
- FR-015  IF run state is missing or corrupt, THEN THE SYSTEM SHALL report it and rebuild state from
  `tasks.md` without discarding completed work.
- FR-016  WHEN a person asks to pause, resume or stop, THE SYSTEM SHALL write the request as a directive
  through the directive writer owned by spec 025, have the worker finish its current task and obey at
  its next report, and record the state in the run state.
- FR-017  THE SYSTEM SHALL let a worker claim files before editing, refuse a claim on an already
  claimed file naming the owner, and release a task's claims when the task is checked off. Claims are
  advisory in 1.x.
- FR-018  THE SYSTEM SHALL provide a shared notes board in which each note is one line holding a task
  ID, files and text, and route anything blocked through the lead.
- FR-019  WHEN claims overlap, THE SYSTEM SHALL have the lead either serialize the workers or form a
  squad with one writer per file and a fixed merge order, and record the choice.
- FR-020  WHILE the MCP server is absent, THE SYSTEM SHALL perform every step from files.
- FR-021  IF the host assistant lacks verified subagent support, THEN THE SYSTEM SHALL say so and have
  the lead perform worker, QA and review steps itself in sequence using the same state files.
- FR-022  THE SYSTEM SHALL record, per assistant, whether subagents are supported, sourced from
  `docs/tool-compatibility.md` and confirmed against a live install (Principle 4). Only targets
  confirmed on a live install count as supported; all others use the fallback in FR-021.
- FR-023  WHERE a feature has test-design output (spec 021, produced in the tasks phase), THE SYSTEM
  SHALL give QA that design as the expected test cases for each phase.
- FR-024  WHEN a person decides on an escalation, THE SYSTEM SHALL record the decision in the run state
  and continue from it.
- FR-025  THE `/amby.run` prompt and its role prompts SHALL be authored once in the neutral source and
  emitted per tool, and SHALL load only the artifacts a step needs by reference (Principles 1 and 3).
- FR-026  WHEN a lane in state working shows no report and no `tasks.md` change for 15 minutes
  (configurable), THE SYSTEM SHALL treat it as stalled and have the lead restart it up to 2 times; AFTER
  that THE SYSTEM SHALL pause the lane and ask a person, who alone may approve moving it to another
  assistant or marking its task BLOCKED. Covered by US-2.
- FR-027  THE SYSTEM SHALL run at most 3 assistants at once and at most 2 of one assistant type by
  default, configurable; WHERE a fleet cap applies (spec 031), it overrides this cap. Covered by US-2.

## Success criteria

- SC-001  A run can be stopped and resumed in a new session with zero repeated completed tasks.
- SC-002  A phase whose Verify line fails is never reported as passed by a run.
- SC-003  A review loop ends, with either approval or a person's decision, within the round limit in
  every tested scenario.
- SC-004  The run's state can be understood by a person from `.amby/fleet/<run>/` alone, without
  running a model.
- SC-005  `/amby.run` completes a small feature end to end on at least two different assistants, one
  with subagent support and one without.
- SC-006  Every FR maps to at least one test or verification step (Principle 5), and `npm run
  typecheck` and `npm test` pass.
- SC-007  Feature 019 is itself built with the 020 conventions and parallel lanes, and its own tasks use
  BLOCKED markers and Verify lines (the 1.5 gate, Principle 6).

## Edge cases

- A person edits `tasks.md` or the spec while a run is paused.
- Two sessions start a run for the same feature at once.
- A worker or reviewer never returns (stall): the lead applies the 15-minute stall rule and the
  restart-then-pause policy (FR-026) rather than waiting forever.
- A task is blocked and every remaining task depends on it: the run must stop and ask, not loop.
- QA and the architect disagree about the same finding.
- A run is started in a lane worktree rather than the main checkout.
- The feature's spec changes after the plan is approved.
- The run reaches a user-story checkpoint: the prompt-level run does not stop for approval there, only
  on escalation. Story-checkpoint approval stops belong to the CLI run (spec 028).

## Assumptions

- Specs 020 (BLOCKED markers, Verify lines) and, where available, 021 (test design) ship in the same
  or an earlier release.
- A "phase" is the existing constitution → specify → design → plan → tasks → implement → converge
  chain; the run handles plan onward and treats earlier artifacts as inputs.
- The lead is the main assistant session, not a subagent.
- Per-assistant subagent capability is documented in the compatibility matrix; nothing is assumed
  beyond it.
- The state files are shared with the future headless CLI (spec 028), so their shape is stable once
  published.
