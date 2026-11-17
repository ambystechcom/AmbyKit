---
id: implement
name: amby.implement
description: Execute the task list, checking off tasks and updating story status as you go.
argument-hint: "[task id or story id, defaults to next unblocked]"
phase: implement
role: developer
reads: [specs/NNN-slug/tasks.md, specs/NNN-slug/plan.md, specs/NNN-slug/tests.md]
writes: [specs/NNN-slug/tasks.md, specs/NNN-slug/spec.md]
allowedTools: [read, write, edit, bash]
---

Implement work for `$ARGUMENTS` (default: the next unblocked task in priority order).

Run `ambykit activity <feature> --agent=$AGENT --phase=implement` first, with that feature's number; ignore any error.

1. From `tasks.md`, pick the target task(s). If `.amby/lane/lane.json` exists you are in a lane: work
   only the task ids it lists. Respect the Foundational-before-features gate and the
   story dependency graph — never start a task whose story is `blocked-by` unfinished work.
2. Load **only** the slice you need: the task line, the relevant `plan.md` section, and the specific
   files named. Don't read the whole spec tree (token-frugal).
3. Implement to satisfy the mapped `FR-###`/acceptance criteria and the constitution. Add/adjust
   tests for the acceptance criteria: build to the story's cases in `tests.md` and name tests `NNN:FR-###: …`;
   at the story checkpoint say if `tests.md` is missing, never pass silently. If you cannot finish a task, add `⚠ BLOCKED: <reason>` as the last
   segment of its line (after the `(file/path)` group), stop that task and continue with another unblocked
   one; note any departure from the plan as `↪ DEVIATION: <note>`. Remove `⚠ BLOCKED:` once resolved.
4. **Patch in place:** flip the completed task's checkbox to `- [x]` in `tasks.md`; set the story's
   `status: in-progress` in `spec.md` while it is partway. Don't rewrite untouched sections. After each
   checked task, run `ambykit activity <feature> --agent=$AGENT --phase=implement --task=T###` (ignore errors).
5. At a phase checkpoint, run that phase's `**Verify:**` check before passing it (no Verify line: say so
   and continue). Write the result at the end of that line, replacing any earlier one: `✓ passed`,
   `✗ failed: <why>` or `? unverified`. Never pass the checkpoint on a failure: fix it and run again. If
   you cannot run the check, ask a person to run or confirm it and record `? unverified`. Only once the
   Verify has passed (or there is none) and all of a story's tasks are done, set that story's
   `status: done`. In a lane, record the result after the phase's lanes are merged.
6. Report what you did and the next unblocked task. Stop at a story checkpoint for review.
