# Artifact: `tasks.md`

An ordered, dependency-aware checklist that turns the plan into executable work. Produced by
`/amby.tasks`; consumed by `/amby.implement` and by `ambykit dashboard`.

## Task line format

```
- [ ] [T001] [P] [US1] Create reset_tokens table and migration (db/migrations/003_reset_tokens.sql)
```

- **checkbox** `- [ ]` / `- [x]` — completion state; the **source of truth** for `dashboard` progress.
- **`T###`** — stable task ID.
- **`[P]`** — optional; the task is parallelizable with its siblings.
- **`[US#]`** — the user story this task serves (enables story-level progress roll-up).
- **description (file path)** — what to do and where.

### Blocked and deviation markers

A task that cannot proceed carries `⚠ BLOCKED: <reason>` as the **last segment** of its line, after the
path group; a task done differently than planned may carry `↪ DEVIATION: <note>` beside it. The glyphs
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

Each phase ends with one plain-text `**Verify:**` line: the check the implementer runs before passing the
phase checkpoint. After a run the result is written on that same line as a suffix: `✓ passed`,
`✗ failed: <why>` or `? unverified` (for a check that needs a person or an external step). The glyphs are
optional, so `passed`, `failed: <why>` and `unverified` read the same. A Verify line holds one result; a
later run overwrites it, so an old failure is never shown as current. A phase checkpoint is not passed
while its Verify line is `failed`. When a phase is built in parallel lanes, record its result after the
phase's lanes are merged, not while neighbouring lanes are open: an edit on a Verify line next to a lane's
check-off makes the merge conflict in `tasks.md`.

```
**Verify:** `npm run typecheck && npx vitest run test/core/markers.test.ts` ✓ passed
**Verify:** `npm test` ✗ failed: 3 tests in test/cli
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
story's `status:` in `spec.md`. `ambykit dashboard` reads both — counting checked tasks per `[US#]`
tag — to report `X of Y tasks done`, `%`, and status per story.
