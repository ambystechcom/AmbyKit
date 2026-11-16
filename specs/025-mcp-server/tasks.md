---
feature: 025-mcp-server
created: 2026-11-16
---

# Tasks — AmbyKit as an MCP server

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Each module task owns its tests. Each phase ends with a `**Verify:**` line the implementer runs before the checkpoint.
> **Batch B step 1: build before 019.** Tasks tagged `(batch B step 1)` form the fleet state foundation that
> 019, 028 and 029 import (`src/core/fleet/*`, the `fleet` config object, run record, directives, claims,
> notes, `laneStatus`). Build them first; 019 must not start before them. Spec 023 (`buildGraph`) builds
> before the stateful tools; 027 builds after this spec.
> Golden re-records and `ambykit sync` are INTEGRATION steps run once after merging the batch, never inside a lane.

## Phase 1 — Setup

- [x] [T001] Confirm the MCP protocol revision and stdio framing, and each target's MCP file, key, entry shape and scope from official docs; record sources, mark anything unconfirmed "not written" (specs/025-mcp-server/research.md)
- [x] [T002] Record the verified per-server entry shapes, scopes and consent notes in the compatibility matrix (docs/tool-compatibility.md)

**Verify:** research.md names the protocol revision and, for every built-in target, either its verified file, key, entry shape and source or "not written"; the matrix rows match research.md. ✓ passed

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] Add `mcp.enabled` and the single `fleet` config object (`stallMinutes` 15, `restartLimit` 2, `concurrency {total 3, perType 2}`, `roundLimit` 3, `tickSeconds`, `budgets`, `workerModel`) with defaults to the config schema and types; 028 extends it (batch B step 1), with tests (src/core/config.ts, src/core/types.ts, test/core/config.test.ts)
- [x] [T011] [P] Extend the activity marker with lane, state and run; lane-aware short file name; readers still accept today's names; with tests (src/core/activity.ts, test/core/activity.test.ts)
- [x] [T012] [P] Run record and fleet-dir helpers in the primary checkout: the `run.json` schema from data-model.md, `createRun` (explicit request only, as `<feature>.<n>`), `updateRun` and `resolveRun` (single unfinished run, or a warning naming several, or a warning when none; never an implicit run; no `adhoc`) (batch B step 1), with tests (src/core/fleet/runs.ts, src/core/fleet/types.ts, test/core/fleet-runs.test.ts)
- [x] [T013] [P] Lockfile and atomic temp-then-rename write helper with stale-lock recovery (batch B step 1), with tests (src/core/fleet/lock.ts, test/core/fleet-lock.test.ts)
- [x] [T014] [P] JSON-RPC 2.0 stdio framing and `initialize`, `ping`, `tools/list`, `tools/call` dispatch, with tests (src/mcp/protocol.ts, test/mcp/protocol.test.ts)
- [x] [T015] Tool registry: zod-validated inputs, published JSON schemas, uniform error and warning results, with tests (src/mcp/registry.ts, test/mcp/registry.test.ts)
- [x] [T016] `ambykit mcp` command serving the registry on stdio (stdout protocol-only), registered in the CLI, with a handshake test (src/mcp/server.ts, src/mcp/tools/index.ts, src/cli/mcp.ts, src/cli/index.ts, test/cli/mcp.test.ts)
- **Checkpoint:** an MCP client can initialize against `ambykit mcp` and list an empty tool set; old marker files still read.

**Verify:** `npm run typecheck` and `npx vitest run test/core test/mcp test/cli/mcp.test.ts` pass, and the existing activity and dashboard tests still pass unchanged. ✓ passed

## Phase 3 — User story US-1: ask for state, not files  (priority: P1)

- [ ] [T020] [US1] Query model: next unblocked task, story status with blockers, lane task slice, analyze slice, all capped; "unblocked" and blockers come from `buildable` and `blockersOf` of spec 023's `buildGraph` (023 builds first), with `analyzeGraph` kept only as the interim fallback inside this task; with tests incl. the SC-001 size bound (src/core/query.ts, test/core/query.test.ts)
- [ ] [T021] [US1] Read tools `next_task`, `story_status`, `lane_tasks`, `analyze_report` registered in the server, with tests (src/mcp/tools/read.ts, src/mcp/tools/index.ts, test/mcp/read-tools.test.ts)
- **Checkpoint:** US-1 is demoable: an assistant gets the next task in under 1 KB without reading `tasks.md`.

**Verify:** `npx vitest run test/core/query.test.ts test/mcp/read-tools.test.ts` passes, including unknown feature, story and lane errors and the "no unblocked task" answer.

## Phase 4 — User story US-2: change state through one validated path  (priority: P1)

