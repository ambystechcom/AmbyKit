---
feature: 035-drop-1x-reading
created: 2026-11-25
---

# Tasks — Drop reading of 1.x specs

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes. **Extra gates:** (1) this feature is 2.1 work: nothing past Phase 1
> starts before 2.0 (034) is released, except T021 if the owner answers D-8 "yes"; (2) Phases 3 to 8 wait for the go decision,
> T012 (FR-001, SC-001); (3) a task marked **PERSON** is not done by an assistant.
> Tests name what they cover as `035:FR-###`. Story order: US-1 → US-2 → US-3 → US-4 → US-5.
> Written in the 1.x task format on purpose: the repo's own specs migrate last (030 T095). After that, this file is migrated with them.
> `tests.md` is not written yet: `spec.md` is still `status: draft`. Write it with `/amby.tasks` after T002 sets the spec ready.

## Phase 1 — Setup

- [ ] [T001] Research: (a) split `parseStories`/`parseTasks`/`parsePhases` into the parts the v2 readers use and the 1.x-only parts; (b) list every test file and fixture helper that writes 1.x text, grouped by helper; (c) how burndown, lane and metrics read history today; (d) record the 2.0 timings of dashboard one-shot and `--json` and of the full suite (specs/035-drop-1x-reading/research.md)
- [ ] [T002] PERSON: answer D-1 to D-8 from the plan (gate wording with 030 T090, history readers, refusal target, env var, dual-write, adoption window, exit code, switch before 2.0); record them with `/amby.revise` in `spec.md`, reword FR-007/US-3/SC-003 if D-2 changes them, set `status: ready` (specs/035-drop-1x-reading/spec.md)
- **Verify:** `research.md` has the four inventories and the timing baseline; `spec.md` records D-1 to D-8 and is `status: ready`.

## Phase 2 — User story US-1  (priority: P1)  — the go decision

- [ ] [T010] [US1] Draft the decision record with `/amby.decide`: "End 1.x reading in 2.1", `status: proposed`, one row per condition (gate wording, adoption window, no open `migrate` data-loss defect, documented path) with empty date and evidence, evidence limited to public sources — 035:FR-001, FR-003 (.amby/decisions/)
- [ ] [T011] [US1] Decision test: the ADR exists, cites 035, has the four condition rows; `LEGACY_READING` may be `"off"` only when the ADR is `accepted` and every row has a date, a met result and evidence; and no source file under `src/` calls a telemetry or usage endpoint — 035:FR-001, FR-002, FR-003 (test/release/legacy-decision.test.ts)
- [ ] [T012] PERSON: collect the evidence (npm download counts, open and closed `migrate` issues, known projects), fill each row with date and source, and accept the ADR, or record "not met" and stop here (FR-002) — 035:FR-001, FR-002, FR-003 (.amby/decisions/)
- **Checkpoint:** US-1 is done when the ADR is accepted. If any condition is not met, 035 stops and the 2.0 notice stays.
- **Verify:** `npx vitest run test/release/legacy-decision.test.ts` passes. ? unverified: T012 is a person task.

## Phase 3 — Foundational  (blocks all feature work)

- [ ] [T020] `migrate`'s own 1.x reader: move the 1.x-only parsing (heading priority, story bullets, the task-line `(paths)` group, plain `**Verify:**` lines and result glyphs) and `readSpecV1`/`readTasksV1` into one module; `migrate/safety.ts` imports it; the shared line parsing stays in `dashboard.ts`/`markers.ts` for the v2 readers — 035:FR-009 (src/core/migrate/v1-reader.ts, src/core/migrate/safety.ts, src/core/spec-format/dispatch.ts, src/core/dashboard.ts, src/core/markers.ts, test/core/migrate-v1-reader.test.ts)
- [ ] [T021] Explicit switch: replace `REFUSE_FROM`/`refuseLegacy(version)` with `LEGACY_READING = "on"`; the dispatcher refuses only when it is `"off"`; a test pins `"on"` until T080 — 035:FR-002 (src/core/spec-format/legacy.ts, src/core/spec-format/dispatch.ts, test/core/spec-format-legacy.test.ts)
- [ ] [T022] `findLegacyFiles(root)`: every 1.x `spec.md`/`tasks.md` under `specs/` in the main checkout and its worktrees, by the existing `detect*`, grouped by feature, read once and handed to the caller so readers do not read again — 035:FR-004, FR-005, FR-011 (src/core/spec-format/legacy-scan.ts, test/core/legacy-scan.test.ts)
- [ ] [T023] Test helper `asV2(text)`: converts a 1.x spec or task list with `migrate`'s converters, for tests that hold inline 1.x literals — 035:FR-008 (test/helpers/as-v2.ts, test/helpers/as-v2.test.ts)
- **Verify:** `npm run typecheck` and `npm test` pass with the switch `"on"` (2.0 behaviour unchanged); the migrate tests pass on the moved reader.

