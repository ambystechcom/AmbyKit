---
feature: 012-worktree-isolation
status: done
created: 2026-08-25
---

# Implementation Plan — Worktree isolation — work on features in parallel

> The HOW. First artifact where technology appears. Must satisfy every `FR-###` in `@spec.md` and
> honor the `@../../.amby/constitution.md`. Reference spec/UI by ID — do not restate them.

## Technical context

- **Stack:** existing TypeScript/ESM CLI (Node ≥ 20), Vitest; git invoked via `node:child_process`
  `execFileSync("git", …)` — no new dependencies.
- **Key libraries:** none new. `zod` for the config schema extension; existing `ui/interactive/prompt`
  for the init question; `ui/table` for `list` output.
- **Constraints driving choices:**
  - Principle 2 — one new verb `WorktreeCommand extends BaseCommand`; git plumbing in `src/core/`
    as small functions, side effects at the CLI edge.
  - Principle 3 — the verb is zero-model-token (FR-001). Current-feature resolution (FR-010) is
    stated **once** in the shared rules region (`src/core/rules.ts`) rather than in every prompt.
  - Principle 5 — tests per FR; git-dependent tests run in a temp repo and `it.skip` when `git` is
    not on PATH.
  - Principle 6 — after changing `src/prompts/specify.md` and `rules.ts`, `ambykit sync` regenerates
    the repo's own tool files.
  - Principle 7 — writes limited to `.worktrees/`, `.gitignore`, `.amby/config.json`, all in-project.

## Architecture

```
src/core/git.ts        thin git wrappers (execFileSync): isRepo, defaultBranch, branchExists,
                       currentBranch, worktreeList (porcelain parse), isDirty, isMerged
src/core/worktree.ts   pure logic: featureIds(root), worktreePath(root,id), planCreate/planRemove
                       (decide → {action, reason}), ensureGitignore(text) → text, stale detection
src/cli/worktree.ts    WorktreeCommand: `ambykit worktree <feature> | list | remove <feature> [--force]`
                       + --dry-run/--json; registered in src/cli/index.ts COMMANDS
src/core/config.ts     AmbyConfig.worktrees?: boolean (default false)
src/cli/init.ts        TTY && !--yes → confirm("Enable worktree isolation?", default no) → config
src/cli/check.ts       + stale-worktree warning (branch merged into default branch)
src/core/rules.ts      + "Current feature" resolution rule in buildAmbyRegion (FR-010)
src/prompts/specify.md + final step: if config.worktrees, run `ambykit worktree <id>` (allowedTools + bash)
```

**Verb contract**

| Invocation | Behavior | Exit |
|---|---|---|
| `ambykit worktree <id>` | validate id (FR-004) → if worktree exists: report path (FR-005) → else ensure `.gitignore` has `.worktrees/` (FR-002) → `git worktree add [-b <id> <default>] .worktrees/<id> [<id>]` (FR-003) | 0 / 1 |
| `ambykit worktree list` | table: feature, branch, path, clean/dirty, stale (FR-006) | 0 |
| `ambykit worktree remove <id> [--force]` | none → info, exit 0; dirty && !force → error (FR-007); else `git worktree remove [--force]`; never `branch -d` | 0 / 1 |
| any, `--json` | `{ action, feature, path, branch, created, ... }` (FR-008) | same |
| any, `--dry-run` | print plan, no git mutation, no file write (FR-008) | 0 |
| not a git repo | error "not a git repository" (FR-009) | 1 |

**Default branch detection (FR-003):** `git symbolic-ref refs/remotes/origin/HEAD` → strip prefix;
else first of `main`, `master` that `branchExists`; else error.

**Edge cases (spec):** branch already checked out elsewhere → `git worktree add` fails; surface its
message plus the path from `worktreeList`. Directory exists but not a registered worktree → refuse
before calling git. `findProjectRoot` walks up from inside `.worktrees/<id>/` and hits that
worktree's own `.amby/` first — add a test to lock this in.

**Init prompt (FR-011a):** add `confirm(question, defaultNo)` to `ui/interactive/prompt.ts` (single
key y/N, same TTY guards as `multiSelect`); skipped on non-TTY/`--yes`.

**Rules region (FR-010) — one paragraph appended to `buildAmbyRegion`:**
"Current feature: if the project root is `.worktrees/NNN-slug/`, it is `NNN-slug`; else the git
branch if it matches a `specs/` dir; else the highest-numbered `specs/` dir — say which you chose."