- [ ] [T030] [US2] In-place `tickTask` and `setStoryStatus` that change only the target line under the lock, with tests incl. concurrent writers and re-parse after every write (src/core/tasks-edit.ts, test/core/tasks-edit.test.ts)
- [ ] [T031] [US2] Write tools `tick_task` and `set_story_status`, with tests (src/mcp/tools/write.ts, src/mcp/tools/index.ts, test/mcp/write-tools.test.ts)
- **Checkpoint:** US-2 is demoable: tick a task and set a status through the tools; an invalid status is refused with the allowed values.

**Verify:** `npx vitest run test/core/tasks-edit.test.ts test/mcp/write-tools.test.ts` passes; a diff of `tasks.md` before and after a tick shows exactly one changed line.

## Phase 5 — User story US-3: report activity and receive a directive  (priority: P1)

- [ ] [T040] [US3] Directive reader and derived status (pending, pause requested, paused, obeyed), missing file means continue; file names use the short lane form (batch B step 1), with tests (src/core/fleet/directives.ts, test/core/fleet-directives.test.ts)
- [ ] [T041] [US3] Shared `reportActivity` core: resolve run (a warning, nothing created, when there is no unfinished run), write the marker, read the directive, never throw, with tests (src/core/report.ts, test/core/report.test.ts)
- [ ] [T042] [P] [US3] `ambykit activity` gains `--lane`, `--state`, `--run`; calls without them stay byte-identical, with tests (src/cli/activity.ts, test/cli/activity.test.ts)
- [ ] [T043] [P] [US3] `report_activity` tool returning acknowledgement and directive, never failing the agent, with tests (src/mcp/tools/fleet.ts, src/mcp/tools/index.ts, test/mcp/report-tool.test.ts)
- [ ] [T044] [US3] Document the worker reporting cadence in the tool descriptions and contract: report at task start, task end, and when blocked or waiting, never on a timer; finish the current task, then obey pause or stop at the next report (FR-013, FR-020); the same wording as spec 019's worker prompt, with a test asserting the description text (src/mcp/tools/fleet.ts, test/mcp/tool-descriptions.test.ts)
- **Checkpoint:** US-3 is demoable: two lanes of one agent kind leave two markers; a pause directive is returned by the next report.

**Verify:** `npx vitest run test/core/fleet-directives.test.ts test/core/report.test.ts test/cli/activity.test.ts test/mcp/report-tool.test.ts test/mcp/tool-descriptions.test.ts` passes, and the 017 dashboard tests still pass unchanged.

## Phase 6 — User story US-7: steer a lane from any host  (priority: P1)

- [ ] [T050] [US7] `writeDirective` with lane validation against the run and last-write-wins; resume writes `continue`; the single writer that 019's wrapper, 028 and 029 call (batch B step 1), with tests (src/core/fleet/directives.ts, test/core/fleet-directives.test.ts)
- [ ] [T051] [US7] `ambykit directive <feature> <lane> pause|resume|stop` command, registered, naming an unknown lane, with tests (src/cli/directive.ts, src/cli/index.ts, test/cli/directive.test.ts)
- **Checkpoint:** US-7 is demoable: pause from the terminal, the next report returns pause and then shows paused; resume returns continue.

**Verify:** `npx vitest run test/core/fleet-directives.test.ts test/cli/directive.test.ts` passes, including two writers racing and a lane that does not exist.

## Phase 7 — User story US-6: set up and fall back safely  (priority: P1)

- [ ] [T060] [P] [US6] Pure JSON key merge that adds `<key>.ambykit` and preserves every other key and its order, with tests (src/core/merge-json.ts, test/core/merge-json.test.ts)
- [ ] [T061] [US6] `merge: "json"` on `EmittedFile` and in `applyFiles`: idempotent, backs up, skips files that do not parse as plain JSON, with tests (src/core/types.ts, src/cli/io/fsops.ts, test/fsops.test.ts)
- [ ] [T062] [US6] `BaseEmitter` MCP hook and `buildEmittedFiles` collection, only when `mcp.enabled`, with tests (src/emitters/base-emitter.ts, src/core/emit.ts, test/emit-mcp.test.ts)
- [ ] [T063] [P] [US6] Claude Code project config `.mcp.json`, snapshot test (src/emitters/claude.ts, test/mcp-emit-claude.test.ts)
- [ ] [T064] [P] [US6] OpenCode `opencode.json` `mcp` key, skip and report if the file has comments, snapshot test (src/emitters/opencode.ts, test/mcp-emit-opencode.test.ts)
- [ ] [T065] [P] [US6] Copilot (VS Code) `.vscode/mcp.json` `servers` key, snapshot test (src/emitters/copilot.ts, test/mcp-emit-copilot.test.ts)
- [ ] [T066] [P] [US6] Cursor `.cursor/mcp.json` `mcpServers` key (Cursor CLI reads the same file), snapshot test (src/emitters/cursor.ts, test/mcp-emit-cursor.test.ts)
- [ ] [T067] [P] [US6] Copilot CLI user-level `~/.copilot/mcp-config.json`, scope `user`, written only with `--include-user`, snapshot test (src/emitters/copilot-cli.ts, test/mcp-emit-copilot-cli.test.ts)
- [ ] [T068] [P] [US6] Antigravity user-level config only if T001 verified its path, else "not written"; snapshot test (src/emitters/antigravity.ts, test/mcp-emit-antigravity.test.ts)
- [ ] [T069] [US6] `sync` states which enabled targets have no verified MCP format and writes nothing for them; user-level files stay out of `--check`, with tests (src/cli/sync.ts, test/cli/sync-mcp.test.ts)
- [ ] [T070] [US6] Fallback test: every phase prompt still completes from files with the server absent (test/mcp-fallback.test.ts)
- **Checkpoint:** US-6 is demoable: enabling the server writes only verified project files; a second `sync` produces no diff.