## Phase 4 — User story US-2  (priority: P1)

- [ ] [T030] [US2] Preflight in `BaseCommand.run`: when the switch is `"off"` and the command reads specs, call `findLegacyFiles` before `execute()`; one message naming every 1.x file, grouped by feature, saying 1.x is no longer read and giving `ambykit migrate --dry-run` then `ambykit migrate`; exit 1 (D-7), nothing on stdout; `--json` prints the error object; a `readsSpecs` getter exempts `migrate`, `init`, `sync`, `update`, `add`, `restore` — 035:FR-004, FR-005 (src/cli/base-command.ts, src/cli/migrate.ts, src/cli/init.ts, src/cli/sync.ts, src/cli/update.ts, src/cli/add.ts, src/cli/restore.ts)
- [ ] [T031] [US2] Refusal text: `legacyRefusedMessage` and the preflight message point to `ambykit migrate` of this version, not to 2.0 (D-3) — 035:FR-004 (src/core/spec-format/legacy.ts)
- [ ] [T032] [US2] MCP: the server stays up; each tool that reads a spec returns the same refusal as an error result — 035:FR-004 (src/cli/mcp.ts, src/core/query.ts, test/mcp-legacy-refused.test.ts)
- [ ] [T033] [US2] Refusal tests with the switch forced `"off"`: a 1.x project for `analyze`, `check`, `dashboard`, `trace`, `edit`, `run --preview`; a mixed project (one message, every 1.x feature listed, no v2 feature processed); the tree hash is unchanged and stdout is empty; `--json` shape — 035:FR-004, FR-005 (test/cli/legacy-refused.test.ts)
- **Checkpoint:** US-2 is demoable: any command on a 1.x project stops with the migrate instructions and changes nothing.
- **Verify:** `npx vitest run test/cli/legacy-refused.test.ts test/mcp-legacy-refused.test.ts` passes.

## Phase 5 — User story US-3  (priority: P1)

