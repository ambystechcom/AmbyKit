---
id: tasks
name: amby.tasks
description: Break the plan into an ordered, dependency-aware task checklist.
argument-hint: "[feature id, defaults to current] [--skip-tests <reason>]"
phase: tasks
role: tech-lead
reads: [specs/NNN-slug/plan.md, specs/NNN-slug/spec.md, specs/NNN-slug/tests.md]
writes: [specs/NNN-slug/tasks.md, specs/NNN-slug/tests.md]
allowedTools: [read, write, edit]
---

Generate `tasks.md` for feature `$ARGUMENTS` (default: the current feature).

Context: read that feature's `plan.md` (and `spec.md` for story IDs/priorities/dependencies).

Run `ambykit activity <feature> --agent=$AGENT --phase=tasks` first, with that feature's number; ignore any error.

1. Write tasks following `@.amby/templates/tasks.md` as checkbox lines:
   `- [ ] [T###] [P?] [US#] description (file/path)`.
2. Group into phases: **Setup → Foundational → User stories (by priority) → Polish**. Enforce the
   gate: no user-story task before Foundational completes.
3. Order tasks by the story **dependency graph** (`depends-on`/`blocked-by`) and priority. Mark
   independent tasks `[P]`. Tag each task with its `[US#]`. End each story group with a checkpoint.
4. Give every task a stable `T###` id and its file paths as the line's last parenthesized group:
   comma-separated, repo-relative, dirs end `/`, no globs. Mark `[P]` only when no other task in the
   same phase shares or nests a path.
5. End every phase with exactly ONE `**Verify:**` line, plain text after its tasks: a runnable check
   or observable condition that proves the phase works (e.g. a test command). Never more than one.
6. Also write `tests.md` (the test design) in this phase per `@.amby/templates/tests.md`, touching only `tasks.md`
   and `tests.md`. If `spec.md` is not `status: ready`, skip it and say the spec must be ready first. One case per
   acceptance criterion (negative and edge ones too, max 15 per story); one too vague to test goes under `## Flags`.
   With `--skip-tests <reason>`, write `tests.md` holding only the line `skipped: <reason>`.
7. Cases are `auto` unless a fixed-list reason makes them manual (add `verify:` and `record:`). Each cites its `US-n#k`
   and `FR-###`s; `TC-###` is highest + 1, never reused. An FR with no case goes under `## Uncovered` with a reason.
   With an existing `tests.md`, patch only the cases citing changed criteria (keep their ids, clear `[stale]`), mark
   cases whose criterion was removed `[obsolete]` and add new ones; leave the rest untouched.

Do not start implementing. Keep descriptions to one line each.
