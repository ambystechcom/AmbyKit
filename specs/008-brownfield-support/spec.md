---
feature: 008-brownfield-support
title: Brownfield project support (non-destructive init & doc update)
branch: 008-brownfield-support
status: ready
created: 2026-07-20
---

# Spec — Brownfield project support (non-destructive init & doc update)

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Today AmbyKit assumes a greenfield project: `ambykit init` writes tool rules files
(`CLAUDE.md`, `AGENTS.md`, and the equivalents for other supported tools) as if none existed,
overwriting whatever is there. In a project that already has these files, that destroys
hand-written agent instructions the user depends on. Brownfield support means AmbyKit can be
adopted into an existing codebase — and its documentation kept current — by **adding/updating only
the AmbyKit-owned portion** of each rules file while preserving everything else. Honors Principle 7
(least surprise, least privilege, reversible changes).

## User scenarios & testing

<!-- One block per story. Each story is independently testable and prioritized. -->

### US-1 — Init preserves existing agent docs  (priority: P1)

As a developer adopting AmbyKit in an existing project, I want `ambykit init` to preserve the
content already in my `CLAUDE.md` / `AGENTS.md` (or other supported tool rules files) and only add
the AmbyKit guidance, so that I don't lose custom agent instructions that matter to my team.

- **Why this priority:** This is the core defect the user reported — silent data loss of important
  instructions is the single most damaging behavior and blocks any brownfield adoption.
- **Independent test:** In a temp project containing a `CLAUDE.md` with a unique sentinel line, run
  `ambykit init`; assert the sentinel line still exists and AmbyKit guidance was added.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a project with an existing `CLAUDE.md` containing custom instructions, When I run
  `ambykit init`, Then the original instructions remain intact and an AmbyKit section is added.
- Given a project with an existing `AGENTS.md` (native, non-Claude tool), When I run `ambykit init`,
  Then the original content is preserved and the AmbyKit guidance is added.
- Given a project with **no** existing rules file, When I run `ambykit init`, Then AmbyKit creates
  the file exactly as it does today (greenfield behavior unchanged).

### US-2 — Update existing docs to reference AmbyKit  (priority: P1)

As a developer with an established codebase, I want a way to update my existing agent documentation
to mention how to use AmbyKit and its workflow (constitution → specify → plan → tasks → implement),
so that my coding agents know the process without me hand-editing every rules file.

- **Why this priority:** The user's second explicit goal — "just to update existing documentation."
  Without it, brownfield users get non-destructive init but no path to keep docs current across the
  tools they use.
- **Independent test:** In a temp project with an existing `CLAUDE.md`, run the update path; assert
  an AmbyKit-owned region referencing the workflow is present, and re-running does not duplicate it.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a project already using AmbyKit, When I re-run the update, Then the AmbyKit-owned region is
  refreshed in place and no duplicate AmbyKit section is created (idempotent).
- Given a rules file whose AmbyKit region was manually edited since AmbyKit last wrote it, When I
  run the update, Then AmbyKit leaves that region untouched and reports the file as skipped.
- Given multiple supported tools configured in the project, When I run the update, Then every
  configured tool's rules file receives the AmbyKit guidance in that tool's native format.

### US-3 — Detect brownfield vs greenfield automatically  (priority: P2)

As a developer, I want AmbyKit to recognize whether a project already has a codebase and/or agent
docs and choose the right behavior, so that I don't have to remember a special flag to avoid
clobbering my files.

- **Why this priority:** Improves safety-by-default and ergonomics, but US-1's non-destructive merge
  already prevents data loss even without auto-detection, so this is an enhancement, not the fix.
- **Independent test:** Run `ambykit init` in (a) an empty dir and (b) a dir with existing source +
  rules files; assert AmbyKit reports the detected mode and behaves accordingly.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a directory with existing source files and/or rules files, When I run `ambykit init`, Then
  AmbyKit reports it detected a brownfield project and uses the non-destructive path.
- Given an empty directory, When I run `ambykit init`, Then AmbyKit reports greenfield and proceeds
  as today.