- [ ] [T040] [US3] Remove the v1 branch of `readSpec`/`readTasks` (a 1.x file returns only the refusal issue), the tally, `printLegacyWarning`, `showsLegacyWarning`, `check`'s 1.x notice, `legacyEnabled`, `legacyWarningLine` and `AMBYKIT_LEGACY_WARNING` (D-4) — 035:FR-006 (src/core/spec-format/dispatch.ts, src/core/spec-format/legacy.ts, src/core/spec-format/model.ts, src/cli/base-command.ts, src/cli/check.ts, src/cli/mcp.ts, src/cli/migrate.ts)
- [ ] [T041] [US3] Config: `legacyWarning` stays accepted by the schema and is ignored with one notice per run naming the key — 035:FR-006 (src/core/config.ts, src/core/types.ts, test/core/config-legacy-key.test.ts)
- [ ] [T042] [US3] History readers per D-2: burndown skips and counts a 1.x revision instead of counting zero tasks; `lane` reports a 1.x branch as unreadable; metrics drops `HISTORY_VERSION` (or, if D-2 says keep history, all three read old revisions through `migrate`'s 1.x reader) — 035:FR-007 (src/core/burndown.ts, src/cli/lane.ts, src/core/metrics/model.ts, test/core/history-legacy.test.ts)
- [ ] [T043] [US3] Guard test: only `src/core/migrate/` imports the 1.x reader (plus the history readers if D-2 keeps history); no source file outside it parses heading priority, story bullets or Verify lines — 035:FR-006 (test/core/spec-format-guard.test.ts)
- [ ] [T044] [US3] Budget: dashboard one-shot and `--json` reuse the preflight's reads; compare with the 2.0 timings from T001 and record the numbers — 035:FR-011 (src/core/dashboard.ts, src/cli/dashboard.ts, specs/035-drop-1x-reading/research.md)
- **Checkpoint:** US-3 is done: the 1.x path is gone outside `migrate`.
- **Verify:** `npx vitest run test/core test/cli/dashboard-perf.test.ts test/cli/dashboard-fleet-perf.test.ts` passes and `research.md` records one-shot and `--json` no slower than 2.0.

## Phase 6 — User story US-4  (priority: P2)

- [ ] [T050] [US4] Snapshot `ambykit trace --json` for every feature before any test is deleted (SC-004 baseline) (specs/035-drop-1x-reading/trace-before.json)
- [ ] [T051] [US4] Convert the spec and task fixture helpers to write v2 (spec-project, tasks-fixture, trace-fixture, graph-fixtures, spec-model) — 035:FR-008 (test/helpers/spec-project.ts, test/helpers/tasks-fixture.ts, test/helpers/trace-fixture.ts, test/helpers/graph-fixtures.ts, test/helpers/spec-model.ts)
- [ ] [T052] [US4] Convert the dashboard and history fixture helpers to write v2 (dashboard-fixture, dashboard-perf-fixture, tabs-fixture, git-history-fixture, metrics-history, worktree-fixture, lane-fixture) — 035:FR-008 (test/helpers/dashboard-fixture.ts, test/helpers/dashboard-perf-fixture.ts, test/helpers/tabs-fixture.ts, test/helpers/git-history-fixture.ts, test/helpers/metrics-history.ts, test/helpers/worktree-fixture.ts, test/helpers/lane-fixture.ts)
- [ ] [T053] [US4] Convert the fleet and run fixture helpers to write v2 (fleet-fixture, fleet-loop-fixture, fleet-plan-fixture, fleet-run-fixture, fleet-e2e, run-1.6-fixture) — 035:FR-008 (test/helpers/fleet-fixture.ts, test/helpers/fleet-loop-fixture.ts, test/helpers/fleet-plan-fixture.ts, test/helpers/fleet-run-fixture.ts, test/helpers/fleet-e2e.ts, test/helpers/run-1.6-fixture.ts)
- [ ] [T054] [US4] Wrap the remaining inline 1.x literals in tests with `asV2`, file by file from the T001 inventory; tests about the format get literal v2 text — 035:FR-008 (test/)
- [ ] [T055] [US4] Delete the tests that only guard 1.x reading and list each in `research.md` with the FR it cited: `spec-model-baseline` + `spec-model-v1.json`, `tasks-baseline-020` + its fixture, `legacy-warning`, the 1.x halves of `spec-format-dispatch`, `spec-format-lane-parity`, `mcp-parity-030`, `spec-format-legacy`; turn `test/release/legacy-fixtures.test.ts` into "1.x fixtures are refused and `migrate` converts them" so 034:FR-006 keeps a test; 1.x fixtures stay only for that and for `migrate` — 035:FR-008 (test/core/, test/cli/, test/release/legacy-fixtures.test.ts, test/fixtures/, specs/035-drop-1x-reading/research.md)
- [ ] [T056] [US4] Compare `trace --json` after with T050: no requirement lost its only citing test (convert one first if it would); record the suite time against the 2.0 baseline — 035:FR-008 (specs/035-drop-1x-reading/research.md)
- **Checkpoint:** US-4 is done: the suite has no 1.x-guard tests and no FR lost coverage.
- **Verify:** `npm test` passes and the T056 comparison in `research.md` lists zero requirements that lost their last test.

## Phase 7 — User story US-5  (priority: P2)

- [ ] [T060] [US5] `migrate` end to end with the switch `"off"`: a 1.x fixture project, `--dry-run` changes nothing, `migrate` converts, a second run is a no-op, then `check` and `analyze` are clean; `--dual-write` kept (D-5) — 035:FR-009 (test/cli/migrate-2-1.test.ts)
- [ ] [T061] [P] [US5] The 1.x format reference: one page describing the 1.x spec and task format (story headings and bullets, task lines and their paths group, Verify lines and glyphs); `docs/artifacts/spec.md` and `tasks.md` describe v2 only and link it; a test checks the page exists, is linked from the migration guide and names each 1.x element — 035:FR-010 (docs/format-1x.md, docs/artifacts/spec.md, docs/artifacts/tasks.md, test/docs/format-1x.test.ts)
- [ ] [T062] [US5] Docs: migration guide Timeline (2.1 refuses 1.x and tells you to run `ambykit migrate`), CLI reference (the refusal, `legacyWarning` ignored), changelog `[Unreleased]` Breaking changes entry — 035:FR-004, FR-006, FR-010 (docs/migration.md, docs/cli-reference.md, CHANGELOG.md)
- **Checkpoint:** US-5 is done: a late upgrader can still migrate with 2.1.
- **Verify:** `npx vitest run test/cli/migrate-2-1.test.ts test/docs/format-1x.test.ts` and `node scripts/check-docs-sync.mjs` pass.

## Phase 8 — Release

- [ ] [T080] Flip `LEGACY_READING` to `"off"` and update the pinning test; T011's test now requires the accepted ADR — 035:FR-002 (src/core/spec-format/legacy.ts, test/core/spec-format-legacy.test.ts)
- [ ] [T081] INTEGRATION STEP (once per batch, after merges, not in a lane branch): re-record the emitter goldens with `UPDATE_GOLDEN=1 npx vitest run test/emitters-golden.test.ts`, then run `ambykit sync` twice; the second run is a no-op (test/fixtures/emitters-golden/, .claude/, .agents/, .github/)
- [ ] [T082] Full gate: `npm run typecheck`, `npm test`, `node scripts/check-docs-sync.mjs`, `ambykit analyze`, `ambykit trace 035` full coverage, and `ambykit check` on this repository (its own specs are v2 since 030 T095) (test/)
- [ ] [T083] PERSON: cut 2.1.0: release branch, version bump, changelog heading, GitHub Release; `publish.yml` publishes (docs/release.md)
- **Verify:** T082's commands pass on the release branch. ? unverified: T083 is a person task.
