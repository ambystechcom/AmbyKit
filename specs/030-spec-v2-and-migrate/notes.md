# Notes — 030 spec format v2 and migrate

Measurements and decisions recorded while building 030. Person tasks (T090, T091, T095) are recorded at the end and are still open.

## Dashboard budget with the v2 reader (T060, FR-022, SC-008, 026:R-8)

One-shot `dashboard` on AmbyKit's own specs (30 features, 161 stories, ~1,000 tasks), migrated to v2 in a temporary copy.
Median of 5 runs after a warm-up, on the build machine (Windows 11, Node 24):

| Run | 1.x original | v2 (migrated copy) | Budget |
|---|---|---|---|
| `dashboard` one-shot | 81 ms | 84 ms | 1000 ms |
| `dashboard --json --overview` | 88 ms | 105 ms | 1000 ms |

The v2 reader adds one YAML parse per spec and per tasks file: about 3 ms on the one-shot and 17 ms on the overview. Both are under a
tenth of the budget. `migrate` itself converts all 60 own files in about 370 ms.

## SC-001 readiness (T059): own specs migrate cleanly in a temporary copy

- `migrateProject` on a copy of `specs/` (30 features, 60 files): **60 converted, 0 unchanged, 0 skipped**; the second run **0 converted,
  60 unchanged**. The real tree is never written by the tests.
- `ambykit migrate --dry-run` on the real repo reports the same (60 to convert, 0 skipped, +3900 −1705 lines) and changes nothing (the
  `git status` output is identical before and after, no `*.migrate-tmp`).
- Stories, tasks (ownership, BLOCKED and DEVIATION markers) and phases (Verify check, result, reason) read to the **same model** for
  every feature before and after; `analyze --json`, `dashboard --json --overview`, the lane plan of every phase, the check-off merge, `tickTask`
  and `setStoryStatus` agree on the original and the copy; a half-migrated copy reads together (SC-005).

## Known differences between a 1.x file and its migrated form (documented over-promises of SC-003)

- **`UP NEXT` task lines lose their trailing `(file/path)`.** A 1.x task description ends with its ownership group; a v2 one never does (the
  group is data in the block, not prose), so the one-shot dashboard and `upNext.items[].description` in `--json --overview` show the
  description without it. Nothing else in the dashboard differs.
- **Nine `trailing-group-disagrees` warnings in `analyze`** on this repo's own specs (007 T030/T034, 009 T020, 010 T002, 013 T020/T050, 017
  T026/T044/T061): tasks whose prose ends in a path-like parenthetical (`(SC-002/003)`, `(x.y)`) before the real ownership group (026:F-4). The
  reader gets ownership right from the block and says once per task that the line ends in something path-shaped. They are warnings: they never
  change the exit status.

## Decisions taken while building (reversible)

- **`readSpecV1` / `readTasksV1`** are exported from the dispatcher only for `migrate`'s read-back (the "before" model); the guard test allows
  nothing else to import the 1.x parsers.
- **A tasks file with nothing to move still gets `format: 2`** so it is recognized as v2 (otherwise it would count as a 1.x file forever and be
  refused in 2.1).
- **`migrate` exits 0 even with skips**: it is a fixer, it names every skip and the fix, and a CI that wants a gate can run
  `migrate --dry-run` and read the summary. Reversible.
- **The legacy warning goes to `process.stderr` directly** (not `console.error`), so it never changes the text a command prints and the
  recorded-output tests of 020 and 030 stay valid.
- **`check` prints its own notice** (feature names) instead of the shared one-line warning; `migrate` and `mcp` print neither.
- **Docs for the two new verbs moved up from phase 8 (T082) to phase 6**, because registering the verbs makes `test/check-docs-sync.test.ts`
  fail until README, the CLI reference, the site CLI page and the `AGENTS.md` structure line mention them.
- **Node 22 in `package.json` and CI**: `engines` is `>=22`, the CI workflow drops the Node 20 steps and keeps one that asserts a Node 20 run exits
  non-zero with the required-version message. That step needs `dist/` built and runs after the build step.

## Not testable here

- A real Node 20: the launcher is tested in-process with a faked `process.versions.node` and a mocked `main.ts` (the CLI graph is never loaded).
  The CI step added in T046 runs the real thing on a Node 20 runner.

## Person tasks (open)

- **T090** — confirm with the release maintainer the 2.1 gate wording and that CI drops Node 20. *Done 2026-11-25 (owner):*
  - 2.1 gate wording (035 D-1): "2.1 stops reading 1.x once 2.0 has been out for the adoption window, `migrate` has had no open
    data-loss issue in it, and `docs/migration.md` documents the path." The window is at least 8 weeks and one 2.0.x patch (035 D-6).
  - Node 20 (034 D-1): CI builds and tests on Node 22 only; one Node 20 step stays as a negative check of the
    "Node.js 22 or newer" message.
- **T091** — assistant trial for SC-009 on two assistants. *Not done.*
- **T095** — dogfood migrate of AmbyKit's own `specs/`, after 031, 032 and every pending spec are merged. *Not done; this repo's specs are
  untouched.*
