---
feature: 011-converge
created: 2026-08-25
---

# Tasks — Converge — post-implement gap check against spec, plan, tasks

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.

## Phase 1 — Setup

- [x] [T001] Create branch `011-converge` from `main` (git)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Add `converge.md` prompt skeleton: frontmatter per plan contract table (id/name/phase/argument-hint/reads/writes/allowedTools `[read, edit]`), empty body (src/prompts/converge.md)
- [x] [T011] [P] Append `"converge"` after `"implement"` in `PHASE_SEQUENCE` (src/core/rules.ts)
- [x] [T012] [P] Add emit test asserting id/name/phase/`allowedTools` and that Claude, Cursor, and Copilot emitters emit `amby.converge` (test/converge-emit.test.ts)
- [x] [T013] Run `npm run typecheck` and `npm test`; confirm T012 passes and existing snapshot tests still pass (test/)

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] Write body step 1: resolve `$ARGUMENTS`/current feature; stop if `tasks.md` missing (FR-011); note plan-less mode (FR-012, FR-015) (src/prompts/converge.md)
- [x] [T021] [US1] Write body step 2: classify every `FR-###`/`SC-###`, plan decision, checked `T###` as covered / gap / unverified; skip deferred/out-of-scope items (FR-002, FR-003, FR-013) (src/prompts/converge.md)
- [x] [T022] [US1] Write body step 5: verdict, counts, per-ID table with one-line reasons (FR-008) (src/prompts/converge.md)
- [x] [T023] [US1] Manual fixture check: scratch feature with 1 unimplemented FR → reported as gap; fully implemented feature → **converged** (manual, scratchpad project)
- **Checkpoint:** US-1 is demoable — converge reports gaps without writing.

## Phase 4 — User story US-2  (priority: P1, depends-on US-1)

- [x] [T030] [US2] Write body step 3: append `## Convergence` tasks — one per gap `(closes FR-…)`, one `[VERIFY]` per unverified; IDs continue from highest `T###` anywhere in file; skip existing unchecked duplicates; no-op when nothing to append (FR-004, FR-005, FR-007, FR-013) (src/prompts/converge.md)
- [x] [T031] [US2] Manual fixture check: 2 gaps + 1 unverified → exactly 3 new tasks, prior content byte-identical; second run appends nothing (SC-001, SC-002) (manual, scratchpad project)
- [x] [T032] [US2] Verify word count of prompt body is in the `analyze`/`implement` band (~150–180 words) (FR-014) (src/prompts/converge.md)
- **Checkpoint:** US-2 is demoable — implement → converge loop closes.

## Phase 5 — User story US-3  (priority: P2, depends-on US-1)

- [x] [T040] [US3] Write body step 4: patch only `status:` lines — story → `done` when all its FR/SC covered; feature → `done` when all stories done (FR-009) (src/prompts/converge.md)
- [x] [T041] [US3] Dogfood: run `/amby.converge 001-core-and-claude-emitter`; expect **converged** and `status: done`; confirm `ambykit dashboard` shows it (SC-005) (specs/001-core-and-claude-emitter/spec.md)
- **Checkpoint:** US-3 is demoable — statuses reflect reality.

## Phase 6 — User story US-4  (priority: P2, depends-on US-1)

- [x] [T050] [US4] Run `ambykit sync` on the repo; commit regenerated `.claude/commands/amby.converge.md` and any updated `AGENTS.md`/`CLAUDE.md` region (.claude/commands/, AGENTS.md)
- [x] [T051] [US4] Run `ambykit check`; confirm no drift (CLI)
- **Checkpoint:** US-4 is demoable — every target emits converge.

## Phase 7 — User story US-5  (priority: P3, depends-on US-1)

- [x] [T060] [P] [US5] Add site phase page with frontmatter `phase: converge`, `command: amby.converge`, `reads`/`writes` matching the prompt, `order: 10` (site/src/content/docs/workflow/converge.mdx)
- [x] [T061] [P] [US5] Add LinkCard, Mermaid node `implement ⇄ converge`, and `converge` in the a11y summary (site/src/content/docs/workflow/index.mdx)
- [x] [T062] [P] [US5] Add Converge row to the phase table and a short section describing the loop (docs/workflow.md)
- [x] [T063] [P] [US5] Add `/amby.converge` to the command list and workflow table (README.md)
- [x] [T064] [P] [US5] Mention the implement → converge loop after `/amby.implement` (docs/getting-started.md)
- [x] [T065] [US5] Run `node scripts/check-docs-sync.mjs`; all A1–A9 pass (scripts/check-docs-sync.mjs)
- **Checkpoint:** US-5 is demoable — docs describe and link converge.

## Phase 8 — Polish

- [x] [T090] Final `npm run typecheck && npm test`; open PR `011-converge` → `main` (git)
