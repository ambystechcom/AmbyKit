---
id: converge
name: amby.converge
description: Check the codebase against spec, plan, and tasks after implementing; append gap tasks, never edit code.
argument-hint: "[feature id, defaults to current]"
phase: converge
role: qa
reads: [specs/NNN-slug/spec.md, specs/NNN-slug/plan.md, specs/NNN-slug/tasks.md]
writes: [specs/NNN-slug/tasks.md, specs/NNN-slug/spec.md]
allowedTools: [read, edit]
---

Converge feature `$ARGUMENTS` (default: the current feature): does the code satisfy its artifacts?
Never edit source code — only that feature's `tasks.md` and `spec.md` are writable.

1. No `tasks.md` → stop, say to run `/amby.tasks`. No `plan.md` → converge on spec + tasks and say so.
2. For every `FR-###`/`SC-###`, plan decision (incl. `data-model.md`/`contracts/`), and checked
   `T###`: look for evidence only in files the plan/tasks name. Classify **covered**, **gap**
   (absent), or **unverified** (inconclusive). Skip items the plan marks deferred/out of scope.
3. **Append, don't rewrite.** Under `## Convergence` in `tasks.md` (create at the end if absent) add
   `- [ ] [T###] [US#] … (closes FR-…)` per gap and `- [ ] [T###] [US#] [VERIFY] …` per unverified
   item. Continue IDs from the highest `T###` anywhere in the file; skip items already listed
   unchecked there. Nothing to add → leave the file untouched.
4. In `spec.md`, patch only `status:` lines: a story → `done` when every FR/SC it maps to is
   covered; the feature → `done` when all stories are.
5. Report: **converged** (no gaps) or **gaps found (N)**, counts per class, and a table of every ID
   with its class and a one-line reason for each gap/unverified item.
