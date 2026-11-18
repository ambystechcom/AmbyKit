---
feature: 030-spec-v2-and-migrate
created: 2026-11-18
---

# Tasks — Spec format v2 and migrate

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes. **Extra gates:** (1) Phase 2 changes no behavior: the
> Phase 1 baseline and the whole existing suite must stay identical before Phase 3 starts; (2) the v1 form of every fixture
> and its v2 twin must give the same model before Phase 5 starts (Phase 3 and 4 checkpoints); (3) person tasks T090 and T091
> (release maintainer, assistant trial) and the integration batch T092-T094, then the dogfood T095, come last.
> Dependencies: spec 026 (`@../026-spec-format-v2-spike/decision.md`, cite `026:D-#`), 023 graph (US-9), 025 MCP tick and status
> (FR-018), 015/020 lanes and Verify. Tests start their title with the qualified id: `030:FR-###: …`.
> Story order: US-1 → US-2 → (US-3, US-4, US-5 migrate; US-7, US-8; US-10; US-9 in lanes) → US-6 → US-11.
> Within a phase, tasks run in file order unless marked `[P]` (disjoint files, no sibling dependency).
> **Lanes:** Phase 5 is the only parallel phase: ten `[P]` tasks with disjoint files, planned as
> `ambykit lane 030-spec-v2-and-migrate --phase=5 --lanes=4` (migrate modules / config + Node 22 / writer + parity / graph).
> Anything that composes their output (registering commands, `src/cli/index.ts`, `BaseCommand`, `src/core/features.ts`, docs,
> `AGENTS.md`) is a sequential Phase 6+ task. Integration steps (goldens, `ambykit sync`, dogfood migrate) are never done in a lane.
> Record each phase's Verify result after its lanes are merged. When spec 028 is merged, its readers (`src/core/fleet/run-*.ts`,
> `src/core/lane-merge.ts`, `src/cli/run.ts`) must be routed through the dispatcher; the guard test T016 fails until they are.

## Phase 1 — Setup  (baselines and fixtures)

- [x] [T001] Port the spike fixtures into the repo: edge-rich v1 and v2 twins (phase and task layouts), the malformed set and the unsafe-spec set from `spikes/026-spec-format-v2/fixtures` and `results/us2-skips.txt` (test/fixtures/spec-format/) ↪ DEVIATION: the unsafe set is built in code (test/helpers/spec-project.ts UNSAFE) because git autocrlf rewrites BOMs and mixed line endings in files
- [x] [T002] [P] Baseline of the shipped parsers: generator helper and a committed model of every `specs/*/{spec,tasks}.md` (stories, tasks with paths, phases with Verify), plus a test that the shipped parsers still produce it (test/helpers/spec-model.ts, test/fixtures/spec-model-v1.json, test/core/spec-model-baseline.test.ts)
- [x] [T003] [P] Baseline of command output on the repo's own specs: `dashboard --json --overview` and `analyze --json` captured once, compared with unchanged-output rules of 020 (test/fixtures/unchanged-output-030.json, test/cli/unchanged-output-030.test.ts)
- [x] [T004] [P] Test helpers: temp-project builder from fixtures and `withMigratedCopy` (calls the migrate API once it exists) (test/helpers/spec-project.ts)
- **Verify:** `npx vitest run test/core/spec-model-baseline.test.ts test/cli/unchanged-output-030.test.ts` passes on the unmodified code, and the fixture folders hold the edge-rich, malformed and unsafe sets. ✓ passed
- **Checkpoint:** baselines committed; nothing in `src/` changed.

## Phase 2 — Foundational  (dispatcher with v1 behavior only; blocks all story work)

