---
feature: 024-trace
created: 2026-11-16
---

# Tasks — Requirement traceability (trace)

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Every new test is named `024:FR-###: …` so the feature traces itself (SC-006).
> Ordering (QA Q-06/Q-07/Q-11): T031 (Claude shell grant) is BATCH 0, built first because other specs
> depend on it. Tasks that read `tests.md` (T015, T051, T070) build AFTER spec 021's format tasks
> (021 T001, T010, T013) and use 021's `parseTestDesign`, not their own grammar. T033, T034 and T094 are
> integration steps run once per batch after merges, never in a lane branch.
> Each phase ends with a `**Verify:**` line that `/amby.implement` runs before the checkpoint.

## Phase 1 — Setup

- [x] [T001] [P] Add the optional `trace` config section (`roots`, `ignore`) to the schema and `AmbyConfig` type
  ```yaml
  files: ["src/core/config.ts", "src/core/types.ts"]
  ```
- [x] [T002] [P] Add a trace fixture helper that builds a temp project with specs, test files and a `tests.md`
  ```yaml
  files: ["test/helpers/trace-fixture.ts"]
  ```
- [x] [T003] [P] Write the versioned JSON contract for `trace --json`
  ```yaml
  files: ["specs/024-trace/contracts/trace-json.md"]
  ```
```yaml
verify:
  check: "`npm run typecheck` passes with the new config field and the fixture helper compiles."
  result: passed
```

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Define the report types: requirement rows, test entries, orphans, uncited, ambiguous, coverage counts
  ```yaml
  files: ["src/core/trace-types.ts"]
  ```
- [x] [T011] [P] Parse `FR-###` lines with their text and `uncovered: FR-### — reason` notes, with unit tests
  ```yaml
  files: ["src/core/trace-requirements.ts", "test/core/trace-requirements.test.ts"]
  ```
- [x] [T012] [P] Parse a test title's citation prefix (`NNN:FR-###`, several IDs, bare IDs) with unit tests
  ```yaml
  files: ["src/core/trace-cite.ts", "test/core/trace-cite.test.ts"]
  ```
- [x] [T013] [P] Extract `it`/`test` titles and skip/todo state from test source text, with unit tests
  ```yaml
  files: ["src/core/trace-tests.ts", "test/core/trace-tests.test.ts"]
  ```
- [x] [T014] [P] Build the pure matrix: covered, uncovered, deliberate, skipped-only, orphan, uncited, ambiguous, with unit tests
  ```yaml
  files: ["src/core/trace.ts", "test/core/trace.test.ts"]
  ```
