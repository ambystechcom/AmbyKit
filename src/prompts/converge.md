---
id: converge
name: amby.converge
description: Check the codebase against spec, plan, and tasks after implementing; append gap tasks, never edit code.
argument-hint: "[feature id, defaults to current]"
phase: converge
role: qa
reads: [specs/NNN-slug/spec.md, specs/NNN-slug/plan.md, specs/NNN-slug/tasks.md, specs/NNN-slug/tests.md]
writes: [specs/NNN-slug/tasks.md, specs/NNN-slug/spec.md]
allowedTools: [read, edit]
---

Converge feature `$ARGUMENTS` (default: the current feature): does the code satisfy its artifacts?
Never edit source code — only that feature's `tasks.md` and `spec.md` are writable.

Run `ambykit activity <feature> --agent=$AGENT --phase=converge` first, with that feature's number; ignore any error.
Then run `ambykit trace <feature> --json`; if it fails, go on as without it. Its uncovered requirements are
gaps already — do not re-derive coverage by reading every test; read tests only to judge whether the covered
ones truly satisfy their requirement.

1. No `tasks.md` → stop, say to run `/amby.tasks`. No `plan.md` → converge on spec + tasks and say so.
2. For every `FR-###`/`SC-###`, plan decision (incl. `data-model.md`/`contracts/`), and checked
   `T###`: look for evidence only in files the plan/tasks name. Classify **covered**, **gap**
   (absent), or **unverified** (inconclusive). Skip items the plan marks deferred/out of scope. If `tests.md`
   exists, read it after the `trace` matrix (where there is one) and treat its cases as the expected tests; spend
   effort only on what neither answers.
3. **Append, don't rewrite.** Under `## Convergence` in `tasks.md` (create at the end if absent) add
   `- [ ] [T###] [US#] … (closes NNN:FR-###)` per gap and `- [ ] [T###] [US#] [VERIFY] …` per unverified
   item. Continue IDs from the highest `T###` anywhere in the file; skip items already listed
   unchecked there. Nothing to add → leave the file untouched.
4. In `spec.md`, change only statuses: a story → `done` (`ambykit edit status <feature> US-# done`) when every
   FR/SC it maps to is covered; the feature's frontmatter `status:` → `done` when all stories are.
5. Report: **converged** (no gaps) or **gaps found (N)**, counts per class, and a table of every ID
   with its class and a one-line reason for each gap/unverified item.
