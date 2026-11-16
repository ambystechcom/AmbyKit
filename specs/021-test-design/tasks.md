---
feature: 021-test-design
created: 2026-11-16
---

# Tasks — Test design before code

> Line format: `- [ ] [T###] [P?] [US#] description (file/path, other/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Paths: repo-relative, comma-separated, dirs end `/`, no globs. `[P]` tasks in a phase must not share or nest paths.
> Gate: no user-story task starts until Foundational completes.
> All work happens in `.worktrees/021-test-design/`; edit neutral source, never generated tool files.
> Ordering (QA Q-06/Q-07/Q-11/Q-13): 021 owns the `tests.md` grammar, so T001/T010/T013 land before any
> spec 024 task that reads `tests.md` (024 T051, T070). Prompts that call `ambykit` verbs need spec 024
> T031 (generalized Claude shell grant, batch 0) built first. 021 and 022 build in ONE lane, 021 first.
> T094/T095 are integration steps (run once per batch after merges, never in a lane branch).

## Phase 1 — Setup

- [x] [T001] [P] Add the `tests.md` template with the case/section/skip format and both `uncovered` forms from plan.md (src/templates/tests.md)
- [x] [T002] [P] Hand-author this feature's own `tests.md` in the new format before any code (dogfood, SC-006) (specs/021-test-design/tests.md)
- **Verify:** `specs/021-test-design/tests.md` has a case for every acceptance criterion of US-1..US-7, each citing story and FR IDs, and the template parses by eye against plan.md. ✓ passed

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] Write pure `parseTestDesign`/`checkTestDesign` (cases, uncovered in BOTH the section line and the one-line `uncovered: FR-### — reason` form, flags, skip form, findings) and export them; this is the single grammar spec 024 reuses (src/core/test-design.ts, src/core/index.ts)
- [x] [T011] [P] Register `tests.md` in `ARTIFACT_TEMPLATES` so `sync` installs it (src/core/scaffold.ts)
- [x] [T012] Update the scaffold test for the new template count; spec 022 later rebases its count on this one (same lane) (test/scaffold.test.ts)
- [x] [T013] Unit-test the parser and checker: format, fixed manual reasons, duplicate IDs, unknown IDs, skip form, both uncovered forms parse identically (test/core/test-design.test.ts)
- **Verify:** `npm run typecheck` and `npx vitest run test/core/test-design.test.ts test/scaffold.test.ts` pass. ✓ passed

## Phase 3 — User stories US-1, US-2, US-3  (priority: P1)

- [x] [T020] [US1] Extend `/amby.tasks`: write `tests.md` in the same phase, ready-spec gate, one case per criterion incl. negative, vague criteria to `## Flags`, max 15 cases per story (src/prompts/tasks.md)
- [x] [T021] [US2] Add the decision rule to the tasks prompt: `auto` by default, `manual:<reason>` only from the fixed list with `verify:` and `record:` (src/prompts/tasks.md)
- [x] [T022] [US3] Add ID rules to the tasks prompt: cite `US-n#k` and `FR-###`, `TC-###` max+1 never reused, `## Uncovered` with a reason (either `- FR-###: deliberately uncovered — reason` or `uncovered: FR-### — reason`) (src/prompts/tasks.md)
- [x] [T023] [US3] Read each feature's `tests.md` in `analyzeProject` and add `testDesign: { findings, missing }` to the report (src/core/analyze.ts)
- [x] [T024] [US3] Print test-design findings only for features that have `tests.md`; keep the exit code unchanged (src/cli/analyze.ts)
- [x] [T025] [US3] Test the checker against fixture specs: uncovered FR, unknown ID, more than 15 cases (test/core/test-design-check.test.ts)
- [x] [T026] [US3] Test the analyze command output and `--json` shape with a designed feature (test/cli/analyze-test-design.test.ts)
- **Checkpoint:** US-1, US-2 and US-3 are demoable: tasks prompt produces cases, `analyze` reports coverage.
- **Verify:** `npx vitest run test/core/test-design-check.test.ts test/cli/analyze-test-design.test.ts` pass and `ambykit analyze` on this worktree reports no findings for `specs/021-test-design/tests.md`. ✓ passed

## Phase 4 — User story US-7  (priority: P1)

- [x] [T030] [US7] Add the skip argument to the tasks prompt: write only `skipped: <reason>` (src/prompts/tasks.md)
- [x] [T031] [US7] Report features with no `tests.md` only under JSON `missing`, never in human output (src/core/analyze.ts, src/cli/analyze.ts) ↪ DEVIATION: already delivered by T023 and T024 (testDesign is present only when a feature has a tests.md); T032 tests it
- [x] [T032] [US7] Regression test: features without `tests.md` give byte-identical analyze output and `skipped:` is valid (test/cli/analyze-no-design.test.ts)
- **Checkpoint:** US-7 is demoable: existing projects see no change.
- **Verify:** `npx vitest run test/cli/analyze-no-design.test.ts test/analyze.test.ts test/cli/analyze-lanes.test.ts` pass unchanged. ✓ passed

## Phase 5 — User stories US-4, US-5, US-6  (priority: P2)

- [ ] [T040] [P] [US4] Make `/amby.implement` note a missing `tests.md` at the checkpoint, build to the story's cases and name tests `NNN:FR-###` (src/prompts/implement.md)
- [ ] [T041] [P] [US5] Make `/amby.converge` read `tests.md` cases as expected tests after the trace matrix when one exists (src/prompts/converge.md)
- [ ] [T042] [P] [US6] Add refresh rules to the tasks prompt: patch only cases citing changed criteria, keep IDs, mark `[obsolete]`, clear `[stale]` (src/prompts/tasks.md)
- [ ] [T043] [P] [US6] Make `/amby.revise` flag cases citing changed criteria as `[stale]` (src/prompts/revise.md)
- **Checkpoint:** US-4, US-5 and US-6 are demoable end to end on a sample feature.
- **Verify:** each edited prompt still emits for every target (`npx vitest run test/command-spec.test.ts test/converge-emit.test.ts test/revise-emit.test.ts`).

## Phase 6 — Polish

- [ ] [T090] [P] Document the artifact and its format (docs/artifacts/tests.md)
- [ ] [T091] [P] Mention `tests.md` in the tasks artifact page and workflow table (docs/artifacts/tasks.md, docs/workflow.md)
- [ ] [T092] [P] Note the `analyze` test-design findings and JSON field (docs/cli-reference.md)
- [ ] [T093] [P] Add an Unreleased changelog entry (CHANGELOG.md)
- [ ] [T094] INTEGRATION STEP (once per batch, after merges; not in the lane branch): re-run `ambykit sync` so the repo's own tool files and `.amby/templates/tests.md` match the source (.claude/, .codex/, .amby/)
- [ ] [T095] INTEGRATION STEP (once per batch, after merges; not in the lane branch): re-record the emitter golden snapshots and review that only the three prompts changed (test/fixtures/emitters-golden/)
- **Verify:** `npm run typecheck`, `npm test` and `node scripts/check-docs-sync.mjs` pass, and a second `ambykit sync` produces no diff.
