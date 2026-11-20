---
feature: 033-stable-run-and-plugin-api
created: 2026-11-20
---

# Tasks — Stable run and plugin API

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes. **Extra gates:** (1) **person gates** T033, T034, T041 and T042 need a live
> install of each assistant and a person; until they pass, runners stay `verified: false` and `run` stays experimental, and the rest of
> this feature (the plugin API freeze, the contract, the policy) still ships; (2) specs 027, 028, 031 are merged; (3) spec 036 may need
> plugin-API additions, and any addition must land before T050 flips the version. Tests name what they cover as `033:FR-###`.
> Story order: US-1 → US-5 → US-4 → US-6, US-2 → US-3. (US-2 and US-3 end in person tasks.)
> Written in the 1.x task format on purpose: the repo's own specs migrate last (030 T095).

## Phase 1 — Setup

- [x] [T001] Contract block helper: parse the fenced `contract` json blocks of a markdown file into typed lists (flags, exitCodes, stateFiles, exports) (test/helpers/contract-doc.ts)
- [x] [T002] Fixture: a fake runner registry with and without verification records, for platform and version cases (test/helpers/runner-registry-fixture.ts)
- **Verify:** `npm run typecheck` passes and the helper parses a sample block in a unit test. ✓ passed

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] `RunnerSpec` gains `verifiedOn` and `verifiedRange`; `runnable(id, { platform, version })` refuses an unlisted platform or an out-of-range version and says which (src/core/runners.ts, test/core/runners-verification.test.ts) ↪ DEVIATION: runnable() takes the registry or the environment as its second argument so the existing callers are unchanged; a version is checked only when one is supplied (the run path does not detect the assistant's version yet, so only platform is enforced at run time until T063/T064 record versions)
- [x] [T011] [P] `deprecated(name, replacement)`: one stderr line, once per process, behaviour unchanged (src/core/deprecation.ts, test/core/deprecation.test.ts)
- [x] [T012] [P] `RUN_STABILITY` constant and one `stabilityLabel()` replacing the scattered "(experimental)" strings (src/core/run-stability.ts, src/cli/run.ts, src/cli/run-fleet.ts, src/cli/run-script.ts, src/core/fleet-plan/format.ts)
- [x] [T013] [P] `docs/stability.md` skeleton: what stable promises, additions rule, policy headings, empty `contract` blocks (docs/stability.md)
- [x] [T014] The contract test: each listed flag, exit code, state-file path and export is checked against the code; a missing item fails (test/stability-contract.test.ts) ↪ DEVIATION: the contract test builds its facts from one real fake-assistant run (printed lines, exit code 0, state files), a no-feature probe (exit 1) and a --runners probe (exit 0), so every listed exit code, printed line and state file is checked against real behaviour
- **Verify:** `npm run typecheck` and `npx vitest run test/core/runners-verification.test.ts test/core/deprecation.test.ts test/stability-contract.test.ts` pass. ✓ passed: the contract test reads the (still empty) blocks and checks the doc's prose rules
- **Checkpoint:** the verification model, the deprecation helper, the label constant and the contract test exist. User stories may start.

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] Fill the `run` contract blocks: flags, exit codes 0 and 1, structure of the plan and finish lines, `.amby/fleet/` layout, directive protocol (docs/stability.md)
- [x] [T021] [US1] Fill the plugin contract blocks: exported names, descriptor shape, loading rules, kit exports; state that unlisted things are not covered and additions are allowed in a minor release (docs/stability.md)
- [x] [T022] [US1] Tests: every promise has a check; an unlisted name is not asserted; additions do not fail the contract test — 033:FR-001, FR-002, FR-003, FR-013 (test/stability-contract.test.ts)
- **Verify:** `npx vitest run test/stability-contract.test.ts` passes and `node scripts/check-docs-sync.mjs` is clean. ✓ passed
- **Checkpoint:** US-1 done; the contract is readable and enforced.

## Phase 4 — User story US-5  (priority: P2, needed by US-4 and US-6)

- [x] [T030] [US5] Policy text: deprecate in a minor, remove in the next major, notice once per run to stderr, security exception recorded in the changelog (docs/stability.md)
- [x] [T031] [US5] Tests: a hypothetical rename follows the policy; the notice prints once to stderr and the command still works — 033:FR-010, FR-011 (test/core/deprecation.test.ts) ↪ DEVIATION: the notice tests (033:FR-010, FR-011) were written with the helper in T011, in the same file; this task adds the hypothetical-rename case and the stderr-not-stdout case
- **Verify:** `npx vitest run test/core/deprecation.test.ts` passes. ✓ passed
- **Checkpoint:** US-5 done.

## Phase 5 — User story US-4  (priority: P1)

