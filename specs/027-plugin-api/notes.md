# Build notes — 027 plugin API

Evidence and decisions recorded while building (not part of the spec contract).

## How it was built

Sequentially in one worktree, no parallel lanes, so there is no lane evidence for 027 (SC-005-style).
Phases 1–10, 63 tasks; none skipped. Integration steps are left to the batch: the golden re-record and
`ambykit sync` (019's `amby.run` and `amby-worker` files), so phases 2, 8 and 10 Verify are `? unverified`.

## SC-003 evidence (no plugins, unchanged output)

All 18 targets emitted with MCP enabled (183 files) hash identically for this branch and for 019's tip
(`019-amby-run-prompt`), when both commits are built from `git archive` (LF blobs). Built straight from
the two working copies the hashes differ only because `core.autocrlf` checked this worktree out with CRLF
in 019's new prompt files, which changes the TOML string form; that is a checkout artifact, not a change.
`test/plugins/no-plugins-regression.test.ts` also fails if the loader is imported when no plugin is listed.

## Deviations from the plan

- `update` and the interactive `add` picker also load plugins (`src/cli/update.ts`, `tool-options.ts`).
  Not in the task list; without it a plugin target would never refresh on `update`.
- `MOVED_TARGETS` is empty: no official plugin package exists, so inventing package names would be wrong.
  Tests inject a map.
- `matrix-rows.json` (an array, one row per target) rather than the single `matrix-row.json` in the plan,
  because the worked example ships three targets. The kit takes one row per call.
- The testkit also exports `createPluginApi` so a plugin's own tests can call its factory.
- The path guard is `src/core/path-guard.ts`, shared by `emit.ts` and the kit.
- `docs/plugin-split.md` records churn from git history only; demand evidence is "not collected"
  (no telemetry, Principle 7).

## Known gaps

- Dashboard agent detection (`agents.ts`) reads built-in ids only; plugin targets are not detected.
- `ambykit init` does not load plugins (a new project has none listed).
- Plugin targets are not covered by the 019 `supportsSubagents` list: they get the "no subagents" text.
- FR-015 and US-6 are deferred (marked `uncovered:` in the spec).
