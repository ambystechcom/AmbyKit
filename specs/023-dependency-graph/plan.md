---
feature: 023-dependency-graph
status: draft
created: 2026-11-16
---

# Implementation Plan — Shared dependency graph

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`.
> Reference spec by ID — it is not restated here.

## Technical context

- **Stack:** TypeScript, Node ≥ 20, ESM (`.js` extensions in relative imports), Vitest. No new dependency.
- **Key libraries:** none new. Reuses `readFeatures` (`src/core/features.ts`), `FeatureSnapshot`
  (`src/core/overview-types.ts`), `StoryProgress` and `parseStories` (`src/core/dashboard.ts`), `BaseCommand`
  (`src/cli/base-command.ts`), and the interactive reducer in `src/cli/ui/interactive/overview.ts`.
- **Constraints driving choices:**
  - Pure core, side effects at the edges (AGENTS.md; Principle 2): the graph is a pure function of
    `FeatureSnapshot[]`; the only filesystem read stays `readFeatures`.
  - Zero model tokens, 1-second one-shot budget (Principle 3): no cache or stored graph file (spec out of scope).
  - Additive in 1.x: today's syntax and today's `analyze` findings must not change (FR-003, FR-017, SC-002).
  - Every FR maps to a test (Principle 5); dogfood (Principle 6): this feature's own stories are ordered by its own graph (SC-005).
  - No prompt or template change, so no `ambykit sync` regeneration (FR-018 is satisfied by absence; see Risks).

## Architecture

Today the story *reader* is single (`parseStories` in `src/core/dashboard.ts`), but dependency *resolution*
(bare vs `NNN:US-#`, dangling check, cycle DFS, blocked/buildable) is implemented twice:
`analyzeGraph` in `src/core/analyze.ts` and `attentionItems`/`cycleKeys`/`resolveDep` in
`src/core/overview.ts`. This feature moves that logic into one pure module and makes both delegate to it.

```
readFeatures (fs edge, existing) ─► FeatureSnapshot[]
                                        │
                                        ▼
                         buildGraph(features)   src/core/graph.ts        (pure, deterministic)
                                        │ DependencyGraph
        ┌───────────────┬───────────────┼───────────────┬──────────────────┐
        ▼               ▼               ▼               ▼                  ▼
  analyzeGraph    attentionItems   graph-paths.ts   graph-format.ts   (later: run, MCP)
  (analyze.ts)    (overview.ts)    buildable,       text/json/mermaid
                                   critical path    + graph-scope.ts
                                        │                 │
                                        ▼                 ▼
                          interactive graph view     `ambykit graph` (BaseCommand)
                          (graph-view.ts, lazy)       src/cli/graph.ts
```

Components:

- `src/core/graph-types.ts` — `DependencyGraph`, `StoryNode`, `StoryEdge` (`kind: "depends-on" | "blocked-by"`),
  `FeatureEdge` (with the causing story edges), `BrokenEdge` (`reason: "unknown-story" | "unknown-feature"`),
  `GraphCycle`.
- `src/core/graph.ts` — `buildGraph(features)`: nodes keyed `featureRef:USn` (the existing `StoryProgress.key`),
  edges resolved by one `resolveDependency`, derived feature edges, broken edges, cycles (single DFS that
  reports the IDs in each cycle, including a self-dependency). All collections sorted by key, so the result
  does not depend on directory order (FR-006).
- `src/core/graph-paths.ts` — `buildable(graph)`, `blockersOf(graph, key)`, `criticalPath(graph)`.
- `src/core/graph-scope.ts` — `scopeToFeature(graph, ref)`: the feature plus direct neighbors (FR-009).
- `src/core/graph-format.ts` — pure `toText`, `toJson`, `toMermaid` (strings only).
- `src/cli/graph.ts` — `GraphCommand extends BaseCommand` (Principle 2): reads features, builds, scopes,
  formats, sets exit status. Registered in `src/cli/index.ts`.
- `src/cli/ui/dashboard/graph-view.ts` — pure renderer for the interactive view; `overview.ts` reducer gains
  a `graph` view reached by the `g` key.

**Edge semantics decided in the plan** (spec silent or ambiguous; all recorded under Open decisions):
a dependency written in both `depends-on` and `blocked-by` yields one edge per kind; feature edges are derived
from both kinds; mutual feature edges without a story cycle are valid and shown, not reported as errors; a
reference to a feature that exists but has no stories is a broken edge of reason `unknown-story`.