**Verify:** `npx vitest run test/core/merge-json.test.ts test/fsops.test.ts test/emit-mcp.test.ts test/mcp-emit-claude.test.ts test/mcp-emit-opencode.test.ts test/mcp-emit-copilot.test.ts test/mcp-emit-cursor.test.ts test/mcp-emit-copilot-cli.test.ts test/mcp-emit-antigravity.test.ts test/cli/sync-mcp.test.ts test/mcp-fallback.test.ts` passes, and `ambykit sync --check` reports no drift after a sync.

## Phase 8 — User story US-4: claim files and share notes  (priority: P2)

- [ ] [T080] [P] [US4] Claims store `claims.json` `{path:{worker,task,at}}`: overlap-aware claim, refusal naming the owner, release by task, lock-guarded; 019's `fleet claim|release` wrap it (batch B step 1), with tests (src/core/fleet/claims.ts, test/core/fleet-claims.test.ts)
- [ ] [T081] [P] [US4] Notes board `notes.log`: one-line `T### | files | text` append, refuse anything else; 019's `fleet note` wraps it (batch B step 1), with tests (src/core/fleet/notes.ts, test/core/fleet-notes.test.ts)
- [ ] [T082] [US4] `tickTask` releases that task's claims, with tests (src/core/tasks-edit.ts, test/core/tasks-edit.test.ts)
- [ ] [T083] [US4] Fleet tools `claim_file` and `post_note`, with tests (src/mcp/tools/fleet.ts, src/mcp/tools/index.ts, test/mcp/claim-note-tools.test.ts)
- **Checkpoint:** US-4 is demoable: a second claim on a file is refused with the owner's name; ticking the task frees it.

**Verify:** `npx vitest run test/core/fleet-claims.test.ts test/core/fleet-notes.test.ts test/core/tasks-edit.test.ts test/mcp/claim-note-tools.test.ts` passes.

## Phase 9 — User story US-5: know when a lane has stalled  (priority: P2)

- [ ] [T090] [US5] `laneStatus`: the single per-lane stall implementation that 019, 028 and 029 call; state, stalled after `fleet.stallMinutes` with no report and no `tasks.md` change (only while working), directive status, independent of the dashboard idle limit (batch B step 1), with tests (src/core/fleet/lane-status.ts, test/core/lane-status.test.ts)
- [ ] [T091] [US5] `lane_status` read tool, with tests (src/mcp/tools/read.ts, src/mcp/tools/index.ts, test/mcp/lane-status-tool.test.ts)
- **Checkpoint:** US-5 is demoable: a lane left in working past the limit reads as stalled; waiting, blocked and done never do.

**Verify:** `npx vitest run test/core/lane-status.test.ts test/mcp/lane-status-tool.test.ts` passes, including a configured limit and a limit different from the dashboard's.

## Phase 10 — Polish

- [ ] [T100] [P] Document `mcp`, `directive` and the new `activity` flags (docs/cli-reference.md)
- [ ] [T101] [P] Concept page: tools, directives, claims, fallback and the opt-in setup (docs/concepts/mcp-server.md)
- [ ] [T102] [P] Update the architecture page so its MCP hooks match what shipped (docs/architecture.md)
- [ ] [T103] [P] Changelog entry under the next release (CHANGELOG.md)
- [ ] [T104] Performance and size checks: a report and a directive read inside one second (SC-003), query answers under 1 KB (SC-001) (test/mcp/perf.test.ts)
- [ ] [T105] INTEGRATION step, run once after merging the batch, never inside a lane branch. Dogfood (SC-007): enable the server on this repo, run `ambykit sync`, and use the tools from a lane on a later task (.amby/config.json, .mcp.json)
- **Checkpoint:** 025 is releasable in 1.5.

**Verify:** `npm run typecheck` and `npm test` pass, `ambykit sync --check` is clean, and `ambykit analyze` shows no new findings for 025.
