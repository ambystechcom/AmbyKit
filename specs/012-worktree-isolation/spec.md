---
feature: 012-worktree-isolation
title: Worktree isolation — work on features in parallel
branch: 012-worktree-isolation
status: done
created: 2026-08-25
---

# Spec — Worktree isolation — work on features in parallel

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

## Problem

Every AmbyKit feature gets its own branch (`branch:` in `spec.md`), but a single working directory
means only one feature can be checked out at a time. Switching branches discards in-flight context,
and running two assistants on two features at once is impossible. **Worktree isolation** gives each
feature its own working copy so specs, plans, and implementation of several features can proceed
side by side — by one developer or several parallel agents — without checkout switching.

## User scenarios & testing

### US-1 — Create an isolated working copy for a feature  (priority: P1)

As a developer, I want a single command that creates a separate working copy on the feature's
branch, so that I can work on that feature without disturbing my main checkout.

- **Why this priority:** Core capability; everything else builds on it.
- **Independent test:** In a repo with `specs/003-foo/`, run the command for `003-foo`; a new
  working copy exists on branch `003-foo`, the main checkout is untouched, and the copy is excluded
  from version control.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a feature dir `specs/NNN-slug/` exists, When I create a worktree for `NNN-slug`, Then a
  working copy appears at a predictable location on branch `NNN-slug`, created from the base branch
  if the branch does not exist yet, or checked out from the existing branch if it does.
- Given a worktree for that feature already exists, When I create it again, Then the command reports
  the existing location and exits successfully without changing anything.
- Given the feature id does not match any `specs/` dir, When I create a worktree, Then the command
  refuses with a clear message listing valid features.
- Given the working-copy location is not yet ignored by version control, When the first worktree is
  created, Then the ignore rule is added.
- Given `--dry-run`, When I create a worktree, Then the command prints what it would do and changes
  nothing.

### US-2 — List and remove worktrees  (priority: P1)

As a developer, I want to see which features have worktrees and remove one when the feature is
merged, so that stale copies do not pile up.

- **Why this priority:** Without cleanup, isolation becomes clutter quickly.
- **Independent test:** After creating worktrees for two features, list shows both with their
  branch and status; removing one deletes its working copy and it no longer appears in the list.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given worktrees exist, When I list them, Then each shows feature id, branch, location, and whether
  it has uncommitted changes.
- Given a worktree has no uncommitted changes, When I remove it, Then the working copy is deleted
  and the branch is left intact.
- Given a worktree has uncommitted changes, When I remove it, Then the command refuses unless I
  explicitly force it.
- Given the feature has no worktree, When I remove it, Then the command reports so and exits
  successfully.

### US-3 — Phases resolve the current feature from the worktree  (priority: P2)

As a developer running assistant phases inside a feature worktree, I want "the current feature" to
mean the feature this worktree belongs to, so that I never have to pass a feature id.

- **Why this priority:** Makes isolation seamless in day-to-day use, but isolation works without it.
- **Independent test:** Inside the worktree for `003-foo`, run `/amby.plan` with no argument; it
  operates on `specs/003-foo/`.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the assistant runs inside a feature worktree, When any phase defaults to "the current
  feature", Then it resolves to that worktree's feature.
- Given the assistant runs in the main checkout on branch `NNN-slug`, When a phase defaults to the
  current feature, Then it resolves to `NNN-slug` (existing behavior, made explicit).
- Given neither applies, When a phase defaults to the current feature, Then it falls back to the
  highest-numbered feature dir and says which one it picked.

### US-4 — Specify offers isolation for the new feature  (priority: P2)

As a developer, I want `/amby.specify` to set up the new feature's worktree when the project has
opted in, so that a feature starts isolated from the moment it exists.

- **Why this priority:** Convenience on top of US-1; must not change behavior for projects that have
  not opted in.
- **Independent test:** With isolation enabled in project config, run `/amby.specify …`; the spec is
  written and a worktree for the new feature exists. With it disabled, only the spec is written.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given isolation is enabled in project config, When specify finishes writing `spec.md`, Then it
  creates the worktree and tells the user where to continue working.
- Given isolation is disabled (the default), When specify finishes, Then no worktree is created and
  the output is unchanged from today.
- Given `ambykit init` runs in a terminal, When it asks about worktree isolation and I accept, Then
  project config records it enabled; with `--yes` or no terminal, it stays disabled without asking.
- Given the project is not under version control, When specify finishes with isolation enabled,
  Then it writes the spec, skips the worktree, and says why.

