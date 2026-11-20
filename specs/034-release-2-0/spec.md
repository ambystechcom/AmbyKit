---
feature: 034-release-2-0          # NNN-slug
title: Release 2.0
branch: 034-release-2-0
status: draft                     # draft | ready | in-progress | blocked | done
created: 2026-11-20
---

# Spec — Release 2.0

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

AmbyKit 2.0 is the first release that breaks compatibility on purpose: the spec format becomes v2 with a `migrate`
command (spec 030), the config file is versioned, Node 22 is the minimum, and `run` and the plugin API become stable
(spec 033). A major release needs more than a version bump: a clear list of what breaks, a way to move, a gate that proves
the release works on AmbyKit itself (Principle 6), and a way back if it goes wrong. This feature defines that release and its
gate. Spec 035 (2.1) later removes reading of 1.x files; 2.0 still reads them.

**Out of scope:** building the features that ship in 2.0 (specs 030 to 033), removing 1.x reading (spec 035) and any
release after 2.0.

## User scenarios & testing

### US-1 — Know what breaks and how to move  (priority: P1)

As a user on 1.x, I want a plain list of what breaks and a migration guide, so that I can upgrade without surprises.

- **Why this priority:** a breaking release without this strands users.
- **Independent test:** read the changelog and the guide and follow them on a copy of a 1.x project.
- **depends-on:** [030:US-3]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the 2.0 changelog, When a person reads it, Then it lists every breaking change: the spec format v2 and the `migrate`
  step, the config schema version, Node 22 as the minimum, the stable `run` and plugin API (with their deprecation policy),
  and the targets that moved from the core to official plugins (spec 036).
- Given the migration guide, When a person follows it on a 1.x project, Then they reach a migrated project with `check`
  and `analyze` clean, using only commands in the guide.
- Given a breaking change, When it is listed, Then it says who is affected and what to do.
- Given the changelog, When a plugin author reads it, Then the `[plugin-api]` line says the API is now stable.

### US-2 — The gate passes before anything is published  (priority: P1)

As a maintainer, I want one list of conditions that must hold before 2.0 is published, so that the release is earned.

- **Why this priority:** the roadmap makes each release ship only after its gate passes on AmbyKit itself.
- **Independent test:** read the gate record and confirm every condition has a dated result.
- **depends-on:** [030:US-3, 031:US-1, 033:US-3]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the gate, When it is read, Then it contains exactly these conditions: AmbyKit's own specs are migrated to format v2;
  1.x files are still read; two dependent features were built by one fleet; the dashboard redesign was designed with the
  design phase and built with AmbyKit; CI is green on Node 22 on every platform.
- Given a condition, When it is checked, Then its result, date and evidence (a command output or a recorded run) are written
  in the release notes file.
- Given any condition not met, When a person tries to publish, Then the checklist stops them and names the condition.

### US-3 — AmbyKit's own specs are migrated  (priority: P1)

As a maintainer, I want the repository's own specs on format v2 before release, so that we use what we ship.

