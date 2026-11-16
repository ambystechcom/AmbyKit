---
feature: 023-dependency-graph
created: 2026-11-16
---

# Tasks — Shared dependency graph

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> After US-1, phases US-2, US-4 and US-5 touch disjoint files and can run as parallel lanes.
> Build order: 023 builds AFTER 020 (both edit `attentionItems`); T001 records its goldens from the 020 tip. 023 must be done before 025's stateful tools (025 T020 imports `buildable`/`blockersOf`).
> Shared hotspot files: rebase and merge by hand, different lines only (src/cli/index.ts, src/core/config.ts, src/core/types.ts, docs/cli-reference.md, CHANGELOG, docs/workflow.md, docs/tool-compatibility.md, README.md).

## Phase 1 — Setup

- [x] [T001] Record characterization goldens of today's `analyzeGraph` and `attentionItems` over this repo's specs and the cycle/dangling fixtures, from the 020 tip (build after 020) and BEFORE any refactor (test/core/graph-golden.test.ts, test/fixtures/graph/)
- [x] [T002] [P] Write the `--json` contract: `version`, nodes, story edges with kind, feature edges with causing edges, broken, cycles (specs/023-dependency-graph/contracts/graph-json.md)

**Verify:** `npm test -- graph-golden` passes against the unmodified analyzer and overview code, and `contracts/graph-json.md` lists every field FR-008 requires. ✓ passed

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Define `DependencyGraph`, `StoryNode`, `StoryEdge`, `FeatureEdge`, `BrokenEdge`, `GraphCycle` types (src/core/graph-types.ts)
- [x] [T011] Export the graph types and API surface from the core barrel (src/core/index.ts)

**Verify:** `npm run typecheck` passes and T001's goldens are still green. ✓ passed

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] Implement `buildGraph(features)`: story nodes, story edges with kind, derived feature edges, sorted output (src/core/graph.ts)
- [x] [T021] [US1] Add broken-edge reporting (unknown story or feature, both ends named) and cycle reporting by ID, including self-dependency (src/core/graph.ts)
- [x] [T022] [US1] Test build, feature-edge derivation, determinism under shuffled input, no mutation, broken edges, cycles, the spec's edge cases, and the SC-001 timing on a 200-feature fixture (test/core/graph.test.ts)
- **Checkpoint:** US-1 is demoable: `buildGraph` over two sample features returns nodes, edges and a derived feature edge.

**Verify:** `npm test -- core/graph.test` passes, including the determinism and 200-feature timing tests. ✓ passed

## Phase 4 — User story US-2  (priority: P1)

- [x] [T030] [P] [US2] Test today's syntax: `depends-on: [US-1]` same-feature, `[015:US-2]` cross-feature, the `NNN/US-1` form, `blocked-by` as a distinct kind, and a node with no edges (test/core/graph-syntax.test.ts)
- [x] [T031] [P] [US2] Parity test: story edges built from every `specs/*/spec.md` in this repo equal the T001 golden of `analyze`, with no new errors (test/core/graph-parity.test.ts)
- **Checkpoint:** US-2 is demoable: the graph over this repo's real specs matches today's `analyze`.

**Verify:** `npm test -- graph-syntax graph-parity` passes. ✓ passed

## Phase 5 — User story US-3  (priority: P1)

- [x] [T040] [P] [US3] Implement `toText`, `toJson` (with `version: 1`) and `toMermaid` (one subgraph per feature, dashed blocked-by, arrows between subgraphs for feature edges) (src/core/graph-format.ts)
- [x] [T041] [P] [US3] Implement `scopeToFeature(graph, ref)`: the feature plus direct neighbors in both directions (src/core/graph-scope.ts)
- [x] [T042] [US3] Add `GraphCommand` (`ambykit graph [feature] [--json] [--mermaid]`): no-specs message, broken/cycle listing first, exit 1 when any (src/cli/graph.ts)
- [x] [T043] [US3] Register the command in the CLI registry and help (src/cli/index.ts)
- [x] [T044] [P] [US3] Test formatters: text readable, JSON shape and stability, Mermaid structure and edge parity, feature scoping (test/core/graph-format.test.ts)
- [x] [T045] [US3] E2E test of the command: all three formats, a feature argument, broken and cyclic fixtures set a non-zero exit, empty project exits 0 (test/cli/graph.test.ts)
- [x] [T046] [P] [US3] Document `ambykit graph`, flags, exit codes and the JSON shape (docs/cli-reference.md)
- **Checkpoint:** US-3 is demoable: `ambykit graph`, `--json` and `--mermaid` work on this repo.