- [x] [T010] Result types and `FormatIssue {file,line,kind,message}`; re-export `StoryProgress`, `TaskLine`, `PhaseVerify` as the one model (src/core/spec-format/model.ts)
- [x] [T011] [P] Frontmatter splitter and YAML parse with 1-based line numbers, using the existing `gray-matter` YAML engine; unclosed or unparseable frontmatter yields an issue, never a throw (src/core/spec-format/frontmatter.ts, test/core/spec-format-frontmatter.test.ts)
- [x] [T012] [P] `detectSpecFormat` and `detectTasksFormat` per C-1 and FR-019: `format: 2`, story data without marker, ours-fence in tasks (src/core/spec-format/detect.ts, test/core/spec-format-detect.test.ts)
- [x] [T013] Dispatcher `readSpec`, `readTasks`, `readPhases` that for now delegate to the v1 parsers and return `{format:1, issues:[]}`, with a tally hook for later (src/core/spec-format/dispatch.ts, test/core/spec-format-dispatch.test.ts)
- [x] [T014] [P] Route the readers through the dispatcher without changing output: features, checkouts, dashboard compute, burndown history blobs, lane `git show` reads, dashboard CLI, fleet flow input and run flow, lane merge helpers (src/core/features.ts, src/core/checkouts.ts, src/core/dashboard.ts, src/core/burndown.ts, src/cli/lane.ts, src/cli/dashboard.ts, src/core/fleet/flow-input.ts, src/core/fleet/run-flow.ts, src/core/lanes.ts)
- [x] [T015] [P] Route the MCP read and edit helpers through the dispatcher, same signatures and JSON shapes (src/core/tasks-edit.ts, src/core/query.ts)
- [x] [T016] Guard test: no module outside `src/core/spec-format/` and the v1 parser files imports `parseStories`, `parseTasks` or `parsePhases` directly — 030:FR-021 (test/core/spec-format-guard.test.ts)
- **Verify:** `npm run typecheck && npm test` pass with no snapshot or baseline change, `node dist/cli/index.js analyze` prints exactly what it printed before Phase 2, and the guard test passes. ✓ passed
- **Checkpoint:** every reader goes through one dispatcher; behavior unchanged.

## Phase 3 — US-1 v2 spec reader

- [x] [T020] [US1] `readSpecV2`: `stories:` to `StoryProgress` (id, priority, status, depends-on, blocked-by), titles from the headings, feature-level `depends-on`, any-string status with a warning on unknown values, located errors for broken YAML, non-list dependencies and unknown fields, structured-wins with a disagreement warning (stale `(priority: Pn)`), story data without `format: 2` read as v2 with a warning (src/core/spec-format/read-spec.ts)
- [x] [T021] [US1] Tests: edge-rich v1 and v2 give equal models; each malformed fixture gives file, line and problem; broken YAML under `stories:` is an error and not a v1 fallback; unusual status warns; disagreement reported — 030:FR-001, FR-003, FR-004, FR-019 (test/core/spec-format-read-spec.test.ts)
- [x] [T022] [US1] Dispatcher uses `readSpecV2` when detected; `analyze` lists `FormatIssue`s (errors exit 1, warnings never change the exit) and adds an additive `formatIssues` key to `--json`, absent when empty (src/core/spec-format/dispatch.ts, src/core/analyze.ts, src/cli/analyze.ts)
- [x] [T023] [US1] Tests: `analyze` text and `--json` show the issues; a 1.x-only project's output is unchanged — 030:FR-003, FR-018 (test/cli/analyze-format.test.ts)
- **Verify:** `npx vitest run test/core/spec-format-read-spec.test.ts test/cli/analyze-format.test.ts test/cli/unchanged-output-030.test.ts` passes. ✓ passed
- **Checkpoint:** v2 specs read; 1.x output unchanged.

## Phase 4 — US-2 v2 task reader

- [x] [T030] [US2] `scanBlocks` and `readTasksV2`: per-phase fences (and per-task fences) with top-level `files` and `verify` only; `files` to `paths` and `pathIssue` (absent or `[]` reads `missing`, glob reads `glob`); `verify` to `PhaseVerify` with `passed|failed|unverified` and `why`; foreign fences ignored; mixed-key fences and unclosed or detached blocks are located errors; markers stay on the task line (src/core/spec-format/read-tasks.ts)
- [x] [T031] [US2] Tests: edge-rich v1 and both v2 layouts give equal tasks and phases; malformed task fixtures give located errors; absent files is `missing`; two tasks owning one file give the same lane conflict as 1.x; BLOCKED and DEVIATION unchanged — 030:FR-002, FR-003 (test/core/spec-format-read-tasks.test.ts)
- [x] [T032] [US2] Dispatcher uses `readTasksV2` and `readPhases` for v2; lane declarations and conflicts, manifest drift and check-off merge read through it (src/core/spec-format/dispatch.ts, test/core/spec-format-lane-parity.test.ts)
- [x] [T033] [US2] Test: the latest Verify result drives `verifyIssues` and the dashboard exactly as in 020 for a v2 phase, including a failed then passed sequence — 030:FR-002 (test/cli/verify-v2.test.ts)
- **Verify:** `npx vitest run test/core/spec-format-read-tasks.test.ts test/core/spec-format-lane-parity.test.ts test/cli/verify-v2.test.ts` passes and the whole suite still passes. ✓ passed
- **Checkpoint:** both formats read to the same model on every fixture.

