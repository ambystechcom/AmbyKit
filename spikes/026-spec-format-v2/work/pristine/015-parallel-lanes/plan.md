---
feature: 015-parallel-lanes
status: ready
created: 2026-10-26
---

# Implementation Plan — Parallel lanes — file ownership and conflict-free concurrent execution

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`. Spec is
> referenced by ID, not restated. No `ui.md`: the output reuses 012's `worktree list` table and
> 017's WORKTREES & AGENTS panel row grammar and tokens (no new glyphs or colors).

## Technical context

- **Stack:** Node ≥ 20, TypeScript ESM (NodeNext), Vitest. **No new runtime dependencies.**
- **Isolation:** git worktrees through the existing `git.ts` helpers and 012's `.worktrees/` layout.
- **Constraints:**
  - **P1:** lane membership is derived from `tasks.md` alone. The path convention is authored once,
    in `src/prompts/tasks.md` and `src/templates/tasks.md`, then emitted by `ambykit sync`.
  - **P2:** `ambykit lane` is a `BaseCommand` subclass. All decisions are pure functions in
    `src/core/lanes.ts`, mirroring how 012 splits `core/worktree.ts` from `cli/worktree.ts`.
  - **P3:** analysis runs locally at zero model tokens. The prompt changes are one line each.
  - **P7:** lanes require `"worktrees": true` in `.amby/config.json`. Lane manifests sit in a
    self-ignoring directory, and nothing is written to the user's root `.gitignore` beyond 012's
    existing `.worktrees/` rule.
  - **SC-005:** analysis is O(open tasks × paths) on parsed text, with no git and no fs beyond reading
    `tasks.md`.

## Architecture

```
tasks.md ──parseTasks (extended)──▶ TaskLine{phase, parallel, paths, pathIssue}
                                         │
            ┌────────────────────────────┼─────────────────────────────┐
            ▼                            ▼                             ▼
  laneConflicts(tasks)          planLanes(tasks, phase, n)     mergeCheckoffs(base, ours, theirs)
  (pure, core/lanes.ts)         (pure, core/lanes.ts)          (pure, core/lanes.ts)
            │                            │                             │
  `ambykit analyze` (exit 1)     `ambykit lane` create/list/remove/merge (cli/lane.ts, git edges)
                                         │
                       .worktrees/<feature>.lane-<phase>-<n>/  + .amby/lane/lane.json
                                         │
                 resolveCheckouts → lanes per feature → dashboard (017 panel, JSON, plain)
```

- **Parsing** (`src/core/dashboard.ts` `parseTasks`, extended; existing fields are unchanged, so 014
  and 017 are unaffected):
  - Each task gains `phase`, the N of the nearest preceding `## Phase N` heading. If a heading has no
    number, its ordinal among `##` headings is used, and 0 is used before any heading.
  - It also gains `parallel` (a `[P]` marker) and `paths`.
  - Paths come from the **last** parenthesized group ending the line. That group is split on commas,
    backticks are stripped, and an item counts as a path when it has no spaces and contains `/` or
    `.`.
  - Globs (`* ? [ ] { }`) set `pathIssue: "glob"` (FR-016). No usable path sets
    `pathIssue: "missing"` (FR-002).
- **Normalization** (`normalizePath`): `\` becomes `/`, a leading `./` and any trailing `/` are
  dropped, `//` collapses, and the result is lower-cased.
  - Case-folding is unconditional, so a Linux CI run agrees with a Windows or macOS laptop. The
    trade-off is a rare false positive on Linux (`Foo.ts` versus `foo.ts`), which is the safe
    direction.
  - Two paths overlap when they are equal or one is a `/`-prefix of the other (FR-005). That check
    needs no knowledge of whether a path is a directory.
- **Conflicts** (`laneConflicts`):
  - Only **open** tasks are considered (FR-015), grouped by phase (FR-006).
  - A pair overlaps when at least one task is `[P]` (FR-004).
  - Findings are grouped **per overlapping path**: one finding lists every task id claiming that
    path, so a fully shared path yields one line rather than N² pairs.
  - The message names the ids and the path and ends with the fix: "sequence them (drop `[P]` or move
    one to a later phase)".
