---
feature: 009-continue-spec
created: 2026-07-20
---

# Tasks — Continue / edit an existing feature's spec & design (`/amby.revise`)

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Derived from `plan.md` (phases 2–5 = US-1→US-4). Decisions in `research.md`. This feature is a
> neutral prompt — most work is authoring `src/prompts/revise.md`; behavior is prompt-enforced.

## Phase 1 — Setup

- [x] [T001] Confirm `revise` is a free CommandSpec id/name and pick its `PHASE_SEQUENCE` slot (after `clarify`) (src/core/rules.ts)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Create `src/prompts/revise.md` with valid frontmatter (id/name/description/argument-hint/phase/reads/writes/allowedTools) + body skeleton (src/prompts/revise.md)
- [x] [T011] Add `"revise"` to `PHASE_SEQUENCE` after `"clarify"` (src/core/rules.ts)
- [x] [T012] [P] Test: `loadCommandSpecs` parses `revise` and every emitter emits its command file (FR-006) (test/revise-emit.test.ts)
- **Checkpoint:** `/amby.revise` loads as a CommandSpec and emits to all tools; body still a stub.

## Phase 3 — User story US-1 — Continue an existing feature's spec  (priority: P1)

- [x] [T020] [US1] Author the continue body: resolve feature dir; add/refine `US-#`/`FR-###`/`SC-###` in place, preserving existing IDs/text; new items take the next number (FR-001/002, Principle 3) (src/prompts/revise.md)
- [x] [T021] [US1] Instruct EARS for new requirements + Given/When/Then for acceptance, consistent with `specify` (src/prompts/revise.md)
- [x] [T022] [US1] Feature-not-found → clear error, no changes (FR-007) (src/prompts/revise.md)
- **Checkpoint:** US-1 demoable — running `/amby.revise` on a draft feature adds/refines content while preserving all existing IDs.

## Phase 4 — User story US-2 — Done-guard + redirect  (priority: P1, depends US-1)

- [x] [T030] [US2] Add the done-guard: `spec.md` status `done` → make no edits, direct the author to `/amby.specify` a new feature (FR-003) (src/prompts/revise.md)
- [x] [T031] [US2] On continue, set `spec.md` status to `in-progress`; leave individual `done` stories untouched, allow new stories (FR-004) (src/prompts/revise.md)
- [x] [T032] [US2] State the command's scope as distinct from `clarify` (markers only) and `specify` (new feature) (FR-008) (src/prompts/revise.md)
- **Checkpoint:** US-2 demoable — a `done` feature is refused with a redirect; a draft/in-progress one proceeds and flips to in-progress.

## Phase 5 — User story US-3 — Progress view reflects state  (priority: P2, depends US-1)

- [x] [T040] [P] [US3] Verification test: a story set to `in-progress` renders in-progress on the dashboard; a `done` feature stays done (no code change — R-1) (test/dashboard-status.test.ts)
- **Checkpoint:** US-3 demoable — `ambykit dashboard` reflects continued (in-progress) vs done state.

## Phase 6 — User story US-4 — Continue the UI/design too  (priority: P3, depends US-1)

- [x] [T050] [US4] Author the design branch: if `ui.md` exists, continue it in place preserving existing sections; if absent, direct the author to `/amby.design` (FR-009) (src/prompts/revise.md)
- **Checkpoint:** US-4 demoable — `/amby.revise` extends an existing `ui.md`, or redirects when none exists.

## Phase 7 — Polish

- [x] [T090] Add site workflow page `revise.mdx` (phase/command/reads/writes) + renumber `order` after clarify for A3 contiguity (site/src/content/docs/workflow/revise.mdx, site/src/content/docs/workflow/*.mdx)
- [x] [T091] [P] Mention `/amby.revise` in the workflow docs (docs/workflow.md)
- [ ] [T092] docs-sync green ✓ + emitter/e2e file-count updated ✓; **pending:** run `ambykit sync` to regenerate the repo's own `.claude/commands/amby.revise.md` (self-host, user-controlled) (repo root, test/*)
- [x] [T093] `npm run typecheck` + `npm test` green (repo root)