- [x] [T015] [P] Add the fs edge that walks the configured roots and reads test files and `tests.md` (parsed by 021's `parseTestDesign`), with tests
  ```yaml
  files: ["src/core/trace-io.ts", "test/core/trace-io.test.ts"]
  ```
- [x] [T016] Export the new core modules
  ```yaml
  files: ["src/core/index.ts"]
  ```
```yaml
verify:
  check: "`npx vitest run test/core/trace` and `npm run typecheck` both pass."
  result: passed
```
- **Checkpoint:** the matrix can be built from fixtures without any CLI.

## Phase 3 — User stories US-1 and US-2  (priority: P1)

- [x] [T020] [US1] Add `TraceCommand` (`ambykit trace [feature]`) printing covered, uncovered, orphans and uncited as plain text
  ```yaml
  files: ["src/cli/trace.ts"]
  ```
- [x] [T021] [US1] Register the command so it appears in help and dispatch
  ```yaml
  files: ["src/cli/index.ts"]
  ```
- [x] [T022] [P] [US1] E2E: uncovered listed, orphans vs uncited, one feature vs all, feature with no requirements
  ```yaml
  files: ["test/cli/trace.test.ts"]
  ```
- [x] [T023] [P] [US2] E2E: multi-ID names, qualified IDs across features, bare ID ambiguous, legacy suffix tests uncited, skipped tests not covering
  ```yaml
  files: ["test/cli/trace-citation.test.ts"]
  ```
- [x] [T024] [P] [US2] Document `ambykit trace` and the one-section "Citing requirements" convention
  ```yaml
  files: ["docs/cli-reference.md"]
  ```
```yaml
verify:
  check: "`npx vitest run test/cli/trace.test.ts test/cli/trace-citation.test.ts` passes; `ambykit trace` on the fixture lists the uncovered requirement."
  result: passed
```
- **Checkpoint:** US-1 and US-2 are demoable.

## Phase 4 — User story US-5  (priority: P1)

- [x] [T030] [P] [US5] Make `/amby.converge` run `ambykit trace <feature> --json` first, then read `tests.md`, cite gaps as `(closes NNN:FR-###)`, and work as today if trace cannot run
  ```yaml
  files: ["src/prompts/converge.md"]
  ```
- [x] [T031] [P] [US5] BATCH 0 FOUNDATION (build first; specs 019 and 021 depend on it): generalize Claude's scoped shell grant from `ambykit activity` to any `ambykit <verb>` a prompt invokes
  ```yaml
  files: ["src/emitters/claude.ts"]
  ```
- [x] [T032] [US5] Update the emitter tests for converge's tools and body
  ```yaml
  files: ["test/activity-emit.test.ts", "test/converge-emit.test.ts"]
  ```
- [x] [T033] [US5] INTEGRATION STEP (once per batch after merges, not in the lane branch): re-record the emitter golden fixtures with `UPDATE_GOLDEN=1 npx vitest run test/emitters-golden.test.ts`
  ```yaml
  files: ["test/fixtures/emitters-golden/"]
  ```
- [x] [T034] [US5] INTEGRATION STEP (once per batch after merges, not in the lane branch): run `ambykit sync` and confirm a second run produces no diff
  ```yaml
  files: [".claude/commands/", ".agents/skills/"]
  ```
- [x] [T035] [P] [US5] Note in the workflow guide that converge starts from the trace matrix
  ```yaml
  files: ["docs/workflow.md"]
  ```
```yaml
verify:
  check: "`npx vitest run test/converge-emit.test.ts test/activity-emit.test.ts test/emitters-golden.test.ts` passes and `ambykit sync` a second time leaves `git status` unchanged."
  result: passed
```
- **Checkpoint:** US-5 is demoable.

## Phase 5 — User story US-7  (priority: P1)

- [x] [T040] [P] [US7] Prove `trace` never writes: spec and test files unchanged after a run
  ```yaml
  files: ["test/cli/trace-readonly.test.ts"]
  ```
- [x] [T041] [P] [US7] Prove existing commands are unchanged on a project that never runs `trace`
  ```yaml
  files: ["test/cli/trace-additive.test.ts"]
  ```
```yaml
verify:
  check: "`npx vitest run test/cli/trace-readonly.test.ts test/cli/trace-additive.test.ts` passes."
  result: passed
```
- **Checkpoint:** US-7 is demoable; 1.x stays additive.

## Phase 6 — User story US-3  (priority: P2)

- [x] [T050] [P] [US3] Add `--json` (versioned shape) and `--gate` (exit 1 on uncovered, else 0) to the command
  ```yaml
  files: ["src/cli/trace.ts"]
  ```
- [x] [T051] [P] [US3] Read `uncovered: FR-### — reason` notes (and 021's section form) from `tests.md` through 021's `parseTestDesign`, falling back to `spec.md`, and exclude them from the gate; builds after 021 T010 ↪ DEVIATION: read through parseDeliberate (021 grammar), applied in readTraceSources
  ```yaml
  files: ["src/core/trace-io.ts"]
  ```
- [x] [T052] [P] [US3] E2E: JSON shape, gate exit codes, no gate exits zero, deliberate-uncovered not counted
  ```yaml
  files: ["test/cli/trace-json-gate.test.ts"]
  ```
- [x] [T053] [P] [US3] Document `--json`, `--gate` and the deliberate-uncovered note
  ```yaml
  files: ["docs/cli-reference.md"]
  ```
```yaml
verify:
  check: "`npx vitest run test/cli/trace-json-gate.test.ts` passes and the JSON output parses against the contract."
  result: passed
```
- **Checkpoint:** US-3 is demoable.

## Phase 7 — User story US-4  (priority: P2)

- [x] [T060] [US4] Keep each spec's requirements on the feature snapshot and add the optional `coverage` field to `FeatureRow` ↪ DEVIATION: snapshot keeps only a coverage figure plus its uncovered list, not the raw requirements
  ```yaml
  files: ["src/core/features.ts", "src/core/overview-types.ts"]
  ```
- [x] [T061] [US4] Compute per-feature coverage in the overview, absent when a feature has no requirements
  ```yaml
  files: ["src/core/overview.ts"]
  ```
- [x] [T062] [US4] Run one trace scan in the project read and attach coverage to each feature ↪ DEVIATION: scan lives in src/core/trace-coverage.ts, called from readProjectFeatures
  ```yaml
  files: ["src/core/checkouts.ts"]
  ```
- [x] [T063] [US4] Include coverage in the `--json --overview` output
  ```yaml
  files: ["src/cli/dashboard.ts"]
  ```
- [x] [T064] [P] [US4] Render `cov n/m` next to task progress in the overview and feature view, readable in plain text
  ```yaml
  files: ["src/cli/ui/dashboard/render-overview.ts", "src/cli/ui/dashboard/feature-view.ts"]
  ```
- [x] [T065] [P] [US4] Add the quality view renderer: uncovered requirements and `analyze` findings
  ```yaml
  files: ["src/cli/ui/dashboard/quality-view.ts"]
  ```
- [x] [T066] [US4] Add the interactive key and help entry for the quality view; verify the key is free against help-overlay.ts at build time (023 uses `g`, 029 uses `l`) ↪ DEVIATION: key c opens the quality view; tests/ui/interactive-overview hint line updated
  ```yaml
  files: ["src/cli/ui/interactive/overview.ts", "src/cli/ui/dashboard/help-overlay.ts"]
  ```
- [x] [T067] [P] [US4] Tests: coverage figure, zero-test feature, narrow and plain terminals, stable JSON
  ```yaml
  files: ["test/cli/dashboard-trace.test.ts"]
  ```
- [x] [T068] [P] [US4] Performance: 200 test files and 30 features stay under one second
  ```yaml
  files: ["test/cli/trace-perf.test.ts"]
  ```
```yaml
verify:
  check: "`npx vitest run test/cli/dashboard-trace.test.ts test/cli/trace-perf.test.ts test/cli/dashboard-perf.test.ts` passes."
  result: passed
```
- **Checkpoint:** US-4 is demoable.

## Phase 8 — User story US-6  (priority: P3)

- [x] [T070] [US6] Read designed cases from `tests.md` in spec 021's format (`- [TC-###] [US-n#k] [FR-###] auto|manual:… — name`) through 021's `parseTestDesign`, one isolated module, with unit tests; builds after 021 T010
  ```yaml
  files: ["src/core/trace-design.ts", "test/core/trace-design.test.ts"]
  ```
- [x] [T071] [US6] Report designed automated cases as matched or missing and manual cases as manual; requirement-only output when there is no design
  ```yaml
  files: ["src/core/trace.ts", "src/cli/trace.ts"]
  ```
- [x] [T072] [US6] E2E: matched, missing, manual, and no-design identical output
  ```yaml
  files: ["test/cli/trace-design.test.ts"]
  ```
```yaml
verify:
  check: "`npx vitest run test/core/trace-design.test.ts test/cli/trace-design.test.ts` passes."
  result: passed
```
- **Checkpoint:** US-6 is demoable.

## Phase 9 — Polish

- [x] [T090] Run `ambykit trace 024` on this repo and rename any 024 test missing its qualified ID until every FR is covered ↪ DEVIATION: no rename needed: all 21 FRs were cited from the start
  ```yaml
  files: ["test/cli/", "test/core/"]
  ```
- [x] [T091] [P] Record this repo's coverage baseline: covered, uncovered and uncited counts
  ```yaml
  files: ["specs/024-trace/baseline.md"]
  ```
- [x] [T092] [P] Add the 1.5 changelog entry
  ```yaml
  files: ["CHANGELOG.md"]
  ```
- [x] [T093] [P] Add `trace` to the CLI list in the project structure; spec 028 T122 edits the same `src/cli/` line, so whichever lands second rewrites the line
  ```yaml
  files: ["AGENTS.md"]
  ```
- [x] [T094] INTEGRATION STEP (once per batch after merges): run `npm run typecheck`, `npm test` and `ambykit sync`, and confirm no diff; verification only, package.json is unchanged ↪ DEVIATION: release/1.4.0 also bumps package.json to 1.4.0
  ```yaml
  files: [".claude/commands/", ".agents/skills/"]
  ```
```yaml
verify:
  check: "`ambykit trace 024` reports full coverage and `npm run typecheck && npm test` pass."
  result: passed
```
- **Checkpoint:** feature 024 is traced by itself (the 1.5 gate).
