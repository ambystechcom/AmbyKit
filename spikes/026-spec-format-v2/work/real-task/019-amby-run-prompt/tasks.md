---
feature: 019-amby-run-prompt
created: 2026-11-16
---

# Tasks — Amby run (prompt-level pipeline and team protocol)

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes. Depends on spec 020 (BLOCKED markers, Verify lines).
> **Depends on (build first):** spec 025 foundation (state module under `src/core/fleet/*`, run schema in its `data-model.md`,
> `writeDirective`, `laneStatus`, claims, notes, the `fleet` config object — 025 T010–T016, T040, T050, T080, T081) and spec 024
> T031 (Claude emitter shell grant). 019 owns only prompts, emitters, the thin `ambykit fleet` wrapper and pure helpers in
> `src/core/fleet/run-flow.ts`. T103 and T104 are INTEGRATION steps run once after the batch merges, not inside this lane.

## Phase 1 — Setup

- [ ] [T001] [P] Add `agentsDir()` for shipped neutral subagent prompts
  ```yaml
  files: ["src/core/paths.ts"]
  ```
- [ ] [T002] [P] Include `src/agents/` in the published package files
  ```yaml
  files: ["package.json"]
  ```
```yaml
verify:
  check: "`npm run typecheck`"
```

## Phase 2 — Foundational  (blocks all feature work)

- [ ] [T010] Pure run-flow input types (spec, plan, tasks state), importing run types and `parseRunState` from 025 — no schema here
  ```yaml
  files: ["src/core/fleet/run-flow.ts"]
  ```
- [ ] [T011] [P] Contract check: confirm 025's `fleet` config object exposes `roundLimit`, `workerModel`, `concurrency` and `stallMinutes`; any missing key is added in 025 T010, not here
  ```yaml
  files: ["specs/019-amby-run-prompt/plan.md"]
  ```
- [ ] [T012] [P] Per-target subagent support table and `supportsSubagents()`; every target unconfirmed
  ```yaml
  files: ["src/core/subagents.ts"]
  ```
- [ ] [T013] `BaseEmitter`: `$SUBAGENTS` yes/no substitution and a default-empty `workerFiles()` hook
  ```yaml
  files: ["src/emitters/base-emitter.ts"]
  ```
- [ ] [T014] Test that the wrapper and prompts read defaults from the `fleet` config object and that an absent object means defaults
  ```yaml
  files: ["test/cli/fleet.test.ts"]
  ```
- [ ] [T015] Test subagent table covers every target id
  ```yaml
  files: ["test/core/subagents.test.ts"]
  ```
```yaml
verify:
  check: "`npm run typecheck && npx vitest run test/cli/fleet.test.ts test/core/subagents.test.ts`"
```

## Phase 3 — User story US-1  (priority: P1)

- [ ] [T020] [US1] Test `determinePhase` and `resolveRun` (draft spec, no plan, half-checked tasks, done, unknown)
  ```yaml
  files: ["test/core/run-flow.test.ts"]
  ```
- [ ] [T021] [US1] Implement `determinePhase`; run resolution (none, one, several unfinished) calls 025's `resolveRun`
  ```yaml
  files: ["src/core/fleet/run-flow.ts"]
  ```
- [ ] [T022] [US1] Wire `fleet start` to 025's create-run (explicit request only, `<feature>.<n>`, gitignore) — no store of its own
  ```yaml
  files: ["src/cli/fleet.ts"]
  ```
- [ ] [T023] [US1] `ambykit fleet start|status` thin wrapper verb and registration
  ```yaml
  files: ["src/cli/fleet.ts", "src/cli/index.ts"]
  ```
- [ ] [T024] [US1] Neutral `/amby.run` prompt: resume from state, artifact gates, done and unknown feature; runs `ambykit fleet` (needs 024 T031 shell grant)
  ```yaml
  files: ["src/prompts/run.md"]
  ```
- [ ] [T025] [US1] CLI test for `fleet start` and `fleet status`
  ```yaml
  files: ["test/cli/fleet.test.ts"]
  ```
- **Checkpoint:** US-1 is demoable: `/amby.run NNN` picks the right phase or stops naming the missing artifact.
```yaml
verify:
  check: "`npx vitest run test/core/run-flow.test.ts test/cli/fleet.test.ts`"
```

## Phase 4 — User story US-2  (priority: P1)

- [ ] [T030] [US2] Neutral worker prompt: take task IDs, load refs only, check off, one-line report, BLOCKED when stuck; report via `ambykit activity --lane --state` at task start, task end and when blocked or waiting (never on a timer), finish the current task then obey pause or stop at the next report (025 FR-013, FR-020; needs 025 T042)
  ```yaml
  files: ["src/agents/worker.md"]
  ```
- [ ] [T031] [US2] Claude emitter `workerFiles`: write-capable `amby-worker`, `model:` from `fleet.workerModel`
  ```yaml
  files: ["src/emitters/claude.ts"]
  ```
- [ ] [T032] [P] [US2] OpenCode emitter `workerFiles`
  ```yaml
  files: ["src/emitters/opencode.ts"]
  ```
