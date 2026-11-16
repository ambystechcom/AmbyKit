# Data model — 015 Parallel lanes

All of these types are pure data. Definitions live in `src/core/dashboard.ts` (`TaskLine`) and
`src/core/lanes.ts` (everything else).

## TaskLine (extended)

| Field | Type | Notes |
|---|---|---|
| id, done, story, description | existing | Unchanged (014/017 consumers unaffected) |
| phase | number | N from `## Phase N`; else the `##` ordinal; 0 before any heading |
| parallel | boolean | `[P]` present |
| paths | string[] | Normalized (see below); empty when none or invalid |
| pathIssue | `"missing" \| "glob"` | Optional; set when `paths` is empty |

**Normalized path:** `\` becomes `/`, then `./`, a trailing `/` and doubled `//` are removed, then the
path is lower-cased. **Overlap:** `a === b || b.startsWith(a + "/") || a.startsWith(b + "/")`.

## LaneConflict

`{ feature, phase, path, tasks: string[] }`

- `path` is the shortest overlapping path.
- `tasks` is sorted and holds at least two ids, at least one of them `[P]`.
- Only open tasks count, and only within one phase.

## Declaration

`{ feature, task, issue: "missing" | "glob" }`: open tasks only. This is a warning and never affects
the exit code.

## LanePlan

```
{ feature, phase,
  status: "planned" | "complete" | "conflict" | "no-parallel",
  lanes: [{ name, index, tasks: [{ id, paths }] }],   // name = `${feature}.lane-${phase}-${index}`
  stays: string[],                                     // open non-[P] task ids of the phase
  conflicts: LaneConflict[] }
```

Invariants:

- Each lane's tasks are pairwise path-disjoint and disjoint from every other lane's tasks. This
  follows from having no conflicts.
- `lanes.length = min(n, open [P] count)`.
- Tasks are dealt in task order (round-robin).

## LaneManifest — `<lane>/.amby/lane/lane.json` (self-ignoring dir)

`{ version: 1, feature, phase, lane, base /* feature branch */, tasks: [{ id, paths }] }`

## LaneCheckout (from resolveCheckouts)

`{ feature, name, phase, index, checkout: Checkout /* kind "lane" */, manifest: LaneManifest | null }`

- `Checkout.kind` widens to `"main" | "worktree" | "lane"`.
- A lane's `stale` flag means merged into the feature branch (not the base branch).

## LaneView (on FeatureSnapshot.lanes, JSON `lanes`)

`{ name, phase, index, done, total, state: "clean" | "dirty" | "merged", drift: string[] }`

- `done` and `total` count the manifest's tasks in the lane's own `tasks.md`.
- `drift` lists the ids that are missing or whose paths changed versus the feature's `tasks.md`.
- The field is absent when the feature has no lanes, so the JSON is byte-identical to today.

## Merge — mergeCheckoffs(base, ours, theirs)

- The function returns `string | null`.
- It strips each line's checkbox state, then compares. If ours and theirs differ in any other way, it
  returns `null`.
- Otherwise it returns ours, with `[x]` wherever ours or theirs is ticked, preserving ours' line
  endings.