- Given detection is ambiguous, When I run `ambykit init`, Then AmbyKit defaults to the
  non-destructive (safe) behavior. A project is classified brownfield when any of these is present:
  an existing supported rules file, non-AmbyKit source files, or a VCS history with commits.

### US-4 — Recover the pre-init version of a modified doc  (priority: P3)

As a cautious developer, I want a way to see and undo what AmbyKit changed in my existing docs, so
that I can adopt AmbyKit without fear of an unwanted edit.

- **Why this priority:** Reduces adoption risk, but non-destructive merge plus normal VCS already
  cover most of this need, so it is lowest priority.
- **Independent test:** Modify an existing `CLAUDE.md` via AmbyKit, then invoke the recovery path;
  assert the original content is restorable.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given AmbyKit is about to modify an existing rules file, When I pass `--dry-run`, Then AmbyKit
  previews the change without writing.
- Given AmbyKit modified an existing rules file, When I look for the prior version, Then a
  timestamped backup of the pre-modification content exists and is restorable, in addition to
  whatever the user's VCS already retains.

### US-5 — Docs and dev site cover brownfield support  (priority: P2)

As a developer evaluating or adopting AmbyKit, I want the reference docs (`docs/`) and the published
dev site (`site/`) to explain how AmbyKit behaves in an existing project — non-destructive init,
updating docs, detection, backups, and recovery — so that I can discover and trust the feature
without reading the source.

- **Why this priority:** Undocumented behavior is undiscovered behavior; the fix only helps adopters
  if it is explained. Not P1 because it does not gate the code fix and the behavior is safe by default.
- **Independent test:** Grep both surfaces for the brownfield concepts (non-destructive init, update
  path, `--dry-run`, backups/recovery, detection) and assert each is present and mutually consistent.
- **depends-on:** [US-1, US-2, US-3, US-4]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a reader on `docs/getting-started.md` (and its `site/` mirror), When they reach the init
  step, Then it states existing agent docs are preserved, not overwritten.
- Given a reader on the CLI reference (`docs/cli-reference.md` and its `site/` mirror), When they
  look up `init`/`sync`, Then `--dry-run`, brownfield detection, backups, and recovery are documented.
- Given the same topic exists in both `docs/` and `site/`, When both are published, Then they
  describe brownfield behavior consistently (no contradictory claims).

## Requirements (EARS)

<!-- Numbered, testable. Patterns: SHALL (ubiquitous), WHEN (event), WHILE (state), IF/THEN (unwanted), WHERE (optional). -->

- FR-001  WHEN a target rules file (`CLAUDE.md`, `AGENTS.md`, or another supported tool's rules
  file) already exists, THE SYSTEM SHALL preserve all pre-existing content that is not inside the
  AmbyKit-owned region.
- FR-002  WHEN a target rules file does not exist, THE SYSTEM SHALL create it with the same content
  it produces today (greenfield behavior unchanged).
- FR-003  THE SYSTEM SHALL confine every AmbyKit-authored addition to a Markdown section that begins
  with an `### AmbyKit usage` heading and ends at the next heading of the same or higher level (or
  end-of-file); everything between those bounds is the AmbyKit-owned region.
- FR-004  WHEN the update or init runs against a file that already contains an AmbyKit-owned region,
  THE SYSTEM SHALL update that region in place and SHALL NOT create a second AmbyKit region
  (idempotent).
- FR-005  THE SYSTEM SHALL provide a way to update existing agent documentation to reference AmbyKit
  usage and the workflow phases (constitution → specify → plan → tasks → implement) without a full
  re-initialization.
- FR-006  WHERE multiple supported tools are configured for the project, THE SYSTEM SHALL apply the
  AmbyKit guidance to each tool's rules file in that tool's native format and path
  (per `docs/tool-compatibility.md`), honoring Principle 4.
- FR-007  IF AmbyKit cannot merge non-destructively (e.g. an unreadable or malformed target file),
  THEN THE SYSTEM SHALL abort that file's change without partial writes and report the reason.