**Performance:** `buildGraph` is O(stories + edges) over already-read snapshots; critical path is a memoized
longest-path over the acyclic part (nodes on cycles excluded). Neither adds a file read. The graph *view*
(`graph-view.ts`, `graph-paths.ts`) is imported only from the interactive path (FR-015).

## Phased approach

- **Phase 0 — Research:** none beyond reading the two existing implementations. The one risk it must close is
  behavior drift, so Phase 2 starts by recording characterization goldens of today's `analyzeGraph` and
  `attentionItems` before any refactor. No `research.md`.
- **Phase 1 — Foundation:** goldens + `contracts/graph-json.md` (the `--json` shape, FR-008) + `graph-types.ts`.
- **Phase 2+ — Stories, in priority then dependency order:** US-1 core build → US-2 syntax parity → US-3
  command and formats → US-4 consumers delegate → US-5 buildable and critical path → US-6 interactive view →
  polish (docs, dogfood check).
- **Lanes (parallel work, per spec 015):** after US-1, three disjoint lanes can run at once: US-2 tests
  (`test/core/graph-syntax.test.ts`, `graph-parity.test.ts`), US-4 refactors (`src/core/analyze.ts`,
  `src/core/overview.ts`, `story-detail.ts`) and US-5 (`src/core/graph-paths.ts`). US-3 needs US-1 and US-2;
  US-6 needs US-3 and US-5.
- **Build order:** 023 builds AFTER 020: 020 T031 adds `task-blocked` items and drops blocked tasks from 'Up next'
  in `attentionItems`, and 023 T051 rebuilds that function on `buildGraph`, so T051 preserves 020's behavior and T001
  records its goldens from the 020 tip. Downstream: 023 must land before 025's stateful tools (025 T020 imports
  `buildable`/`blockersOf`).
- **Shared hotspot files:** rebase and merge by hand, different lines only (src/cli/index.ts, src/core/config.ts,
  src/core/types.ts, docs/cli-reference.md, CHANGELOG, docs/workflow.md, docs/tool-compatibility.md, README.md).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001, US-1 | `buildGraph(features)` in `src/core/graph.ts`: pure, no fs, no mutation of input |
