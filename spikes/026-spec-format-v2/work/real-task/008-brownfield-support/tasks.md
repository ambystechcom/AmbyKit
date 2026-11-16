---
feature: 008-brownfield-support
created: 2026-07-20
---

# Tasks — Brownfield project support (non-destructive init & doc update)

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Derived from `plan.md` (phases 2–6 = US-1→US-5). Contracts in `contracts/merge.md`, entities in `data-model.md`.

## Phase 1 — Setup

- [x] [T001] Add `merge?: "overwrite" | "region"` (default overwrite) to `EmittedFile`
  ```yaml
  files: ["src/core/types.ts"]
  ```
- [x] [T002] [P] Add `skipped`/`aborted` reason buckets + backup paths to `WriteResult` shape
  ```yaml
  files: ["src/cli/fsops.ts"]
  ```
- [x] [T003] [P] `.amby/backups/` added to `.gitignore` + documented; tests use inline temp dirs (no fixtures dir needed)
  ```yaml
  files: [".gitignore"]
  ```

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Implement `findRegion` — parse `### AmbyKit usage` → next same/higher heading or EOF; throw on >1
  ```yaml
  files: ["src/core/merge.ts"]
  ```
- [x] [T011] Implement newline/trailing-newline normalization helper for region bytes
  ```yaml
  files: ["src/core/merge.ts"]
  ```
- [x] [T012] Implement `fingerprint(body)` hash excluding the fingerprint footer line
  ```yaml
  files: ["src/core/merge.ts"]
  ```
- [x] [T013] Implement `mergeRegion(existing, region)` returning `MergePlan` per data-model transitions
  ```yaml
  files: ["src/core/merge.ts"]
  ```
- [x] [T014] [P] Unit tests for findRegion/mergeRegion incl. idempotency + multi-region abort
  ```yaml
  files: ["test/core/merge.test.ts"]
  ```
- [x] [T015] Implement `buildAmbyRegion(ctx)` neutral region string with fingerprint footer, authored once
  ```yaml
  files: ["src/core/rules.ts"]
  ```
- **Checkpoint:** pure merge core + region builder green; no writer wiring yet.

## Phase 3 — User story US-1 — Init preserves existing agent docs  (priority: P1)

- [x] [T020] [US1] Branch `applyFiles` on `file.merge`; route `region` files through `mergeRegion`
  ```yaml
  files: ["src/cli/fsops.ts"]
  ```
- [x] [T021] [US1] Write timestamped backup to `.amby/backups/<name>.<ts>.bak` before modifying an existing file
  ```yaml
  files: ["src/cli/fsops.ts"]
  ```
- [x] [T022] [US1] Wrap each file write in try/catch → `aborted` + reason, no partial write
  ```yaml
  files: ["src/cli/fsops.ts"]
  ```
- [x] [T023] [US1] Emit shared AGENTS.md as `merge:"region"` using `buildAmbyRegion`
  ```yaml
  files: ["src/cli/emit.ts", "src/core/rules.ts"]
  ```
- [x] [T024] [US1] Claude emitter: emit region + ensure `@AGENTS.md` import at file top on merge
  ```yaml
  files: ["src/emitters/claude.ts"]
  ```
- [x] [T025] [US1] Update remaining emitters' rules files to `merge:"region"` per matrix
  ```yaml
  files: ["src/emitters/copilot.ts", "cursor.ts"]
  ```
- [x] [T026] [US1] Region-emitter tests: each rules file is `merge:"region"` with one fingerprinted region
  ```yaml
  files: ["test/emitters-region.test.ts"]
  ```
- [x] [T027] [P] [US1] E2E: merge over existing AGENTS.md/CLAUDE.md w/ sentinel — sentinel kept, region added
  ```yaml
  files: ["test/cli/brownfield-merge.test.ts"]
  ```
- [x] [T028] [P] [US1] E2E: no rules file → complete greenfield files written (FR-002)
  ```yaml
  files: ["test/cli/brownfield-merge.test.ts"]
  ```
- [x] [T029] [P] [US1] Regression: user-scope files untouched without `--include-user` (FR-012)
  ```yaml
  files: ["test/cli/brownfield-merge.test.ts"]
  ```
- [x] [T029b] [P] [US1] Edge-case tests: hand-edited region skipped, two-region abort, bridge re-added (FR-007/FR-008a/FR-011) (test/core/merge.test.ts, test/cli/brownfield-merge.test.ts)
- **Checkpoint:** US-1 demoable — `ambykit init`/`sync` no longer clobber existing rules files. ✅

## Phase 4 — User story US-2 — Update existing docs to reference AmbyKit  (priority: P1, depends US-1)

- [x] [T030] [US2] Idempotent re-run: region present + fingerprint match → splice in place, no duplicate
  ```yaml
  files: ["src/core/merge.ts"]
  ```