## Phase 5 — Parallel lanes: independent modules  (US-3, US-4, US-7, US-8, US-9, US-10)

- [x] [T040] [P] [US3] Migrate safety: scan for the FR-006 unsafe cases (prose metadata, duplicate or conflicting bullets, markup in a code fence, mixed EOL, BOM, two Verify lines, repeated task id), content hash, model read-back equality — 030:FR-006, FR-024, SC-010 (src/core/migrate/safety.ts, test/core/migrate-safety.test.ts)
- [x] [T041] [P] [US3] Convert a 1.x spec to v2 text: move status, priority, depends-on and blocked-by into `stories:`, add `format: 2`, minimal frontmatter when missing, strip `(priority: Pn)` from headings and report each strip, keep every other byte and the file's line endings, optional dual-write — 030:FR-005, FR-023 (src/core/migrate/convert-spec.ts, test/core/migrate-convert-spec.test.ts)
- [ ] [T042] [P] [US3] Convert 1.x tasks to v2 text: drop the trailing group into the phase block's `files`, move the Verify line into `verify` with its result and why, add `format: 2`, keep checkboxes, markers and prose, optional dual-write — 030:FR-005, FR-023 (src/core/migrate/convert-tasks.ts, test/core/migrate-convert-tasks.test.ts)
- [ ] [T043] [P] [US4] Summary and unified-diff text: per file converted with lines added and removed, unchanged, skipped with reason and the fix needed, per-feature and total lines — 030:FR-008, FR-007 (src/core/migrate/summary.ts, test/core/migrate-summary.test.ts)
- [x] [T044] [P] [US7] Config schema: `schemaVersion` optional key in the zod schema, pure `upgradeConfig` preserving unknown fields, newer-version and unparseable guards that never write — 030:FR-014 (src/core/config-schema.ts, src/core/types.ts, test/core/config-schema.test.ts)
- [x] [T045] [P] [US8] Pure `checkNode(version)` returning the message when below 22 — 030:FR-015 (src/cli/node-guard.ts, test/cli/node-guard.test.ts)
- [ ] [T046] [P] [US8] `engines` to `>=22` and the CI workflow: drop the Node 20 steps, keep a step that a Node 20 run exits with the required-version message (package.json, .github/workflows/ci.yml)
- [ ] [T047] [P] [US10] Format-aware targeted edits with read-back and restore: set task files, set phase Verify result with why, set story status in the frontmatter, in v2; the same three in the 1.x form (trailing group, result suffix, status bullet) — 030:FR-020 (src/core/spec-format/write.ts, test/core/spec-format-write.test.ts)
- [x] [T048] [P] [US10] Hand-made v1 and v2 twin projects and the MCP parity test: `next_task`, `story_status`, `lane_tasks`, `analyze_report` equal on twins — 030:FR-018 (test/fixtures/spec-format-twins/, test/mcp-parity-030.test.ts)
- [x] [T049] [P] [US9] Feature-level `dependsOn` on the snapshot, declared feature edges in `buildGraph` (additive `declared`), `unknown-feature` broken edge, text and Mermaid and JSON output additive, graph `version` stays 1 — 030:FR-016 (src/core/overview-types.ts, src/core/graph-types.ts, src/core/graph.ts, src/core/graph-format.ts, test/core/graph-declared.test.ts)
- **Verify:** after the lanes are merged, `npm run typecheck && npm test` pass and `node dist/cli/index.js analyze` reports no lane conflicts for 030.
- **Checkpoint:** all independent modules exist and are unit-tested; nothing is registered or wired yet.

## Phase 6 — Composition and legacy handling  (sequential, after the lanes merge)

