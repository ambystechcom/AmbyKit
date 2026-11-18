---
feature: 030-spec-v2-and-migrate          # NNN-slug
title: Spec format v2 and migrate
branch: 030-spec-v2-and-migrate
status: ready                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — Spec format v2 and migrate

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Today the dashboard and analyzer find status, dependencies and file ownership by matching text such as
`**status:**`, `**depends-on:**` and a trailing `(file/path)` on task lines, and every new feature adds
another pattern. Spec format v2 makes the machine-read parts **structured** while the prose stays
human-first. This is the **breaking change** that makes 2.0 a major version. `ambykit migrate` upgrades
1.x specs in place, config gains a schema version, and the minimum Node version rises to 22. 2.0 still
reads 1.x files, with a deprecation warning, until 2.1, so a team can upgrade feature by feature.

The format is the one decided by spike spec 026 (`026:D-1` to `026:D-10`): feature and story metadata in
the spec's frontmatter, per-task file ownership and per-phase Verify data in fenced YAML blocks in
`tasks.md`, one block per phase, everything else prose, and an explicit `format: 2` marker. This spec fixes
the behavior around that format. Old 1.x binaries read a v2 file without any error and silently lose its
statuses, dependencies, ownership and Verify results (`026:F-2`, `026:F-3`), so the reader, `migrate` and
the writer ship together in 2.0.

**Out of scope:** the stable `run` and the plugin API freeze (promotions of specs 028 and 027, handled
at the 2.0 gate, not here); the OpenSpec-style change-delta and archive flow (a separate 2.x item); new
spec content or new phases; and migrating plans, `tests.md`, decision records and other artifacts, so only
`spec.md` and `tasks.md` are migrated in 2.0. Requirement IDs (`FR-###`) stay in prose (`026:D-8`).

## User scenarios & testing

### US-1 — Structured feature and story metadata  (priority: P1)

As a tool author, I want feature and story metadata (IDs, priority, status and dependencies) in a
structured block, so that tools read it without pattern-matching prose.

- **Why this priority:** this is the core change; everything else supports or migrates to it.
- **Independent test:** read a v2 spec and confirm story IDs, priorities, statuses and dependencies come
  from the structured data, not from prose lines.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a v2 spec (its frontmatter says `format: 2`), When read by a tool, Then feature ID, story IDs,
  priorities, statuses and dependencies are obtained from structured data with no prose matching, and the
  story titles come from the headings.
- Given the prose of a story, When it is edited, Then structured data is unaffected unless the person
  changes it.
- Given invalid structured data (unknown field, unparseable block, a dependency that is not a list), When
  read, Then the tool reports the file, line and problem and does not guess and does not fall back to
  reading the file as 1.x.
- Given a status other than the five known ones, When read, Then it is kept as written and a warning is
  reported instead of rejecting the spec.
- Given the structured data and prose disagree (for example a stale `(priority: P1)` left in a heading),
  When read, Then the structured data wins and the disagreement is reported.
- Given a spec that carries story metadata but no `format: 2` marker, When read, Then it is read as v2
  and a warning says to add the marker.

### US-2 — Structured per-task ownership and verify  (priority: P1)

As a lane planner, I want each task's file ownership and each phase's verify data in a structured block,
so that conflict checks and verification do not parse trailing text.

- **Why this priority:** lanes and fleets depend on reliable ownership; it is the other half of the
  machine-read surface.
- **Independent test:** read a v2 task list and confirm each task's files and each phase's verify data come
  from structured data.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a v2 task list, When read, Then each task's ID and files come from the phase's structured block,
  the phase's verify check, result (`passed`, `failed` or `unverified`) and reason come from the same
  block, and the task's human text stays in prose with the checkbox on its line.
- Given a task with no files entry, When read, Then it is treated as owning none and reported exactly as
  1.x reports a task without a declared path.
- Given two tasks owning the same file, When the conflict check runs, Then the result is identical to
  the 1.x result for the equivalent list.
- Given a Verify result (spec 020), When recorded, Then it is stored in the structured data and the
  latest result is the one reported.
- Given a BLOCKED or DEVIATION marker (spec 020), When a task has one, Then it stays on the task line and
  is read as before.
