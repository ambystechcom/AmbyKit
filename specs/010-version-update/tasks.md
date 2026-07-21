---
feature: 010-version-update
created: 2026-07-20
---

# Tasks — Outdated-version warning + `update` command

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Derived from `plan.md` (phases 2–5 = US-1→US-4). UI is signed off in `ui.md`; tokens in
> `design-tokens.json`; interfaces in `contracts/version.md`; decisions in `research.md`.

## Phase 1 — Setup

- [x] [T001] Add box-drawing glyph pairs (box-tl/-tr/-bl/-br/-h/-v, {u,a}) to the glyph set (src/cli/ui/theme.ts)
- [x] [T002] [P] Add `VersionCache` type + user-cache path constant (`~/.ambykit/version-cache.json`) (src/core/types.ts, src/cli/version-check.ts)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Implement `core/version.ts`: `installedVersion`, `isDevPlaceholder`, `compareVersions`, `isOutdated` (src/core/version.ts)
- [x] [T011] [P] Unit tests for version compare / isOutdated / dev-placeholder (test/core/version.test.ts)
- [x] [T012] Replace the hard-coded `"0.0.0"` version constants with `installedVersion()` (src/cli/index.ts, src/cli/init.ts)
- [x] [T013] Implement `version-check.ts`: `latestFromCache`, `cacheIsStale`, `refreshLatest` (registry fetch + timeout + cache write) (src/cli/version-check.ts)
- [x] [T014] [P] Unit tests: cache read/TTL/stale, refresh timeout & failure → null, never throws (test/cli/version-check.test.ts)
- [x] [T015] Implement `projectAtCwd(cwd)` — `.amby/` AND `specs/` at the invocation dir (not walk-up) (src/core/paths.ts)
- [x] [T016] [P] Implement `versionWarning` callout renderer (box + ascii/mono/suppressed states) per ui.md/tokens (src/cli/ui/callout.ts)
- **Checkpoint:** pure `version.ts` + cache + callout renderer + `projectAtCwd` green; no command wiring yet.

## Phase 3 — User story US-1 — Outdated-version warning  (priority: P1)

- [x] [T020] [US1] Add `preamble()` hook to `BaseCommand`; move init's banner into `preamble()` (src/cli/base-command.ts, src/cli/init.ts)
- [x] [T021] [US1] In `run()`: after preamble, print `versionWarning` gated on `caps.isTTY && !--json`; best-effort refresh when cache stale (src/cli/base-command.ts)
- [x] [T022] [P] [US1] Renderer tests: outdated shows both versions; current/dev/null suppressed; ascii + monochrome degradation (test/cli/ui/callout.test.ts)
- [x] [T023] [P] [US1] Integration test: warning sits between preamble and content; suppressed on non-TTY and `--json` — incl. a `dashboard --json` case asserting byte-clean JSON (gate is in `run()` before `execute()`) (test/cli/version-warning.test.ts)
- **Checkpoint:** US-1 demoable — a stale install shows the yellow callout; clean/`--json`/non-TTY runs don't.

## Phase 4 — User story US-2 — `update` upgrades the CLI  (priority: P1)

- [x] [T030] [US2] Create `UpdateCommand` (BaseCommand, `requiresProject=false`): compare `installedVersion()` vs `refreshLatest()` (src/cli/update.ts)
- [x] [T031] [US2] Outdated → `spawnSync npm i -g @ambystech/ambykit@latest`; on success stop + instruct re-run (no re-exec) (src/cli/update.ts)
- [x] [T032] [US2] Install failure (npx/EACCES) → print exact command, leave install intact (FR-011) (src/cli/update.ts)
- [x] [T033] [US2] Register `update` in the command registry + help (src/cli/index.ts)
- [x] [T034] [P] [US2] Tests (mock spawn): outdated→install attempted + re-run message; failure→prints command (test/cli/update.test.ts)
- [x] [T035] [P] [US2] Test: the callout (US-1) and `update` read "latest" from the same `version-check.ts` — they never disagree (FR-012) (test/cli/version-check.test.ts)
- **Checkpoint:** US-2 demoable — `ambykit update` upgrades the CLI or prints the manual command.

## Phase 5 — User story US-3 — `update` refreshes project prompts  (priority: P1)

- [x] [T040] [US3] CLI current → if `projectAtCwd(cwd)` then `buildEmittedFiles`+`applyFiles` refresh (sync pipeline) (src/cli/update.ts)
- [x] [T041] [US3] Outside a project (no `.amby/`+`specs/` at cwd) → skip refresh, report accordingly (src/cli/update.ts)
- [x] [T042] [P] [US3] E2E: stale in-project prompts refreshed & `check` stays green; outside-project skips refresh (test/cli/update.test.ts)
- **Checkpoint:** US-3 demoable — re-running `update` on a current CLI refreshes the project's tool files.

## Phase 6 — User story US-4 — Reporting + `upgrade` alias  (priority: P2, depends US-2, US-3)

- [x] [T050] [US4] Result reporting: updated line / refresh summary / exact `Everything is up to date` (src/cli/update.ts, src/cli/base-command.ts)
- [x] [T051] [US4] Remove the former `upgrade` command; `update` is the sole update command (FR-014) (src/cli/index.ts, src/cli/upgrade.ts removed)
- [x] [T052] [P] [US4] Tests: nothing-to-do prints the exact string `Everything is up to date` (test/cli/update.test.ts)
- **Checkpoint:** US-4 demoable — clear outcomes incl. "Everything is up to date"; `upgrade` removed.

## Phase 7 — Polish

- [x] [T090] Document `update` (and the deprecated `upgrade`) + the outdated-version warning; note the two-step flow when outdated (run `update` to upgrade the CLI, then run it again to refresh prompts) (docs/cli-reference.md, README.md)
- [x] [T091] [P] Mirror on the dev site; ensure the docs-sync verb check lists `update` (site/src/content/docs/cli/index.mdx)
- [x] [T092] `npm run typecheck` + `npm test` green; docs-sync green. (No `ambykit sync` needed — feature 010 adds CLI code only, no prompts/templates, so nothing new is emitted.) (repo root)
