---
feature: 020-blocked-and-verify
created: 2026-11-16
---

# Tasks — Blocked markers and Verify lines

> Line format: `- [ ] [T###] [P?] [US#] description (file/path, other/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Paths: repo-relative, comma-separated, dirs end `/`, no globs. `[P]` tasks in a phase must not share or nest paths.
> Gate: no user-story task starts until Foundational completes.
> Order of stories: US-1 → US-2; US-3 → US-4; US-5 last (`depends-on` US-1 and US-3).
> Each phase ends with a `Verify:` line (the convention this feature adds, used here first). `[P]`
> implementation tasks come first in a story phase; tests that need the merged code follow them and are
> not `[P]`. Run `npm run typecheck` before every commit (P5).
> Build order: 020 builds FIRST (release 1.4, single lane; it changes `parseTasks`, prompts and goldens); 023 builds after it.
> T064 (golden re-record) and T065 (`ambykit sync`) are INTEGRATION steps: run once per batch after merging, never inside a lane branch.
> Shared hotspot files: rebase and merge by hand, different lines only (src/cli/index.ts, src/core/config.ts, src/core/types.ts, docs/cli-reference.md, CHANGELOG, docs/workflow.md, docs/tool-compatibility.md, README.md).

## Phase 1 — Setup

- [x] [T001] Add the baseline test and record its fixture from the UNCHANGED parser: id, done, story, phase, parallel and paths of every task in every repo `specs/*/tasks.md` (SC-002, FR-012); record with `UPDATE_BASELINE=1` before any other task starts
- **Checkpoint:** the baseline fixture is committed and the test passes on the untouched parser.
```yaml
files:
  T001: ["test/tasks-baseline-020.test.ts", "test/fixtures/tasks-baseline-020.json"]
verify:
  check: "`npx vitest run test/tasks-baseline-020.test.ts`"
  result: passed
```

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Add the pure `src/core/markers.ts`: `parseMarkers(rest)` (trailing BLOCKED / DEVIATION, glyph optional, reason up to the next marker, empty reason flagged, several BLOCKED joined with ` | `), `phaseNumber(heading, ordinal)` shared numbering, `parsePhases(content)` returning per-phase Verify check and result (`✓ passed`, `✗ failed: why`, `? unverified`, glyph-less words accepted) (FR-001, FR-002, FR-003, FR-005, FR-006)
- [x] [T011] Extend `TaskLine` with optional `blocked`/`deviation` and make `parseTasks` call `parseMarkers` first and `phaseNumber`, so `parseDeclaredPaths` sees the body only (FR-012)
- [x] [T012] Add the types: `FeatureSnapshot.verify`, `FeatureRow.blocked`/`verify`, attention kinds `task-blocked` and `verify-failed`, and `PhaseVerify` re-export; the attention panel falls back to the `blocked` token for a kind without its own entry until T032 adds them, which keeps typecheck green (FR-010, FR-013)
- [x] [T013] Populate `FeatureSnapshot.verify` in `readFeatures` from `parsePhases` on the same `tasks.md` read
- [x] [T014] Unit-test `markers.ts`: every syntax form, ASCII forms, empty reason, multiple markers, reasons with `()`/backticks, CRLF, path group recovered, `parsePhases` numbering equals `parseTasks` phases (FR-001, FR-002, FR-003, FR-005)
- **Checkpoint:** foundations are covered by tests, the baseline test still passes, `npm run typecheck` passes.
```yaml
files:
  T010: ["src/core/markers.ts"]
  T011: ["src/core/dashboard.ts"]
  T012: ["src/core/overview-types.ts", "src/cli/ui/dashboard/attention.ts"]
  T013: ["src/core/features.ts"]
  T014: ["test/core/markers.test.ts"]
verify:
  check: "`npm run typecheck && npx vitest run test/core/markers.test.ts test/tasks-baseline-020.test.ts test/dashboard.test.ts test/core/features.test.ts`"
  result: passed
```

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] Tell the implementer how to mark a block: add `⚠ BLOCKED: <reason>` as the last segment of the task line, optionally `↪ DEVIATION: <note>`, stop that task and continue with another unblocked one, remove the marker when resolved (FR-015, FR-016)
- [x] [T021] [P] [US1] Document the markers in the tasks template header: syntax, trailing position, glyph-less form (FR-015)
- [x] [T022] [P] [US1] Document the markers in the tasks artifact page with an example line carrying a path group and both markers (FR-015)
- [x] [T023] [US1] Test the US-1 acceptance criteria through `parseTasks`: blocked with reason, removed marker, deviation leaves state/ownership untouched, empty reason, checked-but-blocked inconsistency, marker plus ownership recovered (FR-001, FR-002, FR-003, FR-004)
- **Checkpoint:** US-1 is demoable: a marked task line parses as blocked with its reason and unchanged ownership.
```yaml
files:
  T020: ["src/prompts/implement.md"]
  T021: ["src/templates/tasks.md"]
  T022: ["docs/artifacts/tasks.md"]
  T023: ["test/core/task-markers.test.ts"]
verify:
  check: "`npm run typecheck && npx vitest run test/core/task-markers.test.ts test/core/markers.test.ts`"
  result: passed
```

## Phase 4 — User story US-2  (priority: P1)

- [x] [T030] [P] [US2] Report blocked tasks, deviations and marker issues in `AnalysisReport` (new keys only, exit status unchanged) and print them in `ambykit analyze` text and `--json` (FR-009, FR-013)
- [x] [T031] [P] [US2] Add `task-blocked` attention items, exclude blocked tasks from *Up next*, and fill `FeatureRow.blocked` (omitted when zero) (FR-010, FR-011)
- [x] [T032] [P] [US2] Add token entries for the `task-blocked` and `verify-failed` attention kinds in both theme tables, with ASCII symbols (FR-014)
- [x] [T033] [P] [US2] Show the blocked count as text in the feature chart row, only when greater than zero (FR-010, FR-014)
- [x] [T034] [P] [US2] Show a task's BLOCKED reason and DEVIATION note as text in the story detail, no glyph needed (FR-010, FR-014)
- [x] [T035] [US2] Test `analyzeProject`: blocked and deviation findings, markerIssues, exit status unchanged, no new keys populated when there are no markers (FR-009, FR-011)
- [x] [T036] [US2] Test overview: attention item, Up next exclusion, `FeatureRow.blocked` omitted when zero, filters (FR-010)
- [x] [T037] [US2] E2E over a fixture project: `dashboard` one-shot, `--json --overview`, `analyze`, `analyze --json`, `--icons=ascii` plain layout, output identical to before without markers, one-shot under 1 second (FR-010, FR-011, FR-013, FR-014, SC-001)
- **Checkpoint:** US-2 is demoable: `dashboard` and `analyze` name a blocked task and its reason with zero model tokens.
```yaml
files:
  T030: ["src/core/analyze.ts", "src/cli/analyze.ts"]
  T031: ["src/core/overview.ts"]
  T032: ["src/cli/ui/dashboard/tokens.ts", "specs/014-enhanced-dashboard/design-tokens.json"]
  T033: ["src/cli/ui/dashboard/feature-chart.ts"]
  T034: ["src/cli/ui/dashboard/story-detail.ts"]
  T035: ["test/core/analyze-markers.test.ts"]
  T036: ["test/core/overview-markers.test.ts"]
  T037: ["test/cli/markers-surface.test.ts"]
verify:
  check: "`npm run typecheck && npx vitest run test/core/analyze-markers.test.ts test/core/overview-markers.test.ts test/cli/markers-surface.test.ts test/analyze.test.ts test/core/overview-attention.test.ts test/cli/dashboard-perf.test.ts`"
  result: passed
```

## Phase 5 — User story US-3  (priority: P1)

- [x] [T040] [US3] Tell the implementer to run a phase's Verify line before its checkpoint, write the result suffix in place, never pass the checkpoint on a failure, and ask a person for a check it cannot run and record `? unverified` (FR-006, FR-007, FR-008, FR-015)
- [x] [T041] [P] [US3] Make `/amby.tasks` emit exactly one `**Verify:**` line per phase, plain text after the phase's tasks (FR-005, FR-015)
- [x] [T042] [P] [US3] Add a Verify line to each phase of the tasks template and document the result suffix (FR-005, FR-015)
- [x] [T043] [P] [US3] Document the Verify line and its result suffix in the tasks artifact page (FR-015)
- [x] [T044] [US3] Test `parsePhases`: pass, fail with reason, unverified, overwritten result, several Verify lines in one phase, a Verify line outside a phase, a feature with no phases (FR-005, FR-006, FR-007)
- **Checkpoint:** US-3 is demoable: a new `tasks.md` carries a Verify line per phase and its result is readable from the file.
```yaml
files:
  T040: ["src/prompts/implement.md"]
  T041: ["src/prompts/tasks.md"]
  T042: ["src/templates/tasks.md"]
  T043: ["docs/artifacts/tasks.md"]
  T044: ["test/core/verify-lines.test.ts"]
verify:
  check: "`npm run typecheck && npx vitest run test/core/verify-lines.test.ts test/core/markers.test.ts`"
  result: passed
```

## Phase 6 — User story US-4  (priority: P2)

- [x] [T050] [P] [US4] Report phases without a Verify line (features not yet done, grouped per feature in text) and phases whose last Verify failed, in `analyze` text and `--json`, as warnings that never change the exit status (FR-009, FR-011)
- [x] [T051] [P] [US4] Add `verify-failed` attention items and `FeatureRow.verify` (verified, failed, missing counts; omitted when the feature has no Verify lines) (FR-010)
- [x] [T052] [P] [US4] Show verify progress in the feature view's `tasks.md` artifact line and mark a failed phase in text (FR-010, FR-014)
- [x] [T053] [US4] Test the analyze Verify findings: missing, failed, all verified, old feature stays warning-only (FR-009, FR-011)
- [x] [T054] [US4] E2E: failed Verify keeps a feature from showing as fully verified; JSON shape stable; plain layout (SC-003, FR-010, FR-013, FR-014)
- **Checkpoint:** US-4 is demoable: a failed or missing Verify is reported by `analyze` and shown on the dashboard.
```yaml
files:
  T050: ["src/core/analyze.ts", "src/cli/analyze.ts"]
  T051: ["src/core/overview.ts"]
  T052: ["src/cli/ui/dashboard/feature-view.ts"]
  T053: ["test/core/analyze-verify.test.ts"]
  T054: ["test/cli/verify-surface.test.ts"]
verify:
  check: "`npm run typecheck && npx vitest run test/core/analyze-verify.test.ts test/cli/verify-surface.test.ts test/cli/markers-surface.test.ts`"
  result: passed
```

## Phase 7 — User story US-5  (priority: P1)

- [x] [T060] [US5] Test that every existing `tasks.md` keeps its tasks and that `dashboard`/`analyze` output on this repo's specs equals the pre-change output apart from missing-Verify warnings (FR-011, FR-012, SC-002)
- [x] [T061] [P] [US5] Document the new `analyze` and `dashboard` output and every new `--json` key in the CLI reference (FR-013)
- [x] [T062] [P] [US5] Mention blocked markers and phase Verify lines in the workflow guide (FR-015)
- [x] [T063] [P] [US5] Add the unreleased 1.4 changelog entry
- [x] [T064] [US5] INTEGRATION STEP (once per batch, after merging, not in a lane branch): re-record the emitter goldens with `UPDATE_GOLDEN=1`, review that only the prompt text changed
- [x] [T065] [US5] INTEGRATION STEP (once per batch, after merging, not in a lane branch): run `ambykit sync` so the repo's own tool files follow the new prompts and template, then confirm a second sync produces no diff (P6)
- **Checkpoint:** US-5 holds: existing projects see no change; the repo is in sync.
```yaml
files:
  T060: ["test/cli/unchanged-output-020.test.ts"]
  T061: ["docs/cli-reference.md"]
  T062: ["docs/workflow.md"]
  T063: ["CHANGELOG.md"]
  T064: ["test/fixtures/emitters-golden/"]
  T065: [".claude/commands/", ".amby/templates/", ".agents/skills/"]
verify:
  check: "`npm run typecheck && npm test && ambykit sync --check`"
  result: passed
```

## Phase 8 — Polish

- [x] [T090] Record the SC-005 evidence: lanes used per phase, merges done by `ambykit lane merge`, and whether any marker or check-off conflict needed manual resolution
- [x] [T091] Run `/amby.converge` and append any gap tasks; confirm every FR maps to a test (P5)
```yaml
files:
  T090: ["specs/020-blocked-and-verify/lane-notes.md"]
  T091: ["specs/020-blocked-and-verify/tasks.md"]
verify:
  check: "`npm run typecheck && npm test`"
  result: passed
```

## Convergence gaps

> Appended by `/amby.converge` (2026-11-16): 16 FR and 5 SC checked against the code and tests. Gaps and unverified items below; nothing else is open.

- [x] [T100] [US3] Move the story-done rule after the phase check in the implement prompt: today step 4 sets a story `status: done` when its tasks are checked, before step 5 runs the phase Verify, so a failed Verify leaves the story `done`; set `done` only once the Verify has passed (closes FR-007, SC-003)
- [x] [T101] [US3] Test the prompt contract so it is no longer covered only by the re-recordable emitter goldens: the implement prompt, the tasks prompt and the tasks template carry the marker syntax and markers-last rule, the one Verify line per phase, the result suffix, the ask-a-person fallback and the stop-and-continue rule, and stay under a size cap (closes FR-006, FR-007, FR-008, FR-015, FR-016, SC-004)
- [x] [T102] [US1] Report a marker that is followed by a `(file/path)` group as a marker issue (new kind, warning only, text and `--json`), because that path group is read as part of the reason and the task silently loses its file ownership for lane planning (closes FR-002, FR-012)
- [x] [T103] [US1] Test the new marker issue: marker before a path group is reported, marker after it is not, exit status unchanged (closes FR-002, FR-012)
- [x] [T104] [US2] [VERIFY] Add a narrow-terminal case: the blocked count and the failed-phase text are asserted only in the wide and `--icons=ascii` layouts, never at a narrow width (closes FR-014)
- [x] [T105] [US5] [VERIFY] SC-005 was only partly met (2 of 14 lane merges needed a manual step, see lane-notes.md): decide between writing the rule down (record Verify results after the phase's lanes are merged) in the prompt and the artifact page, or teaching `mergeCheckoffs` to take a lane's check-off next to other edits; then apply the choice (closes SC-005)
- [x] [T106] [US5] INTEGRATION STEP (once, after T100 and T105 are merged): re-record the emitter goldens with `UPDATE_GOLDEN=1`, run `ambykit sync` with this checkout's build, confirm a second sync produces no diff
```yaml
files:
  T100: ["src/prompts/implement.md"]
  T101: ["test/prompts-020.test.ts"]
  T102: ["src/core/analyze.ts", "src/cli/analyze.ts"]
  T103: ["test/core/analyze-markers.test.ts"]
  T104: ["test/cli/markers-surface.test.ts", "test/cli/verify-surface.test.ts"]
  T105: ["src/prompts/implement.md", "docs/artifacts/tasks.md"]
  T106: ["test/fixtures/emitters-golden/", ".claude/commands/", ".agents/skills/"]
verify:
  check: "`npm run typecheck && npx vitest run test/prompts-020.test.ts test/core/analyze-markers.test.ts test/cli/markers-surface.test.ts test/cli/verify-surface.test.ts && ambykit sync --check`"
  result: passed
```