- Given a fenced block that is not ours (a documentation example, or a block with other top-level keys
  than `files` and `verify`), When read, Then it is ignored if it has neither key and reported with
  file and line if it mixes them.

### US-3 — Migrate 1.x specs in place  (priority: P1)

As a maintainer, I want one command to upgrade my 1.x specs to v2, so that I do not hand-edit every
feature.

- **Why this priority:** without it the breaking change is a manual chore for every user.
- **Independent test:** run `ambykit migrate` on a copy of a 1.x project and confirm all specs read as
  v2 with the same meaning.
- **depends-on:** [US-1, US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a 1.x feature, When `ambykit migrate` runs, Then its spec and tasks are rewritten in place to
  v2 with status, priority, dependencies, file ownership and Verify results preserved, and its plan and
  other artifacts are left unchanged.
- Given the prose of a spec, When migrated, Then it is preserved byte for byte except for the lines
  that moved into structured data and the `(priority: Pn)` annotation removed from story headings.
- Given a feature that is already v2, When migrated, Then nothing changes.
- Given a migration it cannot do safely (see FR-006), When it runs, Then it skips that file, says why,
  and leaves it byte for byte as 1.x, never guessing.
- Given a spec with no frontmatter, When migrated, Then it gets minimal frontmatter and the summary says so.
- Given `--dual-write`, When migrate runs, Then the 1.x lines are kept next to the v2 data so a pinned 1.x
  tool still reads the files, and the summary says this is transitional.
- Given a clean git repository, When migrate finishes, Then every change is visible as an ordinary diff.

### US-4 — Preview with dry run and a diff summary  (priority: P1)

As a maintainer, I want to preview a migration before it writes anything, so that I can trust it.

- **Why this priority:** migration rewrites files; a preview is the safety net.
- **Independent test:** run `--dry-run` and confirm no file changes and a summary of what would change.
- **depends-on:** [US-3]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given `--dry-run`, When migrate runs, Then no file is written and nothing is created, including temporary
  files.
- Given any run, When it ends, Then a summary lists per file the lines added and removed, whether it was
  converted, unchanged or skipped, and why.
- Given a heading whose `(priority: Pn)` annotation would be removed, When the preview is shown, Then the
  change is listed with the heading.
- Given a skipped feature, When the summary is shown, Then it says what a person must fix.
- Given a feature number argument, When migrate runs, Then only that feature is touched.
- Given `--diff`, When migrate runs, Then the full unified diff of each file is shown.

### US-5 — Run migrate safely and repeatedly  (priority: P1)

As a maintainer, I want migrate to be idempotent and non-destructive, so that I can run it again or
stop halfway without damage.

- **Why this priority:** a migration that can corrupt specs would block adoption.
- **Independent test:** run migrate twice and interrupt a run; confirm the second run produces no
  further change and no file is half-written.
- **depends-on:** [US-3]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a migrated project, When migrate runs again, Then no file changes.
- Given a run interrupted partway, When migrate runs again, Then it completes the remainder with no
  duplicated or lost content and no file is half-written.
- Given a file that was edited by someone else between migrate reading and writing it, When migrate would
  write it, Then it detects the change, does not overwrite it, and reports the file as skipped.
- Given a converted file whose v2 form does not read back to the same meaning as its 1.x form, When migrate
  checks it, Then the file is left as it was and reported.
- Given a dirty working tree, When migrate runs, Then it warns before writing and names the files.
- Given a feature in a lane worktree, When migrate runs, Then it does not touch other worktrees.

### US-6 — Keep reading 1.x files until 2.1  (priority: P1)

As a team lead, I want 2.0 to keep reading 1.x specs with a clear deprecation warning, so that we can
upgrade feature by feature instead of all at once.

- **Why this priority:** the roadmap promises an incremental upgrade; a hard cut would block teams.
- **Independent test:** run `dashboard` and `analyze` on a project with both 1.x and v2 features and
  confirm both read correctly, with one warning for the 1.x ones.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a 1.x feature, When any command reads it in 2.0, Then it is read with the same results as in
  1.x and a deprecation warning names how to migrate it.
- Given many 1.x features, When commands run, Then the warning is concise and shown once per run, not
  once per file: one summary line giving the count of 1.x files read and how to migrate. It can be
  silenced by a config or environment setting and never appears in `--json` output.
- Given a project with mixed formats (even within one feature, one file in each), When `dashboard` and
  `analyze` run, Then both formats appear in the same output.
- Given `ambykit check`, When specs are still in 1.x, Then it reports how many and which features, and this
  is a notice that does not change its exit status.
- Given 2.1, When it reads a 1.x file, Then it refuses with a message telling the person to migrate
  with the 2.0 tool. The gate for dropping 1.x reading is "no open migration issues for one release",
  confirmed by the release maintainer via the release checklist, with the result recorded in the
  changelog.

### US-7 — Versioned configuration  (priority: P2)

As a maintainer, I want `.amby/config.json` to carry a schema version, so that later upgrades migrate it
automatically.

- **Why this priority:** it prevents the next format change from needing another manual step, but is not
  needed to read specs.
- **Independent test:** run a command on a 1.x config and confirm it is read as v1 without being modified,
  run `migrate` and confirm it is upgraded, and a v2 config is untouched.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a config without a schema version, When a command runs, Then it is read as v1 and is not modified.
- Given a config without a schema version, When `migrate` runs, Then it is upgraded to v2 with all settings,
  including unknown fields, preserved.
- Given a v2 config, When read, Then nothing changes.
- Given a config from a newer AmbyKit than the one running, When read, Then it is not modified and a
  clear message says to upgrade the tool.
- Given a config the tool cannot parse, When read, Then it reports the file and problem, never
  overwriting it.

### US-8 — Node 22 minimum  (priority: P2)

As a maintainer, I want the minimum Node version raised to 22 with a clear message on older versions, so
that 2.0 can rely on current platform features.

- **Why this priority:** a platform cleanup that matches the 2.0 break and allows modern dependencies.
- **Independent test:** run on an older Node and confirm a clear error naming the required version.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given Node older than 22, When the CLI runs, Then it exits with a message naming the required version
  and does nothing else.
- Given Node 22 or newer, When the CLI runs, Then it behaves as normal.
- Given the package metadata, the CI matrix and the docs, When read, Then they state the new minimum.

### US-9 — Cross-feature dependencies in structured data  (priority: P2)

As a fleet scheduler author, I want feature-to-feature dependencies in structured data, so that
scheduling reads one reliable source.

- **Why this priority:** multi-feature fleets (spec 031) need it, but it builds on US-1.
- **Independent test:** declare a feature-level dependency and confirm the graph builder returns the
  feature edge.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a feature declares it depends on another feature (an optional feature-level depends-on in the
  frontmatter, a list of feature numbers or directory names), When read, Then the edge appears in the
  graph and is available to the graph builder (spec 023) and the scheduler.
- Given a story-level dependency across features, When read, Then it appears as before and a derived
  feature edge is available.
- Given a dependency on a feature that does not exist, When read, Then it is reported.
- Given a 1.x feature, When read, Then it has no feature-level dependency and its derived edges are
  unchanged.

### US-10 — Edit ownership and Verify results without hand-editing YAML  (priority: P1)

As an implementer (person or assistant), I want a command that writes a task's files, a story's status and
a phase's Verify result, so that I never hand-edit structured data and one typo cannot make a whole phase
unreadable.

- **Why this priority:** `026:R-2`: a YAML typo costs a whole phase in v2, where 1.x lost one line; the
  writer removes the need to edit the block by hand.
- **Independent test:** set a task's files and a phase's Verify result with the command and confirm the
  file reads back with exactly those changes and nothing else changed.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a v2 task list, When the command sets a task's files, Then only that task's entry in its phase's
  block changes and the file still reads.
- Given a v2 task list, When the command records a phase's Verify result (`passed`, `failed` with a reason,
  or `unverified`), Then only that phase's `result` and `why` change and the latest result is the one read.