- **Why this priority:** it is the proof that `migrate` works on a real, large project (Principle 6).
- **Independent test:** run `migrate --dry-run` on the repository and confirm it reports nothing to do.
- **depends-on:** [030:US-3, 030:US-5]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given every feature of the 2.0 line is merged, When `ambykit migrate` runs on the repository, Then every spec is converted
  with no file skipped, and a second run changes nothing (030's dogfood task, the last commit before release).
- Given the migrated repository, When `analyze`, `trace` and the full test suite run, Then they pass with the same
  coverage as before the migration.
- Given 1.x files, When the migrated repository's tests run, Then fixtures of the 1.x format still exist to prove 1.x is read.

### US-4 — The release is published safely  (priority: P1)

As a maintainer, I want the release process to be the same safe process as 1.x with the 2.0 changes, so that nothing goes
out half done.

- **Why this priority:** publishing is irreversible for a given version number.
- **Independent test:** walk the checklist on a release branch up to, but not including, the publish step.
- **depends-on:** [030:US-8]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the release branch, When the checklist is followed, Then it bumps `package.json` and the lockfile to 2.0.0, adds the
  changelog heading and plugin line, re-records the golden files, runs `sync` twice and runs the full tests.
- Given CI, When it runs, Then it runs on Node 22 on Linux, macOS and Windows, and Node 20 is no longer in the matrix.
- Given the tag, When the release is published, Then the existing workflow verifies the tag equals the package version and
  publishes with provenance through trusted publishing, with no stored token.
- Given the published package, When it is installed fresh, Then `ambykit --version` prints 2.0.0 and the migrate command exists.

### US-5 — There is a way back  (priority: P2)

As a maintainer, I want a written rollback plan, so that a bad release is contained fast.

- **Why this priority:** a major release is the one most likely to need it.
- **Independent test:** read the plan and confirm each step names a command and who runs it.
- **depends-on:** [US-4]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a serious defect after publishing, When the plan is followed, Then the `latest` tag is pointed back to the last 1.x
  version, the 2.0.0 version is deprecated with a message that names the fixed version, and the GitHub release is edited.
- Given the plan, When it is read, Then it says that an npm version cannot be unpublished for reuse, so the fix ships as 2.0.1.
- Given a project already migrated by `migrate`, When the plan is read, Then it says how to read it with 1.x (the dual-write
  option, or restoring from version control) and states honestly what 1.x loses on a v2 file.

### US-6 — Try it before everyone gets it  (priority: P2)

As a maintainer, I want a prerelease on a separate tag, so that real projects can try 2.0 before `latest` moves.

- **Why this priority:** it catches problems that AmbyKit's own repository cannot.
- **Independent test:** install the prerelease tag and confirm `latest` still points to 1.x.
- **depends-on:** [US-4]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a release candidate, When it is published, Then it goes to a non-`latest` tag and `npm install` without a tag still gets 1.x.
- Given the candidate, When at least one project other than this repository is migrated and used, Then the result is
  recorded before the final release.

### US-7 — Docs and site match the release  (priority: P2)

As a reader, I want every page to describe 2.0, so that nothing contradicts the release.

- **Why this priority:** stale docs are the most common support request after a breaking release.
- **Independent test:** search the docs and site for 1.x-only statements and confirm none are left unqualified.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the README, the docs and the site, When they are read, Then they describe format v2 as the format, mention 1.x only
  as supported until 2.1, and carry no "experimental" label on `run` or the plugin API.
- Given the CLI reference, When it is compared with `ambykit --help`, Then they agree (the docs sync check passes).

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL publish a changelog entry for 2.0 that lists every breaking change, who is affected and what to do.
- FR-002  THE SYSTEM SHALL publish a migration guide that takes a 1.x project to a migrated one using only documented commands.
- FR-003  THE SYSTEM SHALL record, before publishing, a dated result and evidence for each gate condition in US-2.
- FR-004  IF a gate condition is not met, THEN THE SYSTEM SHALL stop the release checklist and name the condition.
- FR-005  WHEN the release branch is prepared, THE SYSTEM SHALL have migrated this repository's own specs with no file skipped
  and a second run changing nothing.
- FR-006  THE SYSTEM SHALL keep fixtures of the 1.x format so that reading 1.x remains tested in 2.0.
- FR-007  THE SYSTEM SHALL run CI on Node 22 on Linux, macOS and Windows and SHALL NOT run it on Node 20.
- FR-008  THE SYSTEM SHALL verify that the tag equals the package version and publish with provenance and no stored token.
- FR-009  THE SYSTEM SHALL publish a release candidate on a non-`latest` tag first, and SHALL record the result of at least
  one project other than this repository before the final release.
- FR-010  THE SYSTEM SHALL keep a written rollback plan that names each command, including how to repoint `latest`.
- FR-011  THE SYSTEM SHALL state in the rollback plan what 1.x loses when it reads a v2 file.
- FR-012  THE SYSTEM SHALL describe format v2, the Node 22 minimum and the stable surfaces in the README, docs and site, and
  SHALL pass the docs sync check.

## Success criteria

- SC-001  A person upgrades a copy of a real 1.x project by following only the migration guide, and `check` and `analyze` are clean.
- SC-002  Every gate condition has a dated result and evidence before the version is published.
- SC-003  AmbyKit's own specs read as v2, and the full test suite passes on all three platforms on Node 22.
- SC-004  The published 2.0.0 package installs fresh, reports its version and has a working `migrate`.
- SC-005  Every FR maps to at least one test or verification step (Principle 5), and `npm run typecheck` and `npm test` pass.

## Edge cases

- The gate's fleet condition cannot be met because no live runner is verified: the release waits; it is not waived.
- A project with specs the migrator skips (metadata in prose, mixed line endings): the guide covers them by name.
- A user with a pinned 1.x CI: the guide describes the dual-write option and the pin.
- A release candidate finds a data-loss bug in `migrate`: no final release until a fix and a second candidate.
- Provenance publishing fails: the release is not repeated under another version without a recorded reason.

## Assumptions

- Specs 030 to 033 are merged before the release branch is cut; this feature adds no product behaviour.
- The release maintainer runs the person steps (the gate evidence and the publish); an assistant prepares the branch.
- npm Trusted Publishing and the existing release workflow from 1.x are unchanged except for the Node version.
