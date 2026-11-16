---
feature: 015-parallel-lanes
created: 2026-10-26
---

# Tasks — Parallel lanes — file ownership and conflict-free concurrent execution

> Line format: `- [ ] [T###] [P?] [US#] description (file/path, other/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.

## Phase 1 — Setup

- [x] [T001] [P] Fixture builder for tasks.md bodies: phases, [P], multi/no/glob paths, checked lines
- [x] [T002] [P] Lane git fixture: repo + feature branch + feature worktree, `worktrees: true` config

```yaml
files:
  T001: ["test/helpers/tasks-fixture.ts"]
  T002: ["test/helpers/lane-fixture.ts"]
```

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Extend TaskLine with phase/parallel/paths/pathIssue; parseTasks reads headings and trailing path group
- [x] [T011] normalizePath + overlaps + lane-name helpers (`laneName`, `parseLaneName`)
- [x] [T012] [P] Unit tests: normalization, overlap prefix rule, lane-name round trip
- [x] [T013] [P] Regression: existing parse consumers unchanged — dashboard/overview tests still pass

```yaml
files:
  T010: ["src/core/dashboard.ts"]
  T011: ["src/core/lanes.ts"]
  T012: ["test/core/lanes.test.ts"]
  T013: ["test/dashboard.test.ts"]
```

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] Parse tests: single/multi path, backticks, prose parenthetical ignored, path-less and glob flagged, pre-015 tasks.md parses — SC-004
- [x] [T021] [US1] `declarations(tasks)` over open tasks only — FR-002/015/016
- [x] [T022] [P] [US1] Tasks prompt step 4: comma-separated repo-relative paths, dirs end `/`, no globs, [P] only when no overlap in phase
- [x] [T023] [P] [US1] Template header line format shows multi-path example
- [x] [T024] [US1] `ambykit sync` regenerates the tasks command; emitter tests assert the new line
- **Checkpoint:** US-1 — declarations are parsed and the tasks phase writes them.

```yaml
files:
  T020: ["test/core/tasks-parse.test.ts"]
  T021: ["src/core/lanes.ts"]
  T022: ["src/prompts/tasks.md"]
  T023: ["src/templates/tasks.md"]
  T024: [".claude/commands/amby.tasks.md", "test/claude-emitter.test.ts"]
```

## Phase 4 — User story US-2  (priority: P1)

- [x] [T030] [US2] `laneConflicts(feature, tasks)`: open tasks, same phase, ≥1 [P], grouped per path, sequencing hint — FR-004/005/006/015
- [x] [T031] [P] [US2] Conflict tests: seeded collision, disjoint, dir-vs-file, cross-phase, [P]-vs-sequential, done tasks ignored, shared path → one finding — SC-001/002
- [x] [T032] [US2] AnalysisReport.lanes + analyzeProject reads tasks per feature
- [x] [T033] [US2] `ambykit analyze`: "Lane conflicts" block → exit 1, declarations as warnings, JSON — FR-007
- [x] [T034] [P] [US2] CLI e2e: conflict exits 1 naming ids+path; disjoint exits 0; repo's own specs pass — SC-009
- [x] [T035] [P] [US2] Perf: 200-task fixture through laneConflicts + planLanes < 200 ms — SC-005
- **Checkpoint:** US-2 — `ambykit analyze` gates CI on lane conflicts.

```yaml
files:
  T030: ["src/core/lanes.ts"]
  T031: ["test/core/lane-conflicts.test.ts"]
  T032: ["src/core/analyze.ts"]
  T033: ["src/cli/analyze.ts"]
  T034: ["test/cli/analyze-lanes.test.ts"]
  T035: ["test/core/lanes-perf.test.ts"]