- Given a v2 spec, When the command sets a story's status, Then only that story's `status` in the
  frontmatter changes and the file still reads.
- Given an unknown task, story or phase, a status or result that is not an allowed value, or a path with a
  glob, When the command runs, Then it changes nothing and says why.
- Given a 1.x task list, When the command runs, Then it edits the 1.x form (the trailing group and the
  result suffix) with the same effect, so one command works in both formats.
- Given the MCP tick and status tools (spec 025), When used on a v2 feature, Then they behave as on 1.x.

### US-11 — Assistants author and update v2 without breaking it  (priority: P1)

As a person using AmbyKit with an assistant, I want the phase prompts and templates to produce and update v2
files correctly, so that new features start in v2 and the assistant never writes the old patterns.

- **Why this priority:** `026:R-3`: the prompts that patch status bullets, tick boxes and append a glyph to
  the Verify line would corrupt a v2 file; this is the largest work item of the feature.
- **Independent test:** run the phases for a new feature and confirm the produced `spec.md` and `tasks.md`
  are v2 and the implement phase updates status, ticks and Verify results through the right carriers.
- **depends-on:** [US-1, US-2, US-10]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a new feature, When `/amby.specify` and `/amby.tasks` run, Then `spec.md` and `tasks.md` are v2.
- Given a v2 feature, When `/amby.implement` records progress, Then it ticks the task line, sets story status
  and phase Verify results through the writer command, and never edits the blocks by hand.
