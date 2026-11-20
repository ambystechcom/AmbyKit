---
feature: 031-multi-feature-fleets          # NNN-slug
title: Multi-feature fleets
branch: 031-multi-feature-fleets
status: in-progress                   # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — Multi-feature fleets

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

A single run drives one feature. Real work is several features at once, some depending on others and
some touching the same files, and today a person must start, order and merge each by hand. This feature
lets one command schedule the lanes of **several features as one fleet**: lanes are planned across
features by file ownership and by feature dependencies, a feature waits for the one it depends on, and
each feature keeps its own worktree, gates and merge. One supervisor watches the whole fleet, and
budgets apply across it. This is a 2.0 priority.

**Out of scope:** running a single feature (spec 028), the structured spec data it reads (spec 030),
the shared dependency graph (spec 023), the dashboard views (specs 029 and 032) and any hosted or
remote scheduling. Single-feature `ambykit run` (028) and the Fleet view (029) shipped in 1.6.0; fleets build on them and
on spec 030's reader, so they ship with or after 030 in 2.0.

## User scenarios & testing

### US-1 — Start several features as one fleet  (priority: P1)

As a developer, I want to name several features in one command and have them scheduled together, so
that I do not start, order and watch each feature by hand.

- **Why this priority:** this is the capability; every other story constrains how the fleet behaves.
- **Independent test:** name three features, one depending on another, and confirm a single fleet plan
  lists every feature's lanes and the order they start in.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a list of feature numbers, When the fleet is started, Then it plans the lanes of all of them as
  one fleet and shows the plan before running anything.
- Given a feature number that does not exist or is not ready to run, When the fleet is planned, Then it
  stops before starting and names the feature and the reason.
- Given the same feature listed twice, When the fleet is planned, Then it is scheduled once.
- Given the plan is shown, When the person confirms, Then the fleet starts; when they decline, Then
  nothing is started.
- Given a fleet of one feature, When it is started, Then it behaves as a single run.

### US-2 — Serialize features that own the same file  (priority: P1)

As a developer, I want features that edit the same file to run one after the other, so that parallel
work never produces avoidable merge conflicts.

- **Why this priority:** shared files are the main source of conflicts across features.
- **Independent test:** give two features overlapping file ownership and confirm the second starts only
  after the first has merged.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given two features that own the same file, When the fleet is planned, Then they are serialized, in
  dependency order and then by feature number.
- Given a serialized pair, When the first feature merges, Then the second starts after that merge and
  works from the merged result.
- Given two features with no shared file ownership, When the fleet is planned, Then they may run at the
  same time.
- Given the fleet plan, When a person reads it, Then each serialization names the shared files that
  caused it.
- Given a feature has a task with no file ownership (a 1.x task with no trailing path, or a 2.x task with
  no entry in its phase's `files` block), When the fleet is planned, Then the feature is flagged by task and
  treated conservatively (as owning everything it could touch) rather than assumed to be independent.
- Given some features are in the 1.x spec format and some in 2.x, When the fleet is planned, Then
  ownership and dependencies are read the same way for both.

### US-3 — Make a feature wait for the one it depends on  (priority: P1)

As a developer, I want a feature to start only after the feature it depends on is done, so that work is
built on what it needs.

- **Why this priority:** a dependent feature started too early builds on something that is not there.
- **Independent test:** declare that feature B depends on A and confirm B's lanes do not start until A
  has merged.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given feature B depends on feature A, declared either by B's feature-level `depends-on` (v2 frontmatter,
  030:C-2) or by a story of B depending on a story of A (`NNN:US-#`, either format), When the fleet runs,
  Then B does not start until A has merged.
- Given a chain of dependencies, When the fleet runs, Then features start in dependency order.
- Given a dependency on a feature that is not in the fleet and not already done, When the fleet is
  planned, Then it stops and names the missing feature.
- Given a dependency cycle between features, When the fleet is planned, Then it stops and shows the
  cycle.

### US-4 — Contain failures to the affected features  (priority: P1)

As a developer, I want a failing lane to pause only its own feature and what depends on it, so that one
problem does not stop unrelated work.

- **Why this priority:** without containment, one failure wastes the whole fleet's time and budget.
- **Independent test:** fail one lane and confirm its feature and its dependents pause while an
  independent feature continues.