- [ ] [T050] [US3] Migrate run: plan per feature in the current checkout only, skip v2 files, scan, convert, read back, compare hash, write temp file in the same directory then rename, no temp file on `--dry-run`, dirty-tree warning naming files, config upgrade at the end, summary — 030:FR-005, FR-007, FR-009, FR-010, FR-011, FR-014, FR-024 (src/core/migrate/run.ts)
- [ ] [T051] [US3] `MigrateCommand`: feature argument, `--dry-run`, `--diff`, `--dual-write`, the 1.x-tools-lose-data sentence — 030:FR-007, FR-025 (src/cli/migrate.ts)
- [ ] [T052] [US5] Migrate end to end tests: unsafe set skipped and byte-identical, rerun changes nothing, dry-run leaves the tree hash identical and no temp file, interrupted write (injected failing rename) then rerun, file edited between read and write, read-back mismatch (injected converter bug), other worktrees untouched — 030:FR-006, FR-009, FR-010, FR-024, SC-002, SC-004, SC-010 (test/cli/migrate.test.ts, test/cli/migrate-safety-e2e.test.ts)
- [ ] [T053] [US10] `tasks-edit.ts`: `setStoryStatus` delegates to the writer for v2 and keeps its signature and JSON shape; `tickTask` unchanged; MCP tick and status tests on twins — 030:FR-018, FR-020 (src/core/tasks-edit.ts, test/core/tasks-edit-v2.test.ts)
- [ ] [T054] [US10] `EditCommand`: `edit files <feature> <T###> <path…>`, `edit verify <feature> <phase> --result=… [--why=…]`, `edit status <feature> <US-#> <status>`, one-line output, refusals per FR-020 — 030:FR-020 (src/cli/edit.ts, test/cli/edit.test.ts)
- [ ] [T055] Split the entry: `src/cli/index.ts` becomes the Node guard launcher that imports `main.js` only after the check, `main.ts` holds the former registry and exports `main`; register `migrate` and `edit`; `test/cli/help-warning.test.ts` keeps importing `main` from `index.js` — 030:FR-015 (src/cli/index.ts, src/cli/main.ts)
- [ ] [T056] [US9] Populate the snapshot's feature-level `dependsOn` from the v2 frontmatter and surface unknown features in `analyze`; a 1.x feature has none — 030:FR-016 (src/core/features.ts, test/core/graph-declared-e2e.test.ts)
- [ ] [T057] [US6] Legacy handling: tally of 1.x files, `legacyEnabled` from config and environment, the one-line warning, `refuseLegacy` for 2.1 with an injected version, never in `--json` — 030:FR-012, FR-013 (src/core/spec-format/legacy.ts, test/core/spec-format-legacy.test.ts)
- [ ] [T058] [US6] `BaseCommand` hook prints the warning once per run to stderr; `check` lists features still on 1.x as a notice with the exit status unchanged; dispatcher returns `legacy-format-refused` at 2.1 — 030:FR-012, FR-013, FR-019 (src/cli/base-command.ts, src/cli/check.ts, src/core/spec-format/dispatch.ts, test/cli/legacy-warning.test.ts)
- [ ] [T059] [US5] Parity on the repo's own specs: migrate a temp copy, equal model for every spec and tasks file (SC-001), equal `dashboard`, `analyze`, lane planning and check-off merge, tick and status (SC-003), mixed project with one warning (SC-005) — 030:FR-018, SC-001, SC-003, SC-005 (test/parity-030.test.ts)
- [ ] [T060] [US5] Performance and history: dashboard one-shot on the migrated copy within 1 s with numbers recorded, and burndown and lane reads of a repository whose old revision is 1.x and head is v2 — 030:FR-021, FR-022, SC-008 (test/perf-dashboard-v2.test.ts, test/history-mixed-030.test.ts, specs/030-spec-v2-and-migrate/notes.md)
- **Verify:** `npm run typecheck && npm test` pass; `node dist/cli/index.js migrate --dry-run` on this repo writes nothing and reports 0 skipped; a Node 20 run prints the required-version message.
- **Checkpoint:** reader, migrate, writer, config, Node guard and legacy handling work together.

## Phase 7 — US-11 prompts and templates  (disjoint files, sequential tests last)