- [ ] [T033] [P] [US2] Copilot emitter `workerFiles`, inherited by Copilot CLI
  ```yaml
  files: ["src/emitters/copilot.ts"]
  ```
- [ ] [T034] [US2] Format 025's `laneStatus` and `fleet.concurrency` (free slots, stalled lanes, restarts left) for `status`; no stall or cap logic here
  ```yaml
  files: ["src/cli/fleet.ts"]
  ```
- [ ] [T035] [US2] `fleet update` worker start/done/restart flags calling 025's run store; stall and restart output in `status`
  ```yaml
  files: ["src/cli/fleet.ts"]
  ```
- [ ] [T036] [US2] `run.md`: delegation by IDs and refs, caps, stall and restart-then-pause (025 stall rule), `--lane`/`--state` reporting cadence (025 FR-013/FR-020), all review roles read-only; runs `ambykit fleet`/`activity` (needs 024 T031, 025 T042)
  ```yaml
  files: ["src/prompts/run.md"]
  ```
- [ ] [T037] [US2] Test the wrapper's slots, stall and restart output against fixture state from 025
  ```yaml
  files: ["test/cli/fleet.test.ts"]
  ```
- [ ] [T038] [US2] Test worker emission per target and that the seven review personas (incl. the 022 security role) stay read-only
  ```yaml
  files: ["test/worker-emit.test.ts"]
  ```
- [ ] [T039] [US2] CLI test for worker flags and stall output
  ```yaml
  files: ["test/cli/fleet.test.ts"]
  ```
- **Checkpoint:** US-2 is demoable: three tasks run on workers, report in one line, caps and stall enforced.
```yaml
verify:
  check: "`npm run typecheck && npx vitest run test/worker-emit.test.ts test/cli/fleet.test.ts`"
```

## Phase 5 — User story US-3  (priority: P1)

- [ ] [T040] [US3] Test verdict-line parser and failing-ID extraction
  ```yaml
  files: ["test/core/run-flow.test.ts"]
  ```
- [ ] [T041] [US3] `parseVerdict` for the verdict contract `verdicts/<lane>.<role>.<round>.json` `{verdict, findings:[{id, severity, finding, fix}]}`
  ```yaml
  files: ["src/core/fleet/run-flow.ts"]
  ```
- [ ] [T042] [US3] `run.md`: QA step runs the phase `Verify` line and criteria, records per spec 020, unverified when it cannot run, uses `tests.md` when present
  ```yaml
  files: ["src/prompts/run.md"]
  ```
- [ ] [T043] [US3] Snapshot test that the emitted run prompt names QA by role path and the Verify gate
  ```yaml
  files: ["test/run-emit.test.ts"]
  ```
- **Checkpoint:** US-3 is demoable: a failing Verify blocks the checkpoint and names finding IDs.
```yaml
verify:
  check: "`npx vitest run test/core/run-flow.test.ts test/run-emit.test.ts`"
```

## Phase 6 — User story US-4  (priority: P1)

- [ ] [T050] [US4] Test `nextRoundAction` at, below and over the limit
  ```yaml
  files: ["test/core/run-flow.test.ts"]
  ```
- [ ] [T051] [US4] `nextRoundAction(round, limit)` and round bookkeeping
  ```yaml
  files: ["src/core/fleet/run-flow.ts"]
  ```
- [ ] [T052] [US4] `fleet update --round` and `--decision`, recording the round and the decision (`escalations[]`) through 025's run store
  ```yaml
  files: ["src/cli/fleet.ts"]
  ```
- [ ] [T053] [US4] `run.md`: architect review, verdict to the same worker, escalation at the limit, record the decision
  ```yaml
  files: ["src/prompts/run.md"]
  ```
- [ ] [T054] [US4] CLI test for round and decision flags
  ```yaml
  files: ["test/cli/fleet.test.ts"]
  ```
- **Checkpoint:** US-4 is demoable: a forced failure loops to the same worker and stops for a person at the limit.
```yaml
verify:
  check: "`npx vitest run test/core/run-flow.test.ts test/cli/fleet.test.ts`"
```

## Phase 7 — User story US-5  (priority: P1)

- [ ] [T060] [US5] Test `rebuildFromTasks` and corrupt or missing state recovery
  ```yaml
  files: ["test/core/run-flow.test.ts"]
  ```
- [ ] [T061] [US5] `rebuildFromTasks` from checked tasks, never discarding completed work
  ```yaml
  files: ["src/core/fleet/run-flow.ts"]
  ```
