---
id: implement
name: amby.implement
description: Execute the task list, checking off tasks and updating story status as you go.
argument-hint: "[task id or story id, defaults to next unblocked]"
phase: implement
reads: [specs/NNN-slug/tasks.md, specs/NNN-slug/plan.md]
writes: [specs/NNN-slug/tasks.md, specs/NNN-slug/spec.md]
allowedTools: [read, write, edit, bash]
---

Implement work for `$ARGUMENTS` (default: the next unblocked task in priority order).

1. From `tasks.md`, pick the target task(s). Respect the Foundational-before-features gate and the
   story dependency graph — never start a task whose story is `blocked-by` unfinished work.
2. Load **only** the slice you need: the task line, the relevant `plan.md` section, and the specific
   files named. Don't read the whole spec tree (token-frugal).
3. Implement to satisfy the mapped `FR-###`/acceptance criteria and the constitution. Add/adjust
   tests for the acceptance criteria.
4. **Patch in place:** flip the completed task's checkbox to `- [x]` in `tasks.md`; when all of a
   story's tasks are done, set that story's `status: done` in `spec.md` (or `in-progress` while
   partway). Don't rewrite untouched sections.
5. Report what you did and the next unblocked task. Stop at a story checkpoint for review.