- **Lane planning** (`planLanes`, FR-008/017):
  - The target phase is `--phase`, or by default the first phase with open `[P]` tasks.
  - Conflicts refuse lane planning outright (FR-009).
  - Open `[P]` tasks are dealt round-robin into `min(n, count)` lanes in task order, with `n`
    defaulting to 2. The phase's open non-`[P]` tasks are listed as staying in the feature checkout.
  - A phase whose `[P]` tasks are all done reports "complete" and creates nothing (edge case).
  - Naming: lane `k` of phase `p` for feature `NNN-slug` is `NNN-slug.lane-p-k`, used for both the
    directory under `.worktrees/` and the branch.
  - The `.` keeps the name outside 012's `FEATURE_ID` pattern. That means 012/017 never mistake a lane
    for a feature, and the branch never collides with the feature branch's ref path (`NNN-slug/…`
    would).
- **Manifest:** `<lane>/.amby/lane/lane.json` holds `{ feature, phase, lane, base, tasks: [{ id,
  paths }] }`. It is written with a sibling `.gitignore` containing `*`, the same self-ignoring trick
  as 017's `.amby/activity/`.
  - The manifest drives the list, the drift check (FR-020) and the implement scope (FR-018).
- **Create** (`cli/lane.ts`):
  - Refuse when the repo is not git, or when `worktrees` is not true in config. The refusal names the
    setting and `ambykit init` (FR-011).
  - Resolve the feature branch: the branch of `.worktrees/<feature>` if that worktree exists, else a
    local branch named `<feature>`, else refuse with "create it with `ambykit worktree <feature>`".
  - For each planned lane, run `git worktree add -b <lane> .worktrees/<lane> <featureBranch>` and
    write the manifest.
  - An existing registered lane worktree means skip, which makes the command idempotent. `--dry-run`
    and `--json` behave as in 012.
- **List:** discover lanes with `laneWorktrees(root, worktreeList)`, the counterpart of
  `featureWorktrees`, which now **excludes** lane directories. For each lane, read its manifest and
  report:
  - its task counts, read from **the lane's own** `tasks.md`;
  - clean, dirty or merged (merged means the lane branch is merged into the feature branch, via
    `git branch --merged <featureBranch>`);
  - drift: a manifest id that is missing from the feature's current `tasks.md`, or whose paths
    changed (FR-010/020).
- **Remove:** `remove <feature> [<lane>] [--force]` reuses `planRemove` semantics. Dirty lanes are
  refused without `--force`, branches are kept, and no lane argument removes all of the feature's
  lanes.
- **Merge** (`merge <feature> [<lane>]`, FR-019):
  - Runs in the feature checkout, either the feature worktree or the primary checkout when that has
    the feature branch. The checkout must be clean.
  - For each lane, in order: `git merge --no-ff --no-commit <lane>`.
  - If the only unmerged path is `specs/<feature>/tasks.md`, read stages `:1:`/`:2:`/`:3:` and apply
    `mergeCheckoffs`. That returns ours with each task's box ticked if either side ticked it, or
    `null` when ours and theirs differ in anything but checkboxes. On success, `git add` and commit
    with `Merge lane <lane>`.
  - Any other conflict, or a `null` result, runs `git merge --abort` and reports it, leaving that lane
    for the user. Remaining lanes still proceed.
- **Current feature in a lane** (FR-018):
  - The rules region in `src/core/rules.ts` maps `.worktrees/NNN-slug.lane-p-k/` to `NNN-slug`.
  - `src/prompts/implement.md` gains one line: "If `.amby/lane/lane.json` exists, work only the task
    ids it lists."
  - `featureFromWorktreePath` learns the lane suffix, so `ambykit activity` and the dashboard
    attribute agents in a lane to the lane's feature.
- **Dashboard** (FR-012):
  - `resolveCheckouts` also returns `lanes: LaneCheckout[]`. Each lane's dirty and merged state joins
    the existing concurrent git batch, so the cost is one `status` per lane plus a `branch --merged
    <featureBranch>` per feature that has lanes.
  - `FeatureSnapshot.lanes` holds `{ name, phase, done, total, state, drift }`.
  - **A task counts done for the feature if it is checked in the feature checkout or in the lane that
    owns it.** Feature progress therefore moves while lanes are still unmerged, which stays consistent
    with SC-001 of 017 (the same numbers from any checkout).
  - Rendering:
    - The WORKTREES & AGENTS panel shows each lane as an indented sub-row under its feature,
      `↳ lane 3-1 · 2/3 · dirty` (ASCII: `> lane 3-1 · 2/3 · dirty`).
    - The plain layout adds an `  lane 3-1  2/3  dirty` line.
    - `--json --overview` adds `lanes` to the feature only when it has some.
  - With no lanes, every output is byte-identical to today, checked by the existing snapshots.
  - Lane checkouts join `allCheckouts`, so live watching and presence cover them.