- Given a v2 feature, When `/amby.revise` and `/amby.converge` change status or add tasks, Then they use the
  v2 carriers and keep every untouched section as it was.
- Given a 1.x feature, When these prompts run, Then they keep working on the 1.x form until it is migrated.
- Given the prompts and templates after this change, When measured, Then each stays within today's size cap.
- Given an assistant trial (a person runs one phase of a v2 feature on two assistants), When it ends, Then no
  file was left unreadable and every update went through the writer or a task checkbox.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL read feature ID, story IDs, priorities, statuses and dependencies from the
  frontmatter of a v2 spec (`format: 2`, then `stories:` with id, priority, status, depends-on and
  blocked-by), and story titles from the headings.
- FR-002  THE SYSTEM SHALL read each task's ID and file ownership and each phase's Verify check, result
  and reason from one fenced block per phase in a v2 task list, leaving human text in prose, the checkbox
  and the BLOCKED and DEVIATION markers on the task line, and accepting a block per task as well.
- FR-003  IF structured data is invalid, THEN THE SYSTEM SHALL report file, line and problem, SHALL NOT
  guess and SHALL NOT fall back to reading the file as 1.x.
- FR-004  IF structured data and prose disagree, THEN THE SYSTEM SHALL use the structured data and report
  the disagreement.
- FR-005  WHEN `ambykit migrate` runs, THE SYSTEM SHALL rewrite 1.x `spec.md` and `tasks.md` files in
  place to v2 (plans and other artifacts are not migrated in 2.0), preserving status, priority,
  dependencies, file ownership, Verify results and all prose except lines that moved and the
  `(priority: Pn)` heading annotation, which it removes and lists in the preview.
- FR-006  IF migrate meets lines it cannot safely convert, THEN THE SYSTEM SHALL skip that file, say why
  and leave it byte for byte unchanged. Unsafe means: metadata inside a prose sentence, duplicate or
  conflicting metadata lines, metadata or task markup inside a code fence, mixed line endings, a
  byte-order mark, a phase with more than one Verify line, or a phase that repeats a task ID.
- FR-007  WHERE `--dry-run` is given, THE SYSTEM SHALL write no file, create no temporary file and print
  what would change; WHERE `--diff` is given, THE SYSTEM SHALL print each file's unified diff.
- FR-008  WHEN migrate ends, THE SYSTEM SHALL print a summary per feature of changes (with lines added
  and removed per file), skips and the fix needed for each skip.
- FR-009  THE SYSTEM SHALL make migrate idempotent: a second run on a migrated project changes nothing.
- FR-010  IF migrate is interrupted, THEN a later run SHALL complete the remainder with no lost or
  duplicated content; THE SYSTEM SHALL write each file once, complete or not at all.
- FR-011  IF the working tree has uncommitted changes in files migrate would touch, THEN THE SYSTEM SHALL
  warn and name them before writing.
