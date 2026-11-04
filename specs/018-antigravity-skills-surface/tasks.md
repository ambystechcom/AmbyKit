---
feature: 018-antigravity-skills-surface
created: 2026-11-04
---

# Tasks — Antigravity skills surface

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Order of stories: US-1 → US-2 → US-3 → US-4 (US-2/3/4 each `depends-on` US-1).

## Phase 1 — Setup

- [x] [T001] Rebase this branch onto `016-agent-surface-expansion` (R1); confirm `SkillsEmitter` and the guard are present (specs/018-antigravity-skills-surface/)
- [x] [T002] Phase 0 research: verify skill frontmatter keys, the CLI slash name a skill gets, and the CLI cutoff scope against Antigravity's docs or a live install (specs/018-antigravity-skills-surface/research.md)
- [x] [T003] Update the compatibility matrix first (P4): Antigravity rows to skills, retired workflows and cutoff, the shared-file identity rule, the stale-file opt-in, sources (docs/tool-compatibility.md)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] Rank shared-file self-report ids `codex` > `antigravity` > `antigravity-cli` in the collision guard, order-independent; unlisted ids keep last-writer-wins (FR-010) (src/core/emit.ts)
- [x] [T011] [P] Add `protectForeign` to `EmittedFile`, skip existing files lacking the generated notice into `WriteResult.skippedForeign`, export `backupFile` (FR-016) (src/core/types.ts, src/cli/io/fsops.ts)
- [x] [T012] [P] Group `sharedOutputs` by command directory instead of emitter so Antigravity and Codex list as co-owners (FR-008) (src/emitters/index.ts)
- [x] [T013] [P] Add pure `legacyWorkflowFiles(root, config)`: known-phase `.agents/workflows/amby.<id>.md` with the generated notice, only when an Antigravity target is selected (FR-005, FR-006) (src/core/legacy.ts)
- [x] [T014] Make `SkillsEmitter` set `protectForeign` on its command files (after T011) (src/emitters/skills-emitter.ts)
- [x] [T015] [P] Test the priority rule: both config orders, codex+antigravity, IDE+CLI, and a real content difference still throws (test/emit-collision.test.ts)
- [x] [T016] [P] Test the foreign-file guard: foreign file kept and reported, generated file overwritten, dry-run safe (test/apply-foreign.test.ts)
- [x] [T017] [P] Test `sharedOutputs` by directory, including antigravity with codex and with pi (test/shared-outputs.test.ts)
- [x] [T018] [P] Test `legacyWorkflowFiles`: generated files found, user workflow and non-phase names ignored, nothing without an Antigravity target (test/legacy.test.ts)
- **Checkpoint:** foundations are covered by tests; `npm run typecheck` passes.

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] Make `AntigravityEmitter` extend `SkillsEmitter` with `.agents/skills`; no workflow output; update the doc comments (FR-001, FR-002, FR-003) (src/emitters/antigravity.ts, src/emitters/antigravity-cli.ts)
- [x] [T021] [P] [US1] Regenerate the two Antigravity golden fixtures and review the diff is only workflows to skills (test/fixtures/emitters-golden/antigravity.json, test/fixtures/emitters-golden/antigravity-cli.json)
- [x] [T022] [P] [US1] Snapshot test per Antigravity target: paths, `name`/`description` frontmatter, no `$ARGUMENTS`, edit-a-prompt-and-resync (FR-014) (test/antigravity-skills-018.test.ts)
- **Checkpoint:** US-1 is demoable: a sync with either Antigravity target writes `.agents/skills/amby-*/SKILL.md`.

## Phase 4 — User story US-2  (priority: P1)

- [ ] [T030] [US2] Add `sync --prune-legacy` (back up each stale generated workflow, then delete it), print the stale notice by default, warn on `skippedForeign`, update usage (FR-005, FR-016) (src/cli/sync.ts)
- [ ] [T031] [P] [US2] Make `check` report stale generated workflows with the opt-in and foreign-file collisions, without counting stale files as drift (FR-007) (src/cli/check.ts)
- [ ] [T032] [P] [US2] E2E over a project synced with the old release: default keeps files, opt-in removes only generated ones, restore brings one back, a clean project prints nothing (SC-002) (test/antigravity-migration-018.test.ts)
- **Checkpoint:** US-2 migration is demoable from an old-release fixture.

## Phase 5 — User story US-3  (priority: P2)

- [ ] [T040] [P] [US3] Test shared skills with Codex and Pi: written once, correct identity, deselecting Antigravity keeps the files (FR-008, FR-009, SC-003) (test/antigravity-shared-018.test.ts)
- [ ] [T041] [P] [US3] Test `check` names every owner of `.agents/skills/` (test/check-antigravity-018.test.ts)
- **Checkpoint:** US-3 holds for every skills-based combination.

## Phase 6 — User story US-4  (priority: P2)

- [ ] [T050] [P] [US4] Assert every non-Antigravity golden fixture is unchanged in `git diff` and the golden suite passes (FR-011, SC-004) (test/emitters-golden.test.ts)
- [ ] [T051] [P] [US4] Test both Antigravity ids still resolve to the antigravity family in the dashboard (FR-012) (test/dashboard-agents.test.ts)
- **Checkpoint:** US-4 byte-identity and recognition proven.

## Phase 7 — Polish

- [ ] [T090] [P] Antigravity wording in the README (FR-013) (README.md)
- [ ] [T091] [P] Document `sync --prune-legacy` and the skills surface (FR-013) (docs/cli-reference.md)
- [ ] [T092] [P] Update the workflow guide (FR-013) (docs/workflow.md)
- [ ] [T093] [P] Fix the command-surface line: workflows now only Windsurf (AGENTS.md)
- [ ] [T094] [P] Update the site compatibility page (site/src/content/docs/cli/compatibility.mdx)
- [ ] [T095] [P] CHANGELOG: Changed (Antigravity now skills, guard, shared-id rule) and Added (`--prune-legacy`) (CHANGELOG.md)
- [ ] [T096] Run `ambykit sync --check`, `npm run typecheck`, full `npm test`, docs-sync; fix drift (SC-006) (test/)
- [ ] [T097] Live check SC-001 on a current Antigravity IDE and CLI, or waive it in writing with the date (specs/018-antigravity-skills-surface/research.md)