- [ ] [T070] [P] [US11] Templates to v2: spec with `format: 2` and `stories:` and no metadata bullets or priority in headings; tasks with `format: 2`, no trailing group and one block per phase (src/templates/spec.md, src/templates/tasks.md)
- [ ] [T071] [P] [US11] `/amby.specify` writes `stories:` and sets `status: draft`; `/amby.tasks` writes tasks without the group and one block per phase with the Verify check in `verify.check` (src/prompts/specify.md, src/prompts/tasks.md)
- [ ] [T072] [P] [US11] `/amby.implement` ticks the checkbox and uses `ambykit edit status` and `ambykit edit verify` for status and Verify results, then runs `ambykit analyze` and fixes any `file:line` error (src/prompts/implement.md)
- [ ] [T073] [P] [US11] `/amby.revise` and `/amby.converge` change `status:` and append gap tasks through the same carriers and keep untouched sections as they were (src/prompts/revise.md, src/prompts/converge.md)
- [ ] [T074] [P] [US11] `/amby.run` and the worker persona record Verify results and statuses through the writer (src/prompts/run.md, src/agents/worker.md)
- [ ] [T075] [US11] Prompt contract tests: the pinned sentences, each prompt under its size cap, no prompt tells the assistant to edit a block by hand — 030:FR-017 (test/prompts-030.test.ts)
- **Verify:** `npx vitest run test/prompts-030.test.ts test/prompts-020.test.ts test/prompts-021.test.ts test/templates` passes (golden snapshots stay failing until the integration batch).
- **Checkpoint:** new features start in v2; prompts use the writer.

## Phase 8 — Docs and polish

- [ ] [T080] [US3] Artifact docs for the v2 format (carriers, per-phase block, marker, writer) (docs/artifacts/spec.md, docs/artifacts/tasks.md)
- [ ] [T081] [P] [US3] Migration guide: dry run, skips and fixes, dual-write, 1.x tools lose data on v2 files, support ends in 2.1 — 030:FR-025 (docs/migration.md)
- [ ] [T082] [US3] CLI reference and workflow docs, README and the site CLI page for `migrate` and `edit`, and the `AGENTS.md` structure line (docs/cli-reference.md, docs/workflow.md, README.md, site/src/content/docs/cli/index.mdx, AGENTS.md)
- [ ] [T083] [US6] Changelog 2.0 entry (breaking format, Node 22, config schema version, "Plugins: not affected") and the release-checklist line for the 2.1 gate (CHANGELOG.md, docs/contributing.md)
- **Verify:** `node scripts/check-docs-sync.mjs` passes and `npm run typecheck && npm test` pass apart from the golden snapshots.
- **Checkpoint:** docs match the code.

## Phase 9 — Release gates  (person tasks, integration batch, dogfood; last)

- [ ] [T090] PERSON: confirm with the release maintainer the 2.1 gate wording and that CI drops Node 20; record the answer (specs/030-spec-v2-and-migrate/notes.md)
- [ ] [T091] [US11] PERSON: assistant trial for SC-009: run one phase of a v2 feature on two assistants, check no file is left unreadable and every update used the writer or a checkbox, record the result (specs/030-spec-v2-and-migrate/notes.md)
- [ ] [T092] INTEGRATION STEP (once per batch, after merges, not in a lane branch): re-record the emitter golden fixtures with `UPDATE_GOLDEN=1 npx vitest run test/emitters-golden.test.ts` and review that only the prompts and templates of Phase 7 changed (test/fixtures/emitters-golden/)
- [ ] [T093] INTEGRATION STEP (once per batch, after merges, not in a lane branch): `ambykit sync` twice, the second a no-op (.claude/, .agents/, .amby/templates/)
- [ ] [T094] INTEGRATION STEP (once per batch, after merges): `npm run typecheck`, `npm test`, `node scripts/check-docs-sync.mjs`, `ambykit sync --check` and `ambykit trace 030` (every FR covered, SC-006) all pass; record the Verify results of Phases 5 to 8 (specs/030-spec-v2-and-migrate/tasks.md)
- [ ] [T095] DOGFOOD GATE (SC-001, SC-002, SC-007, last commit only, after 031 and 032 and every pending spec are merged): `ambykit migrate --dry-run`, then `ambykit migrate` on AmbyKit's own `specs/`, second run a no-op, full suite and `analyze` on the migrated tree (specs/)
- **Verify:** `ambykit migrate` on the repo reports 0 skipped and a second run reports 0 changes, `npm test` passes on the migrated tree, and the T091 trial result is recorded.
- **Checkpoint:** the 2.0 spec-format gate is met.