- FR-012  WHILE the version is 2.0, THE SYSTEM SHALL read 1.x files with results identical to 1.x and one
  concise deprecation warning per run giving the count and how to migrate, silenceable by a config or
  environment setting and absent from `--json`; mixed projects SHALL appear together in `dashboard` and
  `analyze`.
- FR-013  WHERE the version is 2.1 or later, THE SYSTEM SHALL refuse to read 1.x files and say to migrate
  with 2.0.
- FR-014  THE SYSTEM SHALL store a schema version in `.amby/config.json`; read a config without one as v1
  without modifying it; upgrade it with all settings (including unknown fields) preserved only when
  `migrate` runs; and leave a newer or unparseable config unmodified and report it.
- FR-015  IF the Node version is below 22, THEN THE SYSTEM SHALL exit with a message naming the required
  version.
- FR-016  THE SYSTEM SHALL expose feature-level and derived cross-feature dependency edges to the graph
  builder and scheduler from structured data.
- FR-017  THE templates, the `/amby.specify`, `/amby.tasks`, `/amby.implement`, `/amby.revise` and
  `/amby.converge` prompts, and the `/amby.run` prompt and worker persona (which record Verify results)
  SHALL emit and update v2 format for new and migrated features (a 1.x feature keeps its 1.x form until
  migrated), authored once in the neutral source and emitted per tool, and SHALL stay as small as today
  (Principles 1 and 3).
- FR-018  THE SYSTEM SHALL keep `dashboard`, `analyze`, the check-off-aware lane merge, the MCP tick and
  status tools (spec 025) and lane tooling equivalent between a feature in 1.x and the same feature
  migrated to v2, apart from the deprecation warning.
- FR-019  THE SYSTEM SHALL decide a spec is v2 by its explicit `format: 2` marker; a file with structured
  story data and no marker SHALL be read as v2 with a warning; and `ambykit check` SHALL report the
  features still in 1.x without changing its exit status.
- FR-020  WHEN a person or assistant runs the writer command, THE SYSTEM SHALL set a task's files, a
  story's status or a phase's Verify result in the right carrier for the file's format, change nothing
  else, and refuse an unknown task, story or phase, an invalid status or result, or a glob path.
- FR-021  THE SYSTEM SHALL read every `tasks.md` and `spec.md`, including old revisions read from git
  history and from other branches, through one per-file format dispatcher, so a repository that holds
  both formats is read correctly.
- FR-022  WHEN `dashboard` runs one-shot on AmbyKit's own specs in v2, THE SYSTEM SHALL stay within the
  dashboard's 1-second budget.
- FR-023  WHERE `--dual-write` is given, THE SYSTEM SHALL keep the 1.x lines beside the v2 data and
  report the file as transitional.
- FR-024  WHEN migrate converts a file, THE SYSTEM SHALL read it back and skip it if the meaning differs
  from the 1.x reading, and SHALL compare the file's content with what it read before writing and skip it
  if someone changed it meanwhile.
- FR-025  THE SYSTEM SHALL state in `migrate` output and the migration docs that a 1.x tool reads a v2 file
  without error but loses statuses, dependencies, ownership and Verify results.

## Success criteria

- SC-001  100% of AmbyKit's own specs migrate with no skipped file and read identically before and
  after.
- SC-002  Running migrate twice produces zero changes the second time on every tested project.
- SC-003  `dashboard`, `analyze`, the lane merge and the MCP tick and status tools produce equivalent
  results for the same feature in 1.x and in v2.
- SC-004  `--dry-run` writes nothing in every tested scenario.
- SC-005  A mixed 1.x and v2 project reads correctly in 2.0 with one concise warning per run.
- SC-006  Every FR maps to at least one test (Principle 5), and `npm run typecheck` and `npm test` pass.
- SC-007  The 2.0 gate is met: own specs migrated, 1.x still read, both formats tested (Principle 6).
- SC-008  The dashboard one-shot on AmbyKit's own v2 specs stays within its 1-second budget.
- SC-009  In an assistant trial (one phase of a v2 feature on each of two assistants), no file ends up
  unreadable and every status, ownership and Verify update used the writer or a task checkbox.
- SC-010  Every unsafe case listed in FR-006 is skipped, listed with its reason and left byte for byte
  unchanged.

