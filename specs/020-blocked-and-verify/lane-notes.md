# Lane evidence — 020 blocked-and-verify (SC-005)

Feature 020 was built with parallel lanes (`ambykit lane`), as the 1.4 gate requires.

## Lanes used

| Phase | Lanes | Tasks | Merge result |
| --- | --- | --- | --- |
| 4 (US-2) | 5 | T030–T034 | all 5 merged cleanly |
| 5 (US-3) | 3 | T041–T043 | all 3 merged cleanly |
| 6 (US-4) | 3 | T050–T052 | all 3 merged cleanly |
| 7 (US-5) | 3 | T061–T063 | 1 merged cleanly (T062); 2 conflicted in tasks.md (T061, T063), merged by hand |

14 lane tasks in 4 batches; 12 of 14 lane merges needed no manual step.
Phases 1–3 (setup, foundation, US-1) ran sequentially by design, as did the non-`[P]` test, prompt and integration tasks.

## Manual conflict resolution: caused by this feature's convention

The 2 conflicts were in `specs/020-blocked-and-verify/tasks.md`, not in code. While the phase-7 lanes were running,
the feature checkout recorded results on `**Verify:**` lines and ticked tests (T044, T053, T054, T060, T062). Those
edits sit on lines next to the lanes' check-off lines (T061, T063), so git saw overlapping hunks and the check-off-aware
merge could not take the lane's tick. Resolution: keep the feature side, tick the lane's task.

Conclusion: SC-005 is only partly met. The rule that follows from it: record Verify result suffixes in the feature
checkout after the lane merge of that phase, not while lanes for the neighbouring phase are open; or teach
`mergeCheckoffs` to take a lane's check-off when adjacent lines also changed.

## Other findings about the lane tooling (not caused by 020)

- `ambykit lane merge <feature> --dry-run` performed a real merge (merge commits were created for lanes 4-1 to 4-5).
- Lane worktrees get no `node_modules`; each needed a manual link before tests could run.
- `lane.json` lists `changelog.md` in lowercase for T063 while the file is `CHANGELOG.md` (works on Windows only).
- Lane worktrees are created inside the feature worktree (`<feature>/.worktrees/<feature>.lane-N-K`).
- `ambykit` on PATH was the installed 1.3.1, not the lane's source; lane work must call `node dist/cli/index.js`.
- `test/cli/update.test.ts` runs `UpdateCommand` against the repo root when no `cwd` is given, and rewrites
  `.claude/commands/amby.{implement,tasks}.md` and `.agents/skills/amby-{implement,tasks}/SKILL.md`.