- [ ] [T062] [US5] `fleet status --rebuild`: on missing or corrupt state (detected by 025's loader), write `rebuildFromTasks` output in 025's schema through 025's store
  ```yaml
  files: ["src/cli/fleet.ts"]
  ```
- [ ] [T063] [US5] Pause, resume and stop: `fleet update --pause|--resume|--stop` calls 025's `writeDirective` (short lane form) and records the state; no writer here
  ```yaml
  files: ["src/cli/fleet.ts"]
  ```
- [ ] [T064] [US5] `run.md`: resume rules, several runs ask, explicit-request `--new` run id `<feature>.<n>`, pause wording (finish task, obey at next report)
  ```yaml
  files: ["src/prompts/run.md"]
  ```
- [ ] [T065] [US5] CLI tests for resume, `--new`, several runs, pause files
  ```yaml
  files: ["test/cli/fleet.test.ts"]
  ```
- **Checkpoint:** US-5 is demoable: stop mid-phase, start a new session, resume with no repeated work.
```yaml
verify:
  check: "`npx vitest run test/core/run-flow.test.ts test/cli/fleet.test.ts`"
```

## Phase 8 — User story US-8  (priority: P1)

- [ ] [T070] [US8] `run.md`: no-MCP statement and the no-subagent fallback in sequence, same state files
  ```yaml
  files: ["src/prompts/run.md"]
  ```
- [ ] [T071] [US8] Test `$SUBAGENTS` is substituted for every emitter and fallback text appears where `no`
  ```yaml
  files: ["test/run-emit.test.ts"]
  ```
- [ ] [T072] [US8] Add a Subagents row to the compatibility matrix with sources and status per target
  ```yaml
  files: ["docs/tool-compatibility.md"]
  ```
- [ ] [T073] [US8] Live-confirm Claude Code runs the emitted `amby-worker` and flip `claude` to confirmed, record the result
  ```yaml
  files: ["src/core/subagents.ts", "docs/tool-compatibility.md"]
  ```
- **Checkpoint:** US-8 is demoable: a run completes on a supported and on an unsupported assistant with identical state files.
```yaml
verify:
  check: "`npx vitest run test/run-emit.test.ts test/core/subagents.test.ts`"
```

## Phase 9 — User story US-6  (priority: P2)

- [ ] [T080] [US6] Test the wrapper against 025's claims: refusal naming the owner, overlap, release on checked task
  ```yaml
  files: ["test/cli/fleet.test.ts"]
  ```
- [ ] [T081] [US6] Contract check that 025's claims module covers refusal-by-owner and release-on-check-off; gaps go to 025, not here
  ```yaml
  files: ["specs/019-amby-run-prompt/plan.md"]
  ```
- [ ] [T082] [US6] `fleet claim|release|note` wrapper over 025's claims and `notes.log` (`T### | files | text`), unclaimed-edit warning in `status`
  ```yaml
  files: ["src/cli/fleet.ts"]
  ```
- [ ] [T083] [US6] Worker and run prompts: claim before editing, post one-line notes, blocked goes through the lead
  ```yaml
  files: ["src/agents/worker.md", "src/prompts/run.md"]
  ```
- [ ] [T084] [US6] CLI tests for claim, release and note
  ```yaml
  files: ["test/cli/fleet.test.ts"]
  ```
- **Checkpoint:** US-6 is demoable: the second claimant is told who owns the file; check-off frees claims.
```yaml
verify:
  check: "`npx vitest run test/cli/fleet.test.ts`"
```

## Phase 10 — User story US-7  (priority: P3)

- [ ] [T090] [US7] Test overlap decision records (serialize, squad, fixed merge order)
  ```yaml
  files: ["test/core/run-flow.test.ts"]
  ```
- [ ] [T091] [US7] Record serialize or squad choice with one writer per file and fixed order before work starts, as a `lanes[]` extension written through 025's store
  ```yaml
  files: ["src/core/fleet/run-flow.ts"]
  ```
- [ ] [T092] [US7] `run.md`: squad and serialize rules, cross-file requests via the writer or lead
  ```yaml
  files: ["src/prompts/run.md"]
  ```
- **Checkpoint:** US-7 is demoable: overlapping tasks are serialized or form a recorded squad.
```yaml
verify:
  check: "`npx vitest run test/core/run-flow.test.ts`"
```

## Phase 11 — Polish

- [ ] [T100] [P] List `run` in the generated workflow summary and role-binding expectations
  ```yaml
  files: ["src/core/rules.ts", "test/roles-emit.test.ts"]
  ```
- [ ] [T101] [P] Document `/amby.run`, `ambykit fleet` and the run config in the workflow and CLI docs
  ```yaml
  files: ["docs/workflow.md", "docs/cli-reference.md"]
  ```
- [ ] [T102] [P] Pack-contents test includes `src/agents/`
  ```yaml
  files: ["test/pack-contents.test.ts"]
  ```
- [ ] [T103] INTEGRATION (run once after the batch merges, not in this lane): re-record golden fixtures for every command-surface target
  ```yaml
  files: ["test/fixtures/emitters-golden/"]
  ```
- [ ] [T104] INTEGRATION (run once after the batch merges, not in this lane): run `ambykit sync` so the repo's own tool files include `/amby.run` and `amby-worker`
  ```yaml
  files: [".claude/"]
  ```
- [ ] [T105] Full gate: `npm run typecheck` and `npm test`, and CI sync check shows no diff
  ```yaml
  files: ["test/check-docs-sync.test.ts"]
  ```
- [ ] [T106] Dogfood gate: run `/amby.run` on a small feature on one subagent host and one without (SC-005, SC-007)
  ```yaml
  files: ["specs/019-amby-run-prompt/tasks.md"]
  ```
```yaml
verify:
  check: "`npm run typecheck && npm test`"
```
