# Research — 014 Enhanced dashboard

Decisions referenced from `plan.md` as R-#.

## R-1 — Counting open clarifications (FR-010)

- **Problem:** every spec carries the template line ``Flag unknowns inline as `[NEEDS CLARIFICATION: …]` ``,
  and specs may mention the marker in prose (this spec does, three times, all in backticks).
- **Decision:** count `[NEEDS CLARIFICATION:` occurrences that are **outside** inline code spans
  (backtick-delimited) and fenced code blocks. Capture the line number and the text up to `]`.
- **Rejected:** counting every occurrence (each spec would show ≥ 1); requiring a line prefix
  (markers are legitimately inline, per the specify prompt).
- **Check:** this repo's `specs/014-enhanced-dashboard/spec.md` must count 0.

## R-2 — Burndown history from git (FR-018, SC-003)

- **Decision:** two processes, both read-only, via `src/core/git.ts`:
  1. `git log --format=%H%x09%ct --name-only -- "specs/*/tasks.md"` (scope narrowed to one feature
     under `--feature`) → commits with timestamps and the tasks paths they touched.
  2. Pick, per period, the last commit at or before the period end; request `<sha>:<path>` for every
     tasks path known so far through one `git cat-file --batch` (stdin), parse with `parseTasks`.
     A `missing` reply means the file did not exist at that commit.
  The final point is the working tree (already parsed by `readFeatures`).
- **Measured on this repo (git 2.56, 2026-10-18):** `git log` 12 ms (17 commits touch tasks files);
  600 `cat-file` requests ≈ 0.29 s including shell overhead. Worst case for SC-003 (≤ 45 periods ×
  30 features = 1,350 blobs) stays well under 1 s.
- **Rejected:** `git show` per commit×file (one process per blob — too slow); replaying `git log -p`
  diffs (fragile parsing, renames); new timestamp metadata in `tasks.md` (spec assumption: no new
  metadata).
- **Period choice:** finest of daily/weekly(ISO, Monday)/monthly whose count ≤ `floor(plotWidth/2)`;
  if monthly still exceeds, keep the most recent periods. Fewer than `limit.burndown-min-points`
  periods with data → no-history.

## R-3 — Truecolor and terminal background (ui.md tokens)

- The 014 tokens resolve `truecolor.dark | truecolor.light → ansi16 → none`. `Capabilities` today
  only has `color`.
- **Decision:** add `truecolor: boolean` (`color && COLORTERM ∈ {truecolor, 24bit}`) and
  `background: "dark" | "light"` (`COLORFGBG` last field: 7 or 15 → light; anything else or unset →
  dark, as the tokens' `$note` specifies). Both injectable through `detectCapabilities` for tests.
- **Uncertainty (Principle 4):** `COLORTERM` and `COLORFGBG` are de-facto conventions, not
  standards; no portable query exists without terminal round-trips (rejected: OSC 11 query needs
  async raw-mode IO in one-shot output). Wrong guesses fall back to readable colors because every
  semantic color meets AA on its target background and meaning never depends on color (FR-006).

## R-4 — Up-next cap (FR-009, ui.md US-4)

- **Decision:** `--next=N` flag (positive integer; invalid → error message, exit 1). Default from
  `limit.up-next-max` (5).
- **Rejected:** a `.amby/config.json` key — adds schema surface for a view preference; can be added
  later without breaking the flag.

## R-5 — `--json` compatibility (FR-012, SC-005)

- `test/cli/dashboard-json.test.ts` asserts `--json` output equals
  `JSON.stringify(computeDashboard(root), null, 2)` — a bare array. FR-012 asks for aggregates
  "alongside" existing fields; a JSON array cannot carry them without changing its type, which
  breaks existing consumers and SC-005.
- **Decision:** bare `--json` unchanged. `--json --overview` emits the object in
  `contracts/dashboard-json.md`, whose `stories` member is exactly today's array.
- **Resolved:** FR-012 amended at clarify (2026-10-18).