```

## Phase 5 — User story US-3  (priority: P2)

- [x] [T040] [US3] `planLanes(feature, tasks, {phase, lanes})`: default phase, round-robin, stays, complete/no-parallel/conflict — FR-008/017
- [x] [T041] [P] [US3] planLanes tests: 2 lanes from 5 [P] tasks, n > count clamps, all-done → complete, conflict → refused
- [x] [T042] [US3] `featureWorktrees` excludes lane dirs; `laneWorktrees`; `featureFromWorktreePath` maps lane → feature
- [x] [T043] [US3] `mergeCheckoffs(base, ours, theirs)` pure + manifest read/write/drift helpers — FR-019/020
- [x] [T044] [P] [US3] Tests: adjacent check-offs union, non-checkbox difference → null, CRLF kept, drift ids
- [x] [T045] [US3] `LaneCommand` create: config gate, feature-branch resolution, worktree add per lane, manifest, idempotent, --dry-run/--json — FR-009/011
- [x] [T046] [US3] `lane list` (tasks, paths, clean/dirty/merged, drift) and `lane remove [<lane>] [--force]` keeping branches — FR-010/020
- [x] [T047] [US3] `lane merge <feature> [<lane>]`: clean check, --no-commit merge, check-off auto-resolve, abort on other conflicts — FR-019
- [x] [T048] [US3] Register the verb
- [x] [T049] [P] [US3] e2e: two lanes created, each manifest lists only its tasks; second run no-op; conflict → none created; opt-out refused — SC-003
- [x] [T050] [P] [US3] e2e merge: adjacent check-offs merge clean with both ticks; seeded code conflict leaves feature checkout clean — SC-008
- [x] [T051] [P] [US3] Implement prompt: lane manifest scopes the tasks — FR-018
- [x] [T052] [P] [US3] Rules region: current feature inside `.worktrees/NNN-slug.lane-p-k/`
- [x] [T053] [US3] `ambykit sync` + emitter test for implement lane line and rules region
- **Checkpoint:** US-3 — lanes can be created, worked, listed, merged and removed.

```yaml
files:
  T040: ["src/core/lanes.ts"]
  T041: ["test/core/lane-plan.test.ts"]
  T042: ["src/core/worktree.ts"]
  T043: ["src/core/lanes.ts"]
  T044: ["test/core/lane-merge.test.ts"]
  T045: ["src/cli/lane.ts"]
  T046: ["src/cli/lane.ts"]
  T047: ["src/cli/lane.ts"]
  T048: ["src/cli/index.ts"]
  T049: ["test/cli/lane.test.ts"]
  T050: ["test/cli/lane-merge.test.ts"]
  T051: ["src/prompts/implement.md"]
  T052: ["src/core/rules.ts"]
  T053: ["test/emitters-region.test.ts", "AGENTS.md"]
```

## Phase 6 — User story US-4  (priority: P3)

- [x] [T060] [US4] resolveCheckouts returns lanes (dirty + merged-into-feature in the concurrent batch); Checkout kind "lane"
- [x] [T061] [US4] FeatureSnapshot.lanes + done-union of lane check-offs into feature progress
- [x] [T062] [P] [US4] Checkout tests: lanes attached, not treated as features, union counts, no lanes → unchanged
- [x] [T063] [US4] Lane sub-rows in WORKTREES & AGENTS panel (unicode/ascii, narrow) and plain layout
- [x] [T064] [US4] `--json --overview` adds `lanes` only when present; lane checkouts join allCheckouts for watch + presence
- [x] [T065] [P] [US4] Renderer + JSON tests: per-lane counts match lane tasks.md, byte-identical output without lanes
- **Checkpoint:** US-4 — lane progress is visible from any checkout.

```yaml
files:
  T060: ["src/core/checkouts.ts", "src/core/overview-types.ts"]
  T061: ["src/core/checkouts.ts"]
  T062: ["test/core/checkouts.test.ts"]
  T063: ["src/cli/ui/dashboard/worktrees-panel.ts"]
  T064: ["src/cli/dashboard.ts"]
  T065: ["test/ui/dashboard-lanes.test.ts"]
```

## Phase 7 — Polish

- [x] [T090] [P] CLI reference: `ambykit lane` and analyze lane conflicts
- [x] [T091] [P] Workflow guide "Parallel lanes" + task-line path convention
- [x] [T092] [P] Site CLI page and workflow page
- [x] [T093] [P] README + AGENTS.md project-structure line for the `lane` verb
- [x] [T094] [P] CHANGELOG Unreleased entry
- [x] [T095] FR→test traceability check; `npm run typecheck` + `npm test` + docs-sync — SC-006
- [x] [T096] Dogfood: set `worktrees: true`, run `ambykit analyze` clean on this tasks.md, execute two Phase 7 tasks in separate lanes and merge — SC-007

```yaml
files:
  T090: ["docs/cli-reference.md"]
  T091: ["docs/workflow.md"]
  T092: ["site/src/content/docs/cli/index.mdx", "site/src/content/docs/workflow/tasks.mdx", "site/src/content/docs/workflow/implement.mdx"]
  T093: ["README.md", "AGENTS.md"]
  T094: ["CHANGELOG.md"]
  T095: ["test/check-docs-sync.test.ts"]
  T096: [".amby/config.json"]
```