- [x] [T040] [P] [US4] `PLUGIN_API_VERSION = "2.0.0"`; remove `PLUGIN_API_EXPERIMENTAL` from the exports and the experimental note from the loader report (src/plugins/api.ts, src/plugins/index.ts, src/plugins/report.ts, src/index.ts) ↪ DEVIATION: PLUGIN_API_1X (1.0.0) is a new internal constant the loader uses for the compatibility rule; the 036 MCP_* names were already on the API, so no further addition was needed before the freeze
- [x] [T041] [P] [US4] Loader: accept a `^1` range as a 1.x plugin with a one-line note; refuse a range that excludes 1.x and 2.x naming the version it needs; hint when a plugin imported an internal name (src/plugins/loader.ts) ↪ DEVIATION: the loaded plugin carries a notes list that the report prints under the plugin; the refusal message gained the suffix '(it accepts plugins declaring ^1 or ^2)'; the internal-name hint is importHint() in the loader and treats MCP_SERVER_NAME and MCP_COMMAND as API names
- [x] [T042] [P] [US4] Contract kit exposes and checks only the frozen surface; its exports are listed in the contract block (src/testkit/index.ts, src/testkit/contract.ts) ↪ DEVIATION: the kit already exported only listed names; the change is a test (033:FR-008) that its runtime exports equal the contract's kit list and that an emitter built from the frozen API passes it; its doc comment no longer says experimental
- [x] [T043] [US4] Update `docs/plugin-api.md` (remove "experimental"), `docs/plugin-trust.md`, the changelog `[plugin-api]` convention and its pinned test (docs/plugin-api.md, docs/plugin-trust.md, test/plugins/api-version.test.ts) ↪ DEVIATION: also updated docs/cli-reference.md, docs/architecture.md, docs/tool-compatibility.md and the worked example (package.json range ^2, README, index.js comment); the wrongrange fixture now declares ^3 and the skills-target fixture ^2; four 027 tests that pinned 1.0.0/experimental were rewritten as 033:FR-007 and FR-009 tests
- [x] [T044] [US4] Tests: version is 2.x, no experimental marker, `^1` plugin loads with a note, an excluding range is refused, a plugin using an internal name gets the hint, the kit checks only the frozen surface — 033:FR-007, FR-008, FR-009 (test/plugins/stable-api.test.ts, test/plugins/loader.test.ts, test/plugins/testkit.test.ts) ↪ DEVIATION: the tests are test/plugins/stable-api.test.ts and legacy-plugin.test.ts (new), plus edits to loader.test.ts, api-version.test.ts, extension-points.test.ts, testkit.test.ts and sync-plugins.test.ts
- **Verify:** `npx vitest run test/plugins` passes. ✓ passed (and the sync plugin tests)
- **Checkpoint:** US-4 done; any 036 API addition has landed before T040 (see the gate above).

## Phase 6 — User story US-6  (priority: P2)

- [x] [T050] [US6] Fixture: a fleet run directory written by the v1.6.0 build with the fake runner, interrupted mid-run and one interrupted mid-merge (test/fixtures/run-1.6/, test/helpers/run-1.6-fixture.ts) ↪ DEVIATION: the run directories were generated by the tagged v1.6.0 build (git archive of the tag, built in a scratch folder, with 1.6.0's own helpers and 028's interrupt and conflict scenarios), not hand-written; only the .amby/fleet/<run>/ state is stored, and the test recreates the git state of lanes with the 2.x harness before replacing the state with the 1.6.0 files
- [x] [T051] [US6] Fixture: a plugin written for the 1.0 API (object form and factory form) (test/fixtures/plugins/api-1.0/) ↪ DEVIATION: three fixtures instead of two: object form, factory form, and a 1.x plugin that imported an internal module (the case the hint is for); they live under test/fixtures/plugins/api-1.0/<package>/
- [x] [T052] [US6] Tests: 2.0 resumes the 1.6 run without repeating completed lanes; the 1.0 plugin loads, or names the names it relied on — 033:FR-009, FR-012 (test/cli/run-resume-1.6.test.ts, test/plugins/legacy-plugin.test.ts) ↪ DEVIATION: each resume scenario also runs as a control from the state 2.x itself wrote and the two outcomes must be equal; mid-merge continuation passes --max-tasks because every task is already checked and the default task budget would stop the run at once (a property of continuing a finished-task run, not of 1.6 files)
- **Verify:** `npx vitest run test/cli/run-resume-1.6.test.ts test/plugins/legacy-plugin.test.ts` passes. ✓ passed
- **Checkpoint:** US-6 done.

## Phase 7 — User story US-2  (priority: P1; ends in person gates)

