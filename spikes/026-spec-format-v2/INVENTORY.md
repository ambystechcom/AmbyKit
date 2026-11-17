# Inventory — readers of status, depends-on, blocked-by, ownership and Verify (T003)

Every reader pattern-matches markdown text. Only three parsers do the matching; everything else calls
them. Line numbers are in this branch (release/1.4.0 base).

## The three parsers (the only places that pattern-match)

| Data | Parser | Where | How it reads |
|---|---|---|---|
| story id, title, priority | `parseStories` | src/core/dashboard.ts:87 (heading regex :93) | `^#{2,4} US-?\d+ [—–-] title`, `(priority: Pn)` in the title or `**priority:**` bullet |
| story status | `parseStories` | src/core/dashboard.ts:127 | `**status:**` regex anywhere on a line inside a story section |
| depends-on | `parseStories` | src/core/dashboard.ts:129 | `**depends-on:**` regex, list via `listValues` (:78) → `canonicalStoryId` (:74) |
| blocked-by | `parseStories` | src/core/dashboard.ts:131 | `**blocked-by:**` regex, same list parsing |
| task id/done/story/[P] | `parseTasks` | src/core/dashboard.ts:143 (task regex :146) | `- [ ]/[x] [T###] …`; phase number from nearest `##` heading (`phaseNumber`, src/core/markers.ts:103) |
| file ownership | `parseDeclaredPaths` | src/core/dashboard.ts:62 (called :169) | trailing `(a, b)` group of the task line, items filtered, glob/missing issues |
| BLOCKED / DEVIATION | `parseMarkers` | src/core/markers.ts:75 (called dashboard.ts:160) | keyword scan after the path group, code spans ignored |
| phase Verify line + result | `parsePhases` | src/core/markers.ts:142 | `**Verify:**` line per `##` phase, result suffix `✓ passed` / `✗ failed: …` / `? unverified` |

## Callers (they depend on the parsers' output, not on the markdown)

| Caller | File:line | Uses |
|---|---|---|
| `readFeatures` (overview, analyze, graph) | src/core/features.ts:44 (stories), :51 (tasks), :52 (verify) | parseStories, parseTasks, parsePhases |
| `computeDashboard` (bare dashboard, analyze graph) | src/core/dashboard.ts:217-219 | parseStories, parseTasks, applyTasks |
| `readProjectFeatures` per-worktree tasks | src/core/checkouts.ts:213 | parseTasks |
| burndown history (reads old tasks.md revisions via git) | src/core/burndown.ts:195 | parseTasks on historical bodies |
| lane planning and checks | src/cli/lane.ts:397, :411 (reads tasks.md from a branch via `git show`) | parseTasks |
| story detail view | src/cli/dashboard.ts:433 | parseTasks |
| analyze lane-conflict hint | src/core/analyze.ts:273 | parseDeclaredPaths |
| analyze missing-Verify hint text | src/cli/analyze.ts:87 | text only |
| graph / cross-feature refs | src/core/graph.ts:29 | canonicalStoryId |

## Readers that are not code (also depend on the markdown shape)

- `src/prompts/*.md` (implement, tasks, specify, converge, revise, tests): tell the assistant to patch
  `- **status:** …` bullets, check boxes, and the `**Verify:**` line in place. These are the largest
  consumers of the v1 shape and move with spec 030.
- `src/core/lanes.ts` `mergeCheckoffs` (:192): resolves a tasks.md merge conflict that differs only in
  check boxes; line-oriented, format-agnostic as long as the two sides have the same line count.
- Assistants reading raw markdown (outside AmbyKit): see spec edge case.
- Tests with literal tasks.md fixtures (test/**) and `test/fixtures/tasks-baseline-020.json`.