| FR-002 | Feature edges derived from cross-feature story edges; each carries its causing story edges |
| FR-003, US-2 | One `resolveDependency` reusing the existing canonical-id and `NNN:US-#` rules from `analyze.ts`/`overview.ts`; kind kept on every edge |
| FR-004 | `broken[]` lists both ends and a reason; nothing is dropped |
| FR-005 | One DFS reports each cycle as an ordered ID list; self-dependency is a cycle of one |
| FR-006 | All arrays sorted by key; determinism test shuffles input order |
| FR-007, US-3 | `GraphCommand` + `graph-format.ts`: text default, `--json`, `--mermaid`; no model call |
| FR-008 | `contracts/graph-json.md` plus `version: 1`; fields only ever added |
| FR-009 | `scopeToFeature`: feature + direct neighbors over feature edges, both directions |
| FR-010 | Command exits 1 when `broken` or `cycles` is non-empty and lists them first |
| FR-011, US-4 | `analyzeGraph` and `attentionItems` rebuilt on `buildGraph`; a guard test asserts the dependency regex lives only in `parseStories`; scheduler and MCP consume the exported API (they arrive in specs 028, 025) |
| FR-012, US-5 | `buildable(graph)`: not-done stories whose depends-on and blocked-by targets are all done (today's `analyze` rule, kept identical) |
| FR-013 | `criticalPath(graph)`: longest not-done chain, ties broken by lowest key, stable |
| FR-014, US-6 | `graph-view.ts` + reducer `g` key: blockers, buildable, critical path, jump to feature |
| FR-015 | View and `graph-paths` imported lazily from the interactive path; one-shot and `--json` never touch them; perf test |
| FR-016 | The view is a plain text list by construction; narrow/plain terminals use it unchanged (no box drawing required) |
| FR-017, SC-002 | Characterization goldens recorded before refactor, asserted unchanged after |
| FR-018 | No prompt or template text is added; nothing to emit per tool (recorded as satisfied by absence) |
| SC-001 | Perf test builds the graph over the repo's specs and a synthetic 200-feature fixture under budget |
| SC-003 | Agreement test: `analyze`, dashboard attention and `ambykit graph` name the same blockers for every story in the fixtures |
| SC-004 | Test per FR listed in `tasks.md`; `npm run typecheck` and `npm test` pass |
| SC-005 | Polish task runs `ambykit graph` on this feature and checks no broken edges |

## Risks & decisions

- **Behavior drift in the refactor** (analyze and attention are shipped, tested behavior) → goldens first
  (T001), refactor tasks gated on them (Principle 5).
- **Hidden second implementation of resolution** (`resolveDepKey` is exported from `analyze.ts`; `resolveDep`
  is private in `overview.ts`) → keep `resolveDepKey` as a thin re-export so other callers keep compiling, then
  remove it only if no importer remains.
- **Mermaid validity** (FR-007) cannot be checked without a mermaid parser, and adding one is a dependency we
  will not take (Principle 3 spirit) → structural tests for the syntax we emit, plus one manual render check
  recorded as an unverified Verify step.
- **UI design not signed off** (no `ui.md`): the view is built from US-6's acceptance criteria only, as a
  minimal text list. Spec 032 later restyles it, and the spec says this feature must not depend on 032.
- **FR-011 for the scheduler and MCP** cannot be verified in this feature because those consumers do not
  exist yet; this feature delivers the exported API and the single-parser guard, and specs 028 and 025 own
  their side.
- **Docs:** `docs/cli-reference.md` gets the `graph` entry and the JSON shape; `docs/architecture.md` notes the
  single graph (Principle 6 keeps docs in the repo).

## Open decisions

1. **Duplicate dependency in both `depends-on` and `blocked-by`.** Default: one edge per kind, both kept; blocking wins for status. Change if a single merged edge is preferred.
2. **Feature edges derived from `blocked-by` as well as `depends-on`.** Default: yes, both.
3. **Mutual feature edges with no story cycle.** Default: valid, shown in text and JSON, never an error.
4. **Reference to an existing feature with no stories.** Default: broken edge, reason `unknown-story`.
5. **`ambykit graph` source of specs.** Default: the specs visible from the working checkout (matches the spec's worktree edge case); the dashboard passes its multi-checkout snapshots.
6. **Interactive view needs `/amby.design` sign-off.** Default: ship a minimal text-list view from US-6's acceptance criteria; revisit after design or at spec 032.
7. **Key binding for the view.** Default: `g` from the overview, `escape` returns; check against the help overlay for conflicts.
8. **Mermaid shape.** Default: one subgraph per feature, solid arrows for `depends-on`, dashed for `blocked-by`, thick arrows between subgraphs for feature edges.

## Requirement → test (final gate, T092)

| Requirement | Test |
|---|---|
| FR-001, FR-002 | `test/core/graph.test.ts` (build, derived feature edges, no mutation) |
| FR-003 | `test/core/graph-syntax.test.ts` |
| FR-004, FR-005 | `test/core/graph.test.ts` (broken edges, cycles, self-dependency) |
| FR-006 | `test/core/graph.test.ts` (determinism under shuffled input) |
| FR-007 | `test/core/graph-format.test.ts`, `test/cli/graph.test.ts` |
| FR-008 | `test/core/graph-format.test.ts` (versioned shape), `contracts/graph-json.md` |
| FR-009 | `test/core/graph-format.test.ts` (scope), `test/cli/graph.test.ts` |
| FR-010 | `test/cli/graph.test.ts` (non-zero exit on broken edges and cycles) |
| FR-011 | `test/core/graph-consumers.test.ts` (one parser, one resolver, agreement); the scheduler and MCP consumers belong to specs 028 and 025 |
| FR-012, FR-013 | `test/core/graph-paths.test.ts` |
| FR-014, FR-016 | `test/ui/dashboard-graph.test.ts` |
| FR-015 | `test/cli/dashboard-perf.test.ts` (budget and load guard) |
| FR-017, SC-002 | `test/core/graph-golden.test.ts`, `test/core/graph-parity.test.ts` |
| FR-018 | Satisfied by absence: no prompt or template text was added, so nothing is emitted per tool |
| SC-001 | `test/core/graph.test.ts` (200 features), `test/cli/dashboard-perf.test.ts` |
| SC-003 | `test/core/graph-consumers.test.ts`; note the dashboard names the highest-ranked kind of blocker, not every one |
| SC-005 | `ambykit graph 023`: all six stories resolve with no broken edges |