**Verify:** `npm test -- graph-format cli/graph` passes; paste the `--mermaid` output into a Mermaid renderer and confirm it draws the same edges (manual step: report as unverified if not done). ? unverified: the tests pass; the manual Mermaid render was not done.

## Phase 6 — User story US-4  (priority: P1)

- [x] [T050] [P] [US4] Rebuild `analyzeGraph` on `buildGraph`; keep `resolveDepKey` as a re-export if other modules import it (src/core/analyze.ts)
- [x] [T051] [P] [US4] Rebuild `attentionItems` and drop private `resolveDep`/`cycleKeys` in favor of the graph, preserving 020's behavior (`task-blocked` items, blocked tasks dropped from 'Up next') (src/core/overview.ts)
- [x] [T052] [P] [US4] Story-detail reverse edges read from the graph instead of re-filtering `dependsOn` (src/cli/ui/dashboard/story-detail.ts)
- [x] [T053] [US4] Guard and agreement tests: the dependency regex exists only in `parseStories`; `analyze`, dashboard attention and `ambykit graph` name the same blockers for every story (test/core/graph-consumers.test.ts)
- **Checkpoint:** US-4 is demoable: change one dependency in a spec and `analyze` and the dashboard both reflect it.

**Verify:** the T001 goldens pass unchanged, `npm test -- graph-consumers` passes, and the full `npm test` shows no other regression. ✓ passed

## Phase 7 — User story US-5  (priority: P2)

- [x] [T060] [US5] Implement `buildable(graph)` and `blockersOf(graph, key)` with today's `analyze` rule (src/core/graph-paths.ts)
- [x] [T061] [US5] Implement `criticalPath(graph)`: longest not-done chain over the acyclic part, ties by lowest key (src/core/graph-paths.ts)
- [x] [T062] [US5] Test against hand-computed graphs: buildable set, critical path, a done story unblocking dependents, equal-length chains stable, cycles excluded (test/core/graph-paths.test.ts)
- **Checkpoint:** US-5 is demoable: buildable stories and the critical path match a hand-computed answer.

**Verify:** `npm test -- graph-paths` passes. ✓ passed

## Phase 8 — User story US-6  (priority: P2)

- [x] [T070] [P] [US6] Build the pure graph-view renderer as a plain text list: blockers, buildable, critical path, selected story (src/cli/ui/dashboard/graph-view.ts)
- [x] [T071] [P] [US6] Add the `g` entry to the help overlay (src/cli/ui/dashboard/help-overlay.ts)
- [x] [T072] [US6] Add the `graph` view to the interactive reducer: `g` opens, cursor moves, `return` jumps to the story's feature, `escape` returns (src/cli/ui/interactive/overview.ts)
- [x] [T073] [US6] Load graph-view and graph-paths only on the interactive path so one-shot and `--json` never import them (src/cli/dashboard.ts)
- [x] [T074] [P] [US6] Test the view: content, jump to feature, narrow and plain-text fallback (test/ui/dashboard-graph.test.ts)
- [x] [T075] [P] [US6] Extend the one-shot perf test: the graph view is not loaded and the 1-second budget holds (test/cli/dashboard-perf.test.ts)
- **Checkpoint:** US-6 is demoable: open `ambykit dashboard --interactive`, press `g`, select a story, jump to its feature.

**Verify:** `npm test -- dashboard-graph dashboard-perf` passes; note under Open decisions that the view still needs `/amby.design` sign-off. ✓ passed

## Phase 9 — Polish

- [x] [T090] [P] Add the single shared graph to the architecture notes and list `graph` in the README command table (docs/architecture.md, README.md)
- [x] [T091] Dogfood check (SC-005): run `ambykit graph 023` and confirm this feature's stories resolve with no broken edges and in dependency order (specs/023-dependency-graph/tasks.md)
- [x] [T092] Final gate: `npm run typecheck` and `npm test` pass, and every FR in the spec has at least one test (specs/023-dependency-graph/plan.md)

**Verify:** `npm run typecheck` and `npm test` pass; `ambykit graph` exits 0 on this repo. ✓ passed