- [x] [T060] [US2] `run --runners` and the plan print each runner's platforms and version range, and say "unverified on this platform" when it does not match (src/cli/run.ts, src/core/runners.ts) ↪ DEVIATION: the listing prints 'verified (<version>) on <platforms> for <range>' only for a runner that has a record; a runner without one prints exactly what 1.6 did; a lane refused for its platform already carries the 'unverified on this platform' reason from runnable()
- [x] [T061] [US2] Record test: `verified: true` requires a record file under `verification/` for every platform in `verifiedOn`, with version, invocation, prompt delivery, exit and usage (test/core/runner-records.test.ts, specs/033-stable-run-and-plugin-api/verification/README.md) ↪ DEVIATION: the check function lives in the test (a record per operating system with eight labelled fields, the verified version mentioned); the shipped registry has no verified runner yet, so the test passes vacuously for it until T063/T064 add records, and is proven against fixtures
- [x] [T062] [US2] Tests: an unlisted platform or version is not runnable by default and is reported — 033:FR-004, FR-005 (test/core/runners-verification.test.ts) ↪ DEVIATION: the tests are in test/core/runners-verification.test.ts (written with T010) and test/cli/run-runners-platform.test.ts
- [ ] [T063] [US2] **Person task:** verify the `claude` runner on a live install per operating system (including a Windows `.cmd` shim); write `verification/claude-<os>.md`; set `verified`, `verifiedOn`, `verifiedRange` from it (specs/033-stable-run-and-plugin-api/verification/, src/core/runners.ts, docs/tool-compatibility.md)
- [ ] [T064] [US2] **Person task:** the same for `codex` (specs/033-stable-run-and-plugin-api/verification/, src/core/runners.ts, docs/tool-compatibility.md)
- **Verify:** `npx vitest run test/core/runner-records.test.ts test/core/runners-verification.test.ts` pass. ? unverified: T063 and T064 need a live install and a person.
- **Checkpoint:** US-2 done when a record exists for every runner marked runnable, and none without one is runnable by default (SC-001).

## Phase 8 — User story US-3  (priority: P1; ends in person gates)

- [x] [T070] [US3] Guard: `RUN_STABILITY` may be `"stable"` only if `specs/033-stable-run-and-plugin-api/dogfood.md` records a fleet run id, runner, versions and result — 033:FR-006 (src/core/run-stability.ts, test/core/run-stability.test.ts) ↪ DEVIATION: dogfoodProblems() and stabilityProblems() are pure functions in src/core/run-stability.ts; test/core/run-stability.test.ts fails if RUN_STABILITY is 'stable' without a passing record in dogfood.md (which does not exist yet)
- [ ] [T071] [US3] **Person task:** run the dogfood (also 031 T094): one fleet builds two dependent features of this repository with a verified runner; record it in `dogfood.md` and the features' notes (specs/033-stable-run-and-plugin-api/dogfood.md, specs/031-multi-feature-fleets/notes.md)
- [ ] [T072] [US3] **Person task:** if T071 passed, set `RUN_STABILITY = "stable"` and drop the "(experimental)" text from help and docs; if not, leave `run` experimental and say so in the 2.0 changelog (src/core/run-stability.ts, docs/cli-reference.md, docs/stability.md)
- **Verify:** `npx vitest run test/core/run-stability.test.ts` passes. ? unverified: T071 and T072 need a live run and a person.
- **Checkpoint:** US-3 done when the dogfood is recorded, or `run` stays experimental on purpose.

## Phase 9 — Polish and integration

- [ ] [T080] INTEGRATION STEP (once per batch, after merges, not in a lane branch): re-record the emitter goldens with `UPDATE_GOLDEN=1 npx vitest run test/emitters-golden.test.ts` if any help or prompt text changed (test/fixtures/emitters-golden/)
- [ ] [T081] INTEGRATION STEP (once per batch, after merges): run `ambykit sync` twice; the second run is a no-op (.claude/, .agents/, .github/)
- [ ] [T082] Docs and changelog: `docs/stability.md` links from the README, `docs/cli-reference.md` and `docs/plugin-api.md`; `[plugin-api]` changelog lines and the "Plugins:" line (CHANGELOG.md, README.md, docs/cli-reference.md)
- [ ] [T083] Full gate: `npm run typecheck`, `npm test`, `node scripts/check-docs-sync.mjs`, `ambykit trace 033` shows every FR covered (test/check-docs-sync.test.ts)
- [ ] [T084] **Person task:** confirm clarifications C-1 to C-4 (assumed defaults) or change them; record the answers in `spec.md` (specs/033-stable-run-and-plugin-api/spec.md)
- **Verify:** `npm run typecheck` and `npm test` pass and `node dist/cli/index.js trace 033` shows 13 of 13 requirements covered. ? unverified: T084 is a person task.
- **Checkpoint:** feature complete except the person gates above.
