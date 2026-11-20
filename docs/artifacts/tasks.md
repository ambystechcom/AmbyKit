# Artifact: `tasks.md`

An ordered, dependency-aware checklist that turns the plan into executable work. Produced by
`/amby.tasks`; consumed by `/amby.implement` and by `ambykit dashboard`.

## Task line format

```
- [ ] [T001] [P] [US1] Create reset_tokens table and migration
```

- **checkbox** `- [ ]` / `- [x]` — completion state; the **source of truth** for `dashboard` progress.
- **`T###`** — stable task ID.
- **`[P]`** — optional; the task is parallelizable with its siblings.
- **`[US#]`** — the user story this task serves (enables story-level progress roll-up).
- **description** — what to do. The files a task owns are not on its line: they are listed in its phase's
  block (below).

### Files and Verify: the phase block

Each phase ends with one fenced `yaml` block holding two things, both optional:

````markdown
## Phase 3 — User story US-1

- [ ] [T001] [P] [US1] Create reset_tokens table and migration
- [ ] [T002] [P] [US1] Add the reset endpoint
- **Checkpoint:** US-1 is demoable.
```yaml
files:
  T001: ["db/migrations/003_reset_tokens.sql"]
  T002: ["src/api/reset.ts", "test/api/reset.test.ts"]
verify:
  check: "`npm test` passes"
  result: passed        # passed | failed | unverified
  why: ""               # the reason, when failed
```
````

- `files:` maps a task id to its repo-relative paths (directories end `/`, no globs). A task with no entry has
  no declared files, and a `[P]` task in a phase must not share or nest a path with another (`ambykit analyze`
  reports a lane conflict). Lane planning, the check-off merge and the MCP tools read the same paths as before.
- `verify:` is the phase's Verify check and its last recorded result (see below). One `verify:` per phase.
- A `yaml` fence with neither key is documentation and is ignored; one that mixes `files`/`verify` with other
  top-level keys, a block that is not closed, or YAML that does not parse is an error with its file and line.
- `format: 2` in the file's frontmatter marks it as v2. Change a task's files with
  `ambykit edit files <feature> T### <path…>` and a Verify result with `ambykit edit verify`; do not edit the
  block by hand. Checking a task off is still just flipping its checkbox.

### Tasks written before 2.0

A 1.x task line carries its files as the last parenthesized group, `(src/a.ts, test/a.test.ts)`, and the phase's
Verify as a `**Verify:** <check>` line with a result suffix. 2.x reads that exactly as before until 2.1, with one
warning per run; `ambykit migrate` moves the groups and the Verify line into the phase block. See
[Migrating to the v2 spec format](../migration.md).

### Blocked and deviation markers

A task that cannot proceed carries `⚠ BLOCKED: <reason>` as the **last segment** of its line (after its path
group in a 1.x file); a task done differently than planned may carry `↪ DEVIATION: <note>` beside it. Markers stay
on the task line in both formats. The glyphs
are optional (`BLOCKED:` and `DEVIATION:` read the same), and a marker's text runs to the next marker or
the end of the line, so a reason can contain parentheses or backticks without being read as a file path.

```
- [ ] [T012] [US2] Call the billing API (src/billing.ts) ⚠ BLOCKED: waiting on the API key ↪ DEVIATION: used a stub
```

Markers never change a task's checkbox, ID, `[P]` or declared paths. A `BLOCKED` task with no reason is
still blocked and is reported as missing one; a checked task that still has `⚠ BLOCKED:` is reported as
inconsistent. Remove the marker when the block is resolved. Text inside backticks is never read as a marker,
so documentation can show the syntax.

### Verify lines

Each phase has one Verify check: the check the implementer runs before passing the phase checkpoint. In a v2
file it is the `check:` of the phase block's `verify:`; in a 1.x file it is a plain-text `**Verify:**` line. After a
run the result is recorded with

```bash
ambykit edit verify <feature> <phase> --result=passed|failed|unverified [--why=<why>]
```

(`unverified` is for a check that needs a person or an external step). A v2 file stores `result: passed|failed|
unverified` and `why:`; a 1.x file shows it as a suffix on the Verify line, `✓ passed`, `✗ failed: <why>` or
`? unverified` (the glyphs are optional, so `passed`, `failed: <why>` and `unverified` read the same). A phase holds
one result; a later run overwrites it, so an old failure is never shown as current. A phase checkpoint is not passed
while its result is `failed`. When a phase is built in parallel lanes, record its result after the phase's lanes
are merged, not while neighbouring lanes are open: an edit next to a lane's check-off makes the merge conflict in
`tasks.md`.

```
**Verify:** `npm run typecheck && npx vitest run test/core/markers.test.ts` ✓ passed     (1.x)
**Verify:** `npm test` ✗ failed: 3 tests in test/cli                                     (1.x)
```

## Test design

`/amby.tasks` also writes `tests.md` in the same phase: one test case per acceptance criterion, decided
before any code. See [the tests artifact](./tests.md).

## Phase grouping

Tasks are grouped so structure precedes features:

1. **Setup** — tooling, scaffolding.
2. **Foundational** — shared infrastructure that everything depends on. **Blocks all feature work.**
3. **User stories** — grouped by story and priority, each ending in a checkpoint (a demoable slice).
4. **Polish** — hardening, docs, cleanup.

The **foundational-before-features** gate is enforced: no user-story task starts until foundational
tasks complete.

## Ordering & dependencies

`/amby.tasks` orders tasks by the story **dependency graph** (`depends-on`/`blocked-by`) and
**priority**, within the phase gate. `[P]` marks tasks that can run concurrently. This supports
MVP-first, incremental, or parallel-team execution.

## Status flow

As `/amby.implement` completes work it flips checkboxes to `- [x]` and updates the corresponding
story's status in `spec.md` with `ambykit edit status`. `ambykit dashboard` reads both — counting checked tasks per `[US#]`
tag — to report `X of Y tasks done`, `%`, and status per story.