- [x] [T031] [US2] Fingerprint mismatch → `skippedRegions` + reason; surface backups/skips/aborts in CLI output
  ```yaml
  files: ["src/cli/fsops.ts", "src/cli/base-command.ts"]
  ```
- [x] [T032] [US2] Confirm `sync` is the update path (region-aware via shared `applyFiles`, multi-tool) — no new verb
  ```yaml
  files: ["src/cli/sync.ts"]
  ```
- [x] [T033] [US2] `.amby/backups/` lives outside the emitted set, so `check` stays green (verified in test)
  ```yaml
  files: ["src/cli/check.ts"]
  ```
- [x] [T034] [P] [US2] E2E: re-run sync twice → exactly one region (SC-002); hand-edited region skipped
  ```yaml
  files: ["test/cli/sync-brownfield.test.ts"]
  ```
- [x] [T035] [P] [US2] E2E: multi-tool project — every configured rules file gets native region (FR-006)
  ```yaml
  files: ["test/cli/sync-brownfield.test.ts"]
  ```
- **Checkpoint:** US-2 demoable — idempotent updates across tools, hand-edits respected, `check` in sync. ✅

## Phase 5 — User story US-3 — Detect brownfield vs greenfield  (priority: P2, depends US-1)

- [x] [T040] [US3] Implement `classifyProject(root)` — rules file / non-AmbyKit source / git-history signals
  ```yaml
  files: ["src/core/classify.ts"]
  ```
- [x] [T041] [US3] Guarded git probe (`.git` + `git rev-parse --verify HEAD`), never throws
  ```yaml
  files: ["src/core/classify.ts"]
  ```
- [x] [T042] [US3] init reports detected mode; write path is non-destructive regardless (FR-009)
  ```yaml
  files: ["src/cli/init.ts"]
  ```
- [x] [T043] [P] [US3] Unit + E2E: empty dir→greenfield, dir w/ source or rules or commits→brownfield
  ```yaml
  files: ["test/core/classify.test.ts"]
  ```
- **Checkpoint:** US-3 demoable — init announces detected mode and picks the safe path. ✅

## Phase 6 — User story US-4 — Recover pre-init version  (priority: P3, depends US-1)

- [x] [T050] [US4] `--dry-run` reports planned per-file change without writing or backing up (FR-008b)
  ```yaml
  files: ["src/cli/fsops.ts"]
  ```
- [x] [T051] [US4] Backup restore surface — `listBackups`/`restoreLatestBackup` + `ambykit restore` command
  ```yaml
  files: ["src/cli/fsops.ts", "src/cli/restore.ts", "src/cli/index.ts"]
  ```
- [x] [T052] [P] [US4] E2E: modify via AmbyKit then restore original from backup (SC-005)
  ```yaml
  files: ["test/cli/restore.test.ts"]
  ```
- **Checkpoint:** US-4 demoable — dry-run preview + restorable backups via `ambykit restore`. ✅

## Phase 7 — User story US-5 — Docs & dev site cover brownfield support  (priority: P2, depends US-1..US-4)

- [x] [T070] [US5] Document non-destructive init preserving existing docs in getting-started
  ```yaml
  files: ["docs/getting-started.md", "README.md"]
  ```
- [x] [T071] [P] [US5] Document `init`/`sync` brownfield flags + `restore`: `--dry-run`, detection, backups, recovery
  ```yaml
  files: ["docs/cli-reference.md"]
  ```
- [x] [T072] [P] [US5] Document the region-merge model + backups in architecture overview
  ```yaml
  files: ["docs/architecture.md"]
  ```
- [x] [T073] [P] [US5] Note the rules-file wrapping change in the compatibility matrix
  ```yaml
  files: ["docs/tool-compatibility.md"]
  ```
- [x] [T074] [US5] Mirror getting-started brownfield note on the dev site
  ```yaml
  files: ["site/src/content/docs/start/getting-started.mdx"]
  ```
- [x] [T075] [P] [US5] Mirror CLI reference brownfield flags + `restore` on the dev site
  ```yaml
  files: ["site/src/content/docs/cli/index.mdx"]
  ```
- [x] [T076] [P] [US5] Mirror region-merge model on the dev site architecture page
  ```yaml
  files: ["site/src/content/docs/concepts/architecture.mdx"]
  ```
- [x] [T077] [US5] Cross-surface consistency pass: `docs/` ↔ `site/` describe brownfield identically; docs-sync green (FR-015, SC-006)
  ```yaml
  files: ["docs/", "site/src/content/docs/"]
  ```
- **Checkpoint:** US-5 demoable — both doc surfaces explain brownfield init/update, detection, backups, recovery. ✅

## Phase 8 — Polish

- [x] [T092] Run `ambykit sync` to regenerate this repo's own tool files; `npm run typecheck` + `npm test` green (repo root)