### US-5 — Health check and documentation  (priority: P3)

As a maintainer, I want `ambykit check` to flag stale worktrees and the docs to explain the
parallel-feature workflow, so that the feature is discoverable and self-cleaning.

- **Why this priority:** Polish.
- **Independent test:** With a worktree whose branch is already merged into the base branch,
  `ambykit check` reports it as removable; the docs describe create/list/remove and the specify
  integration; the docs-sync checker passes.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a worktree whose branch is merged into the base branch, When `ambykit check` runs, Then it
  lists that worktree as stale with the removal command.
- Given the docs, When built, Then the CLI reference documents the new verb and the workflow guide
  describes parallel features.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL provide a local, zero-model-token command to create, list, and remove
  per-feature worktrees (Principle 3).
- FR-002  WHEN a worktree is created for feature `NNN-slug`, THE SYSTEM SHALL place it at a single
  predictable location `.worktrees/NNN-slug/` inside the project, and SHALL ensure `.worktrees/` is
  ignored by version control.
- FR-003  WHEN the feature branch does not exist, THE SYSTEM SHALL create it from the repository's
  default branch (as advertised by the remote, falling back to `main` then `master`); WHEN it exists,
  THE SYSTEM SHALL check it out in the new worktree.
- FR-004  IF the feature id has no `specs/NNN-slug/` dir, THEN THE SYSTEM SHALL refuse and list
  valid feature ids.
- FR-005  IF a worktree for the feature already exists, THEN create SHALL be a no-op that reports
  its location and exits 0.
- FR-006  THE SYSTEM SHALL list worktrees with feature id, branch, path, and dirty/clean state.
- FR-007  IF a worktree has uncommitted changes, THEN remove SHALL refuse unless forced; remove SHALL
  never delete the branch.
- FR-008  THE SYSTEM SHALL honor `--dry-run` and `--json` on all worktree operations, consistent with
  existing verbs.
- FR-009  IF the project is not a version-controlled repository, THEN worktree operations SHALL fail
  with a clear message and exit non-zero, and specify SHALL skip isolation and say so.
- FR-010  WHEN a phase defaults to "the current feature", THE SYSTEM SHALL resolve it in order:
  enclosing feature worktree → current branch matching a feature id → highest-numbered feature dir
  (stating the choice).
- FR-011  WHERE isolation is enabled in project config, THE SYSTEM SHALL create the new feature's
  worktree at the end of specify; the setting SHALL default to disabled.
- FR-011a WHEN `ambykit init` runs interactively, THE SYSTEM SHALL ask whether to enable worktree
  isolation (default: no) and persist the answer in project config; WHEN non-interactive or `--yes`,
  it SHALL keep the default without asking.
- FR-012  THE SYSTEM SHALL implement the verb as a subclass of the shared command base with no
  duplicated orchestration (Principle 2) and SHALL NOT write outside the project (Principle 7).
- FR-013  WHEN `ambykit check` runs, THE SYSTEM SHALL report worktrees whose branch is merged into
  the base branch as stale.
- FR-014  THE SYSTEM SHALL document the verb in the CLI reference and the parallel-feature workflow
  in the workflow guide, passing the docs-sync checker.

## Success criteria

- SC-001  Creating a worktree for an existing feature takes one command and zero model tokens.
- SC-002  Two features can be worked on concurrently (two working copies, two branches) with no
  checkout switching in either; the main checkout's status is unchanged throughout.
- SC-003  Creating a worktree twice, and removing a nonexistent one, both exit 0 with no changes.
- SC-004  Every functional requirement above has an automated test; `npm test` passes.
- SC-005  Dogfood: at least one AmbyKit feature after this one is developed in its own worktree.

## Edge cases

- Branch exists and is already checked out in another worktree (or the main checkout) — refuse
  with the location; never create two worktrees for one branch.
- Worktree directory exists on disk but is unknown to version control (stale leftover) — refuse and
  explain how to clean up rather than overwriting.
- Feature dir renamed after the worktree was created — list shows the mismatch instead of crashing.
- Nested AmbyKit projects / `.amby/` discovery from inside a worktree must find the worktree's own
  root, not the parent checkout.
- Windows path/permission quirks on removal — report the failing path.

## Assumptions

- Version control is git; worktree semantics follow git's native model. Non-git VCS is out of scope.
- Worktree directories are self-contained working copies and need no per-worktree AmbyKit sync
  beyond what the branch already contains.
- Running parallel agents is the user's concern; AmbyKit only provides the isolated copies.