**Specify (FR-011):** final numbered step — "If `.amby/config.json` has `"worktrees": true` and this
is a git repo, run `ambykit worktree <NNN-slug>` and tell the user to continue there." Adds `bash`
to `allowedTools` and `.amby/config.json` to `reads`; site page `specify.mdx` reads updated to match
(docs-sync A2).

## Phased approach

- **Phase 0 — Research:** none; `git worktree` porcelain format is stable. No `research.md`.
- **Phase 1 — Foundation:** `src/core/git.ts`, `src/core/worktree.ts` (pure), config field, test
  helper `test/helpers/git-repo.ts` (temp repo with an initial commit on `main` + one feature dir).
- **Phase 2 — US-1:** `WorktreeCommand` create path + registry; tests for FR-002/003/004/005/008/009.
- **Phase 3 — US-2:** `list` + `remove`; tests for FR-006/007.
- **Phase 4 — US-3:** rules-region paragraph + `findProjectRoot` worktree test; `ambykit sync`.
- **Phase 5 — US-4:** config flag, `confirm()` + init question (non-TTY test), specify prompt step,
  site `specify.mdx` frontmatter; `ambykit sync`.
- **Phase 6 — US-5:** `check` stale warning (+ test), docs: `docs/cli-reference.md`,
  `site/…/cli/index.mdx`, README table, `AGENTS.md` `src/cli/` line (docs-sync A9), `docs/workflow.md`
  "Parallel features" section; `check-docs-sync` green.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `WorktreeCommand`, local git calls only |
| FR-002 | `worktreePath()` = `.worktrees/<id>`; `ensureGitignore()` |
| FR-003 | `defaultBranch()` + `git worktree add -b` / plain add |
| FR-004 | `featureIds(root)` from `specs/` dir names; error lists them |
| FR-005 | `worktreeList()` lookup before add → info + exit 0 |
| FR-006 | `list` table via `ui/table`; `isDirty()` per path |
| FR-007 | `remove`: dirty guard + `--force`; no branch deletion |
| FR-008 | `BaseCommand.dryRun`, `--json` branch in `execute` |
| FR-009 | `isRepo()` guard in verb; specify step is conditional on repo |
| FR-010 | rules-region paragraph; `findProjectRoot` test from inside a worktree |
| FR-011, FR-011a | `worktrees` config + specify step; `confirm()` in init with TTY/`--yes` guards |
| FR-012 | subclass of `BaseCommand`; all paths under project root |
| FR-013 | `check.ts`: `isMerged(branch, default)` per worktree → warn with `ambykit worktree remove <id>` |
| FR-014 | docs tasks + docs-sync A4/A7/A9 |
| US-1..US-5 | Phases 2–6 |
| SC-001 | verb exists, no model involvement |
| SC-002 | e2e test: two worktrees, `git status --porcelain` of main checkout empty before/after |
| SC-003 | tests for FR-005 and remove-nonexistent |
| SC-004 | test files listed in tasks; `npm test` |
| SC-005 | Dogfood: the *next* feature (013+) is developed in `.worktrees/`; noted in tasks as a follow-up, not blocking |

## Risks & decisions

- **Decision: `.worktrees/<id>/` inside the repo, gitignored** (clarified). `findProjectRoot`
  already resolves the worktree's own root because the walk-up meets `.worktrees/<id>/.amby` first.
- **Decision: FR-010 lives in the rules region, not in each prompt.** One paragraph, read once per
  session by every tool, versus ten prompt edits (Principle 3). Prompts keep saying "the current
  feature".
- **Decision: `remove` never deletes the branch.** Cleanup of merged branches stays a git concern;
  `check` only *reports* stale worktrees.
- **Risk: git absent or old (< 2.17) in CI/user machines.** Tests `it.skip` without git; the verb
  errors clearly. `git worktree remove` needs ≥ 2.17 (2018) — acceptable.
- **Risk: Windows file locks on `worktree remove`.** Surface git's error with the path; `--force`
  passes through.
- **Risk: docs-sync A9 parses the `AGENTS.md` `src/cli/` line** — must add `worktree` to that line or
  CI fails. Covered by a task.
- **Risk: specify gains `bash`.** Scoped to one command in one conditional step; noted in the prompt.