- **depends-on:** [US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a lane fails or stalls (15 minutes with no report and no `tasks.md` change), When it has been
  restarted up to the limit of 2 restarts from spec 028 and still fails, Then its feature pauses and
  every feature that depends on it pauses.
- Given independent features, When another feature's lane fails, Then they keep running.
- Given a paused feature, When a person resolves the problem and resumes it, Then it continues and its
  dependents may continue after it.
- Given a feature is paused, When a person looks at the fleet, Then the cause and the affected features
  are shown.

### US-5 — Keep the fleet inside its budget  (priority: P1)

As a team lead, I want caps on concurrent assistants and on each assistant type, so that a fleet
respects rate limits and cost.

- **Why this priority:** a fleet multiplies cost and rate-limit pressure; caps make it safe to start.
- **Independent test:** set a cap of two Claude and one Codex assistant and confirm the fleet never runs
  more of either at once.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a cap on concurrent assistants, When the fleet runs, Then no more than that many run at once and
  waiting lanes start as capacity frees up.
- Given a cap per assistant type, When the fleet runs, Then no more than that many of each type run at
  once.
- Given a token ceiling and a runner that reports usage, When the ceiling is reached, Then the fleet
  stops starting new work and reports it.
- Given a runner that does not report usage, When a token ceiling is set, Then the ceiling is not
  enforced for that runner and the fleet says so.
- Given no cap is configured, When the fleet is planned, Then a default cap of 3 assistants in total,
  with at most 2 of one type, applies to the whole fleet and overrides the per-feature cap from spec 028,
  which applies only when a feature runs alone.

### US-6 — Watch, gate and merge across the fleet  (priority: P2)

As a developer, I want one supervisor to watch every lane, with approval gates and merges applying per
feature, so that I can steer a fleet from one place.

- **Why this priority:** it ties the fleet together, but the scheduling rules deliver value without it.
- **Independent test:** run a fleet of two features and confirm each feature's gate waits for approval,
  merges on its own, and the fleet status shows both.
- **depends-on:** [US-1, US-4]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given several features running, When a person checks status, Then one view shows every feature's lanes
  and states.
- Given a feature reaches an approval gate, When it waits, Then only that feature waits and others
  continue.
- Given a feature finishes, When it is merged, Then it merges on its own, and a real merge conflict
  pauses only that feature and waits for a person.
- Given a person pauses or stops the fleet, When the supervisor reacts, Then a directive is written for
  every lane through spec 025's directive writer, and each worker finishes its current task and obeys
  at its next report.

### US-7 — Pick the ready features automatically  (priority: P3)

As a developer, I want to start every ready feature without naming them, so that I can run all
available work in one go.

- **Why this priority:** a convenience over listing features by hand.
- **Independent test:** run with the all-ready option on a project with ready and not-ready features and
  confirm only the right ones are selected.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the all-ready option, When the fleet is planned, Then it selects features that are ready to run
  and shows which were chosen and which skipped, with reasons.
- Given a feature whose spec, plan and tasks are not all approved, When the all-ready option is used,
  Then it is not included and is listed as skipped with the reason.
- Given no feature is ready, When the option is used, Then it says so and starts nothing.

### US-8 — Inspect and resume a fleet from files  (priority: P2)

As a developer, I want a fleet's state in files, so that I can stop it, inspect it and resume it later.

- **Why this priority:** long fleets will be interrupted, and resumability is part of AmbyKit's identity
  (Principle 3).
- **Independent test:** stop a fleet mid-run, start it again and confirm completed lanes are not
  repeated.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a running fleet, When a person inspects its state files, Then the features, lanes, order,
  budgets and pauses are readable without a model.
- Given a stopped fleet, When it is started again, Then it resumes without repeating completed lanes.
- Given a feature changes after the fleet was planned, When the fleet resumes, Then it re-plans and
  says what changed.
- Given a fleet, When it starts, Then it gets its own fleet run ID and its own directory under
  `.amby/fleet/`, containing the per-feature runs, each identified `<feature>.<n>` as in spec 019.
- Given a worker calls `report_activity` (spec 025) without naming a run, When the call is resolved,
  Then it finds the feature's unfinished run inside the fleet directory it belongs to.
- Given lanes of several features, When status is shown, Then this feature supplies the grouping of lanes
  across features, which the single-run Fleet tab (spec 029) does not do.

### US-9 — Leave single-feature runs unchanged  (priority: P2)

As an existing user, I want single-feature runs to work as before, so that adopting fleets does not
disturb them.

- **Why this priority:** fleets are an addition to the 2.0 run, not a replacement.
- **Independent test:** run one feature with and without the fleet capability present and confirm the
  same behavior.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a single feature, When it is run, Then its behavior, gates and merge are as in a single run.
- Given the fleet capability is not used, When any existing command runs, Then output is unchanged.

## Requirements (EARS)

- FR-001  WHEN several feature numbers are given, THE SYSTEM SHALL plan their lanes as one fleet and
  show the plan before starting anything.
- FR-002  IF a named feature does not exist or is not ready to run, THEN THE SYSTEM SHALL stop before
  starting and name the feature and reason.
- FR-003  THE SYSTEM SHALL schedule a feature listed more than once only once.
- FR-004  IF two features own the same file, THEN THE SYSTEM SHALL serialize them in dependency order and
  then by feature number, starting the second only after the first has merged.
- FR-005  THE SYSTEM SHALL name the shared files behind each serialization in the plan.
- FR-006  IF a task has no file ownership (1.x: no trailing path; 2.x: no entry in the phase's `files`
  block), THEN THE SYSTEM SHALL flag the task and treat its feature conservatively.
- FR-007  WHEN feature B depends on feature A, THE SYSTEM SHALL start B only after A has merged.
- FR-008  IF a dependency is missing from the fleet and not done, or forms a cycle, THEN THE SYSTEM
  SHALL stop and name the feature or cycle.
- FR-009  IF a lane fails or stalls (15 minutes with no report and no `tasks.md` change) and spec 028's
  restart limit of 2 is exhausted, THEN THE SYSTEM SHALL pause its feature and every feature that
  depends on it, and SHALL let independent features continue.
- FR-010  THE SYSTEM SHALL enforce a cap on concurrent assistants and a cap per assistant type.
- FR-011  WHERE a runner reports token usage, THE SYSTEM SHALL enforce a token ceiling and stop starting
  new work when it is reached; WHERE it does not, THE SYSTEM SHALL say the ceiling is not enforced.
- FR-012  THE SYSTEM SHALL apply a default concurrency cap when none is configured. The default is
  3 assistants in total with at most 2 of one type, for the whole fleet; all caps are configurable and
  per-type caps can be overridden (for example 2 Claude and 1 Codex). The fleet cap overrides spec 028's
  per-feature cap, which applies only to a feature running alone.
- FR-013  THE SYSTEM SHALL give each feature its own worktree, approval gates and merge, and SHALL pause
  only the affected feature on a gate or merge conflict.
- FR-014  THE SYSTEM SHALL provide one supervisor view of every feature's lanes and states.
- FR-015  WHEN a person pauses or stops the fleet, THE SYSTEM SHALL write a directive for every lane
  through spec 025's core directive writer, and each worker SHALL finish its current task and obey at
  its next report.
- FR-016  WHERE the all-ready option is used, THE SYSTEM SHALL select the ready features and show chosen
  and skipped features with reasons.
- FR-017  THE SYSTEM SHALL keep fleet state in files readable without a model and SHALL resume a stopped
  fleet without repeating completed lanes.
- FR-018  WHEN a feature changes after planning, THE SYSTEM SHALL re-plan on resume and report what
  changed.
- FR-019  WHERE a fleet contains one feature, THE SYSTEM SHALL behave as a single run.
- FR-021  THE SYSTEM SHALL give each fleet its own run ID and directory under `.amby/fleet/` holding the
  per-feature runs (`<feature>.<n>`, spec 019), SHALL let spec 025's run resolution find a feature's
  unfinished run within it, and SHALL own the grouping of lanes across features.
- FR-020  THE SYSTEM SHALL read cross-feature dependencies (feature-level `depends-on` and story edges) and
  file ownership through spec 030's per-file reader and spec 023's graph, never by re-parsing prose or
  markdown itself (Principle 3), so 1.x, 2.x and mixed projects behave the same.
- FR-022  THE SYSTEM SHALL read and write a feature's task state only through the per-file reader and the
  writer from spec 030, so a fleet needs no change when a feature is migrated mid-fleet.

## Success criteria

- SC-001  Two dependent features are built by one fleet, in dependency order, with no manual start,
  order or merge step (the 2.0 gate, Principle 6).
- SC-002  Two features with overlapping file ownership never run at the same time, in every tested case.
- SC-003  A failure in one feature pauses only that feature and its dependents; independent features
  finish.
- SC-004  The fleet never exceeds its configured concurrency caps.
- SC-005  A stopped fleet resumes with zero repeated completed lanes.
- SC-006  Every FR maps to at least one test (Principle 5), and `npm run typecheck` and `npm test`
  pass.

## Edge cases

- A feature finishes while another that depends on it is paused for a different reason.
- A merge changes a file another running feature owns.
- A feature's file ownership grows after the fleet starts.
- A cap lower than the number of lanes that could run in parallel.
- A fleet running while a person edits a spec or task list.
- Two features with equal dependency order and overlapping files: ordered by number.
- All features independent: the fleet reduces to parallel single runs.
- An assistant type unavailable on this machine.

## Clarifications (plan-time, 2026-11-19)

- **C-1 "Merged".** For ordering, a feature is merged when all its lanes are merged into its feature branch (its run is done). A dependent or serialized feature then merges that branch into its own worktree before starting. Merging a feature into `main` stays a person's decision.
- **C-2 Lanes.** A fleet prepares missing lanes for the next phase with the existing lane preparation and shows that in the plan preview; it refuses with the `ambykit lane` hint if it cannot.

## Assumptions

- Spec 028 (single-feature `run`, released in 1.6.0), spec 029 (Fleet view, 1.6.0) and spec 023 (graph)
  are merged. Spec 030 (spec format v2, feature-level `depends-on`, the reader and writer) merges before
  this feature is built; its model is the contract here.
- Runners are unverified until 028's live checks (T044/T045) pass; a fleet only schedules runners that
  are verified or that the person explicitly allows, as in 028.
- Cross-feature file-ownership checks exist from spec 015 (parallel lanes).
- Each feature already has its own worktree, approval gates and merge, as in a single run.
- Assistant runners are verified per assistant (Principle 4); an unverified one is not runnable.
