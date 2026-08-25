---
feature: 012-worktree-isolation
created: 2026-08-25
---

# Tasks — Worktree isolation — work on features in parallel

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.

## Phase 1 — Setup

- [x] [T001] Create branch `012-worktree-isolation` from `main` (git)

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] Git wrappers via `execFileSync`: `isRepo`, `defaultBranch`, `branchExists`, `currentBranch`, `worktreeList` (porcelain parse), `isDirty`, `isMerged` (src/core/git.ts)
- [x] [T011] [P] Pure worktree logic: `featureIds`, `worktreePath`, `ensureGitignore(text)`, `planCreate`/`planRemove`, `staleWorktrees` (src/core/worktree.ts)
- [x] [T012] [P] Add `worktrees?: boolean` to `AmbyConfig` and the zod schema, default absent/false (src/core/types.ts, src/core/config.ts)
- [x] [T013] [P] Test helper: temp git repo with initial commit on `main`, `.amby/`, `specs/003-foo/`; skip when git missing (test/helpers/git-repo.ts)
- [x] [T014] Unit tests for `worktree.ts` pure functions and `git.ts` porcelain parsing (test/core/worktree.test.ts)
- [x] [T015] Export new core modules; `npm run typecheck && npm test` green (src/core/index.ts)

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] `WorktreeCommand` skeleton: name/summary/usage, subcommand dispatch, not-a-repo guard (FR-009), register in `COMMANDS` (src/cli/worktree.ts, src/cli/index.ts)
- [x] [T021] [US1] Create path: validate feature (FR-004) → existing worktree no-op (FR-005) → ensure `.gitignore` (FR-002) → `git worktree add` with/without `-b` from default branch (FR-003) (src/cli/worktree.ts)
- [x] [T022] [US1] `--dry-run` and `--json` output for create (FR-008) (src/cli/worktree.ts)
- [x] [T023] [US1] Edge cases: branch checked out elsewhere, directory present but unregistered → refuse with path (src/cli/worktree.ts)
- [x] [T024] [US1] E2E tests for FR-002/003/004/005/008/009 and SC-002 (main checkout `git status` unchanged) (test/cli/worktree.test.ts)
- **Checkpoint:** US-1 is demoable — `ambykit worktree 003-foo` yields `.worktrees/003-foo` on branch `003-foo`.

## Phase 4 — User story US-2  (priority: P1, depends-on US-1)

- [x] [T030] [US2] `list`: table of feature, branch, path, clean/dirty, stale; `--json` array (FR-006) (src/cli/worktree.ts)
- [x] [T031] [US2] `remove <id> [--force]`: nonexistent → info exit 0; dirty guard; `git worktree remove`; branch untouched (FR-007) (src/cli/worktree.ts)
- [x] [T032] [US2] E2E tests for FR-006/007 and SC-003 (test/cli/worktree.test.ts)
- **Checkpoint:** US-2 is demoable — create two, list both, remove one.

## Phase 5 — User story US-3  (priority: P2, depends-on US-1)

- [x] [T040] [US3] Append the "Current feature" resolution paragraph to `buildAmbyRegion` (FR-010) (src/core/rules.ts)
- [x] [T041] [P] [US3] Test: `findProjectRoot` from inside `.worktrees/<id>/sub` returns the worktree root, not the parent (test/core/worktree.test.ts)
- [x] [T042] [US3] Update rules snapshot tests if any assert the region text; `ambykit sync`; `ambykit check` clean (test/, AGENTS.md, .claude/)
- **Checkpoint:** US-3 is demoable — rules region states the resolution order.

## Phase 6 — User story US-4  (priority: P2, depends-on US-1)

- [x] [T050] [P] [US4] Add `confirm(question, defaultNo)` y/N prompt with the same TTY guards as `multiSelect` (src/cli/ui/interactive/prompt.ts)
- [x] [T051] [US4] `init`: on TTY && !`--yes`, ask "Enable worktree isolation?" and persist `worktrees` (FR-011a) (src/cli/init.ts)
- [x] [T052] [P] [US4] Test: init on non-TTY / `--yes` leaves `worktrees` unset without prompting (test/cli/interactive-nontty.test.ts)
- [x] [T053] [US4] Specify prompt: final conditional step running `ambykit worktree <id>` when config enables it and repo is git; add `bash` to `allowedTools`, `.amby/config.json` to `reads` (FR-011, FR-009) (src/prompts/specify.md)
- [x] [T054] [US4] Update `specify.mdx` frontmatter `reads` to match; `ambykit sync`; `node scripts/check-docs-sync.mjs` (site/src/content/docs/workflow/specify.mdx)
- **Checkpoint:** US-4 is demoable — opted-in project gets a worktree from `/amby.specify`.

## Phase 7 — User story US-5  (priority: P3, depends-on US-2)

- [x] [T060] [US5] `check`: warn per worktree whose branch is merged into the default branch, with the remove command (FR-013) (src/cli/check.ts)
- [x] [T061] [P] [US5] Test for the stale-worktree warning (test/cli/worktree.test.ts)
- [x] [T062] [P] [US5] Document `ambykit worktree` in both CLI references (docs/cli-reference.md, site/src/content/docs/cli/index.mdx)
- [x] [T063] [P] [US5] README CLI table row + "Parallel features" section in the workflow guide (README.md, docs/workflow.md)
- [x] [T064] [P] [US5] Add `worktree` to the `src/cli/` structure line so docs-sync A9 passes (AGENTS.md)
- [x] [T065] [US5] `node scripts/check-docs-sync.mjs` and site build pass (scripts/check-docs-sync.mjs)
- **Checkpoint:** US-5 is demoable — `check` flags stale worktrees; docs describe the workflow.

## Phase 8 — Polish

- [x] [T090] Final `npm run typecheck && npm test`; open PR `012-worktree-isolation` → `main` (git)
- [ ] [T091] Follow-up (SC-005, non-blocking): develop the next feature inside `.worktrees/` and note it in that feature's spec (specs/)