- **Analyze:** `AnalysisReport` gains `lanes: { conflicts, declarations }`, where `declarations` lists
  missing and invalid paths. `ambykit analyze` prints a "Lane conflicts" block and exits 1 on
  conflicts (FR-007). It warns about declarations without changing the exit code (FR-002). `--json`
  carries both.

## Phased approach

- **Phase 0 — Research:** none needed. git's `--no-commit` merge, index stages and `branch --merged`
  are already used or documented. The decisions are recorded below.
- **Phase 1 — Foundation:** extend `TaskLine` and `parseTasks`, add `normalizePath` and overlap, and
  add the lane-name helpers in `core/lanes.ts`. → `data-model.md`
- **Phase 2+ — Stories:** US-1 (declarations plus prompts), then US-2 (conflicts plus analyze), then
  US-3 (the lane verb: create, list, remove, merge, and implement scope), then US-4 (dashboard).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `parseTasks` adds `parallel`, `paths` and `phase` |
| FR-002 | `pathIssue: "missing"`, surfaced as an analyze warning; the parse never throws |
| FR-003 | `src/prompts/tasks.md` step 4 and the `src/templates/tasks.md` header state the convention; sync |
| FR-004 | `laneConflicts`, grouped per path, at least one `[P]` |
| FR-005 | `overlaps()` prefix rule on normalized paths |
| FR-006 | Conflicts are computed within a phase only |
| FR-007 | `ambykit analyze` exits 1 on lane conflicts, as it does for cycles |
| FR-008 | `planLanes` reads `tasks.md` only; the manifest is derived output, not authored |
| FR-009 | `lane` create runs `git worktree add` per lane; refuses when `laneConflicts` is non-empty |
| FR-010 | `lane list` and `lane remove` (branch kept) |
| FR-011 | Config `worktrees: true` gate with an explanatory refusal |
| FR-012 | `FeatureSnapshot.lanes`, the panel sub-rows, plain and JSON output; unchanged without lanes |
| FR-013 | Pure core; no model calls (asserted by the perf test running offline) |
| FR-014 | `docs/workflow.md` "Parallel lanes", `docs/cli-reference.md` `lane`, site CLI page; docs-sync |
| FR-015 | Open-task filter applied before conflicts and declarations |
| FR-016 | Glob detection and `pathIssue: "glob"` |
| FR-017 | `planLanes` round-robin, `--lanes` (default 2), `--phase` |
| FR-018 | Manifest, implement prompt line, rules region, `featureFromWorktreePath` lane suffix |
| FR-019 | `lane merge` plus `mergeCheckoffs`; abort on any other conflict |
| FR-020 | Drift computed in `lane list` from the manifest against the current `tasks.md` |
| US-1…US-4 | Phases 3–6 of `tasks.md` |
| SC-005 | Perf test: a 200-task fixture through `laneConflicts` and `planLanes` in under 200 ms |
| SC-007 | Polish task: enable `worktrees` in this repo's config and run two 015 tasks in lanes |
| SC-009 | Test runs `analyzeProject` on this repo's own `specs/` and expects no lane conflicts |

## Risks & decisions

- **D1: lanes are per phase, dealt round-robin.** Phases in `tasks.md` are already per story, so
  grouping by story would give one lane per phase. Round-robin in task order is deterministic,
  explainable, and keeps a story's early tasks spread out. Users can tune it with `--lanes`.
- **D2: the merge helper exists because check-offs collide.** Lanes tick adjacent lines of the same
  `tasks.md`, and git treats adjacent hunks as a conflict. Without a checkbox-aware resolution, every
  lane merge would conflict, and "the merge is mechanical" would be false.
  - The rejected alternatives were a git merge driver and `.gitattributes` with `merge=union`. Both
    write repo config (P7), and union merging duplicates lines.
- **D3: the lane naming dot.** `NNN-slug.lane-p-k` is a valid ref and directory, sits outside
  `FEATURE_ID`, and cannot clash with the feature branch's ref path.
- **D4: case-insensitive comparison everywhere.** This trades a rare false positive for agreement
  across operating systems.
- **D5: lane progress counts toward the feature.** This goes beyond FR-012's per-lane counts. Without
  it, the feature row would show 0% while lanes are done, contradicting 017 US-1's "progress made in a
  worktree shows up from any checkout".
- **Risk: the done-union masks a lane reverting a check-off.** This is acceptable, because check-offs
  only move forward in the workflow.
- **Risk: SC-007 needs `worktrees: true` in this repo's config.** Turning it on also makes
  `/amby.specify` create worktrees for new features. That is intended for dogfooding, and is recorded
  in the polish task.