- FR-008  THE SYSTEM SHALL classify a project as brownfield WHEN any of the following is present —
  an existing supported rules file, non-AmbyKit source files, or a VCS history with commits —
  otherwise greenfield, and SHALL report which mode it used.
- FR-008a  WHEN the AmbyKit-owned region of a target file has been modified since AmbyKit last wrote
  it, THE SYSTEM SHALL leave that region unchanged and report the file as skipped.
- FR-008b  WHEN invoked with a dry-run option, THE SYSTEM SHALL report the intended changes to each
  file and SHALL NOT write any file.
- FR-008c  BEFORE modifying an existing rules file, THE SYSTEM SHALL write a timestamped backup of
  its pre-modification content, kept out of the repo-in-sync check (Principle 7).
- FR-009  IF classification is ambiguous, THEN THE SYSTEM SHALL choose the non-destructive path.
- FR-010  THE SYSTEM SHALL keep the repo-in-sync check (`ambykit check` / CI) passing after a
  brownfield init or update, so an AmbyKit-managed project stays reproducible (Principle 6).
- FR-011  WHERE the AmbyKit region embeds a bridge or import required by a tool (e.g. Claude's
  `@AGENTS.md` import in `CLAUDE.md`), THE SYSTEM SHALL preserve that bridge when merging.
- FR-012  THE SYSTEM SHALL NOT modify user-level or out-of-tree files during brownfield init/update
  without explicit consent (Principle 7).
- FR-013  THE SYSTEM SHALL document brownfield behavior (non-destructive init, the update path,
  detection, backups, and recovery) in the reference docs under `docs/` and in `README.md`.
- FR-014  THE SYSTEM SHALL document the same brownfield behavior on the dev site under
  `site/src/content/docs/`, mirroring the `docs/` topics.
- FR-015  WHERE a topic appears in both `docs/` and `site/`, THE SYSTEM SHALL keep the two
  descriptions of brownfield behavior consistent.

## Success criteria

<!-- Measurable and tech-agnostic. -->

- SC-001  Running `ambykit init` on a project with existing rules files preserves 100% of the
  pre-existing (non-AmbyKit) bytes of those files.
- SC-002  Re-running init or update any number of times produces exactly one AmbyKit-owned region
  per rules file (zero duplicates).
- SC-003  For every supported tool, the AmbyKit guidance lands in the correct native file and format
  as defined by the compatibility matrix (0 mismatches in snapshot tests).
- SC-004  A brownfield init/update leaves `ambykit check` reporting "in sync."
- SC-005  A user can adopt AmbyKit in an existing project and, if desired, fully restore the
  original docs — with no reliance on undocumented steps.
- SC-006  Brownfield behavior (non-destructive init, update path, detection, backups, recovery) is
  documented in both `docs/` and the `site/` dev site, with no contradictory claims between them.

## Edge cases

- A project has **both** `CLAUDE.md` and `AGENTS.md`; the Claude bridge import must remain valid.
- The existing rules file already contains an AmbyKit-like section written by hand (not by AmbyKit).
- The existing rules file is empty, or contains only whitespace/comments.
- The AmbyKit region was hand-edited between runs (see US-2 clarification).
- Target file is read-only, symlinked, or has non-UTF-8 encoding.
- Line-ending / trailing-newline differences that could make an idempotent write appear as a diff.
- A supported tool uses a `none` command surface (rules-only) — the doc update is the only surface.

## Assumptions

- The set of "agent documentation" files is exactly the per-tool rules files AmbyKit already knows
  about via its emitters/compatibility matrix; no new tool support is in scope here.
- Generated command/skill/workflow files (the `amby.*` namespace) do not collide with user files and
  are out of scope for the non-destructive concern — this spec is about rules/doc files.
- Greenfield behavior is preserved **semantically** — a project with no rules file still gets a
  complete, working file — but not byte-for-byte: adopting the `### AmbyKit usage` region changes the
  generated layout, so emitter snapshot tests are expected to be updated. All tests must still pass
  after those expected snapshot updates.