## Edge cases

- A 1.x spec with hand-edited or non-standard status, dependency or ownership lines.
- A task line carrying BLOCKED, deviation and ownership markers together (spec 020).
- Windows line endings and a byte-order mark: migrate skips both and lists them.
- A feature in a lane worktree or a feature on another branch.
- A very large project with hundreds of features: migrate must stay responsive.
- A config with unknown fields: preserved, not dropped.
- Two people migrating different features at once.
- A person edits a v2 file back into 1.x style by hand: the structured data wins and the stray line is
  reported (FR-004).
- A task with a prose parenthetical before its real ownership group, such as `(SC-002/003)` (`026:F-4`):
  read correctly in v2; a 1.x reader of a migrated file sees a phantom path, which the migration notes warn
  about.
- A v2 spec whose frontmatter has broken YAML but still a `stories:` key: still v2, reported as an error
  with file and line.
- A concurrent hand-edit while migrate runs (FR-024).
- A task that lists no files in a phase whose block exists: reads as owning none.
- History: a repository's old `tasks.md` revisions are 1.x and the current one is v2; burndown and lane
  readers must read each by its own format.

## Clarifications resolved (defaults chosen; change here if the owner disagrees)

- **C-1 Detection.** A spec is v2 only with `format: 2`; story data without it is read as v2 with a warning.
  `tasks.md` is v2 when its frontmatter says `format: 2` or it holds a valid `files`/`verify` block, decided
  per file (FR-019, FR-021).
- **C-2 Feature-level dependencies.** Frontmatter key `depends-on` at the top level, a list of feature
  numbers or directory names; 031 reads it through the graph builder (US-9).
- **C-3 Priority.** `migrate` strips `(priority: Pn)` from story headings and shows the edit in the dry-run
  diff (`026:D-4`); new specs carry priority in frontmatter only.
- **C-4 Config.** The schema version is written only by `migrate`; an unversioned config is v1 in memory,
  never rewritten by another command (FR-014).
- **C-5 Warning.** The 1.x deprecation line goes to the error stream, once per run, silenceable by config or
  environment setting, never in `--json` (FR-012).
- **C-6 Missing ownership.** A task absent from a phase's `files` reads exactly as a 1.x task without a
  declared path (same `missing` issue), so 031 and lane planning need no new case.
- **C-7 Dual-write.** Off by default; transitional escape hatch for pinned 1.x CI (`026:D-7`).
- **C-8 Docs.** `migrate` touches only `spec.md` and `tasks.md`; the Verify-glyph convention in `docs/` is
  updated by this feature's own docs task, not offered by `migrate`.
- **C-9 Node 22.** The CI test matrix drops Node 20 and `engines` becomes `>=22`.
- **C-10 Writer.** One command with subcommands covers tasks, files and Verify results in both formats
  (US-10); the verb name is a plan decision.

## Assumptions

- The format is the one decided by spike 026 (`026:D-1` to `D-10`, `specs/026-spec-format-v2-spike/decision.md`);
  its prototype in `spikes/026-spec-format-v2/` is a reference, not shipped code. Plans are not migrated in
  2.0.
- Spec 023 (graph) already reads today's syntax; v2 only changes where edges are read from.
- Prose stays human-first and keeps its role; only machine-read parts become structured.
- The OpenSpec-style change-delta and archive flow is a separate 2.x item, not part of this spec.
- Stable `run` (028) and the plugin API freeze (027) are promoted at the 2.0 gate and do not depend on
  this spec's content beyond the format being final; plugins read the model (`026`, "What 027 may
  assume"), never the files.
- `migrate`, the reader and the writer ship in the same release because an old 1.x binary silently loses
  data on a v2 file (`026:F-2`).
- Assistants outside AmbyKit can still read a v2 file as plain markdown with readable YAML in code fences
  (`026:R-7`).
- BOM, mid-session line-ending changes and whether real assistants edit YAML blocks reliably were not
  tested by the spike; migrate skips the first two and SC-009 covers the third.
- 2.1 dropping 1.x reading is confirmed by the release maintainer through the release checklist, as the
  roadmap requires.
