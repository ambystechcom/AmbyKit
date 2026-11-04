---
feature: 018-antigravity-skills-surface
title: Antigravity skills surface — replace the retired workflows
branch: 018-antigravity-skills-surface
status: done                     # draft | ready | in-progress | blocked | done
created: 2026-11-04
---

# Spec — Antigravity skills surface — replace the retired workflows

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

**Why now.** AmbyKit's two Antigravity targets (IDE and CLI) hand the assistant its phase commands as
*workflows*. Antigravity's own migration guide says workflows "will stop working on October 19, 2026"
and that afterwards "legacy workflow directories are no longer indexed or executable using slash
commands". It replaces them with *skills*, which the CLI turns into slash commands automatically and
which win over a workflow of the same name. Today (2026-11-04) an Antigravity user who runs
`ambykit sync` gets files the product no longer reads: no `/amby.*` commands appear. Sources:
antigravity.google/docs/migration/workflows-to-skills/ and antigravity.google/docs/skills/, checked
2026-11-04 (see `specs/016-agent-surface-expansion/research.md`).

## User scenarios & testing

### US-1 — Antigravity users get working phase commands  (priority: P1)

As an Antigravity user (IDE or CLI), I want AmbyKit's phase commands emitted in the form Antigravity
currently loads, so that `/amby.specify` and the other phases appear and run after a sync.

- **Why this priority:** the current output is dead on arrival for every Antigravity user; nothing else
  in this feature matters until the commands work again.
- **Independent test:** in a scratch project, select each Antigravity target, sync, open the assistant,
  and confirm every phase command is listed and expands its prompt.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a project configured for the Antigravity IDE target, When I sync, Then each phase is emitted as
  one skill that Antigravity recognizes, and no retired workflow file is produced.
- Given a project configured for the Antigravity CLI target, When I sync, Then the same skills are
  emitted and each phase is available as a slash command in the CLI.
- Given any phase prompt is edited in the neutral source, When I sync, Then the Antigravity skills
  reflect the edit with no hand editing.
- Given a phase prompt that uses the argument placeholder, When it is emitted for Antigravity, Then no
  literal placeholder token is left in the skill: the argument is reworded as prose, as for Codex
  (decided 2026-11-04; Antigravity documents no placeholder for skills).

### US-2 — Existing projects migrate without surprises  (priority: P1)

As a maintainer of a project that already synced the old Antigravity workflow files, I want the
transition to be safe and visible, so that I end up with working skills and no stale or duplicated
commands, and none of my own files are touched.

- **Why this priority:** every current Antigravity user has these files; a migration that leaves
  stale files, deletes the wrong ones, or hides the change would erode trust in `sync`.
- **Independent test:** take a project synced with the old release, upgrade, run the check and then
  the sync, and compare the project against a fresh sync of the new release.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a project containing the previously generated workflow files, When I run the doctor command,
  Then it reports them as stale generated files and says how to resolve them.
- Given the same project, When I run sync without the opt-in, Then the stale workflow files are left
  in place and sync says they are stale and how to remove them.
- Given the same project, When I run sync with the explicit opt-in, Then only the stale files that
  AmbyKit generated are removed (decided 2026-11-04: delete only on opt-in).
- Given a workflow file in that directory that AmbyKit did not generate (a user's own workflow), When
  I sync, Then it is left exactly as it is, whatever the decision above.
- Given a project that never had the old files, When I sync, Then no stale-file message appears.

### US-3 — Shared skills output stays consistent  (priority: P2)

As a user who selects Antigravity together with Codex, Pi or Kiro-style skill hosts, I want files that
several targets write to be written once and be correct for all of them, so that selecting more
assistants never produces conflicts or the wrong behavior.

- **Why this priority:** once Antigravity moves to the shared skills directory it overlaps with
  targets that already write there; a silent conflict would corrupt another target's output.
- **Independent test:** sync with Antigravity plus each other skills-based target, and check that
  every shared file exists once, is complete, and that the check command lists all of its owners.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given Antigravity and Codex are both selected, When I sync, Then each skill file is written once and
  the doctor command names both targets as its owners.
- Given the two targets would emit different text for the same file, When I sync, Then the result
  follows the rule recorded for shared files, and a difference that is not the self-report id is
  reported as an error naming both targets (as in feature 016 FR-007).
- Given Antigravity is deselected while Codex stays, When I sync, Then the shared skills remain.
- Given the shared skill reports which assistant is working, When several targets are selected, Then
  the reported identity follows one rule: `codex` wins over the Antigravity ids, and `antigravity`
  wins over `antigravity-cli`. The dashboard may then show the winning id for work done by the other
  target. (Assumption, 2026-11-04: the answer was left blank; this rule keeps Codex output
  byte-identical. Overrule if the dashboard distinction matters more.)

### US-4 — Everything else is unchanged and the docs are true  (priority: P2)

As an AmbyKit maintainer, I want only the Antigravity targets to change and the documentation to match
reality, so that no other assistant's output moves and the compatibility matrix can be trusted.

- **Why this priority:** feature 016's guarantee that existing targets stay byte-identical is what
  makes this change safe to ship; the matrix is the project's source of truth (Principle 4).
- **Independent test:** compare every non-Antigravity target's emitted files before and after; read
  the compatibility matrix against Antigravity's current documentation.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the recorded output of every target other than the two Antigravity ones, When I emit them after
  this feature, Then the files are byte-identical.
- Given the compatibility matrix, When I read the Antigravity entries, Then they describe skills, the
  retired workflows surface and the cutoff date, with sources.
- Given the dashboard's assistant recognition, When an Antigravity assistant reports in, Then it is
  still recognized under its existing identity.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL emit each workflow phase for the Antigravity IDE and Antigravity CLI targets
  as a skill in the form Antigravity currently loads, and SHALL NOT emit retired workflow files for
  them.
- FR-002  THE SYSTEM SHALL give each emitted skill the metadata Antigravity requires, with a name that
  matches its directory and uses only lowercase letters, digits and hyphens, and a description taken
  from the neutral phase prompt.
- FR-003  WHEN the neutral prompt uses the argument placeholder, THE SYSTEM SHALL rework it so no
  literal token remains in the Antigravity skill (feature 016 FR-005), by rewording it as prose.
- FR-004  THE SYSTEM SHALL keep the project-scoped, reversible nature of every emitted file and SHALL
  NOT write user-level Antigravity locations without explicit consent (Principle 7).
- FR-005  WHEN a project contains workflow files that a previous release generated for Antigravity, THE
  SYSTEM SHALL identify them as AmbyKit-generated (by their generated-file notice), leave them in
  place by default, and remove them only when the user passes an explicit opt-in.
- FR-006  THE SYSTEM SHALL NOT modify or remove any file in the retired workflows directory that
  AmbyKit did not generate.
- FR-007  WHEN the doctor command runs on a project with stale generated workflow files, THE SYSTEM
  SHALL report them, name the opt-in that removes them, and NOT treat them as drift.
- FR-008  WHEN two or more selected targets write the same skill file, THE SYSTEM SHALL write it once,
  name every owner in the doctor output, and keep the file for any remaining owner when one is
  removed (feature 016 FR-007).
- FR-009  IF two selected targets would write different contents to one path and the difference is more
  than the self-report identity, THEN THE SYSTEM SHALL fail with an error naming both targets and the
  path.
- FR-016  IF a skill path to be written already holds a file that AmbyKit did not generate (no
  generated-file notice), THEN THE SYSTEM SHALL NOT overwrite it and SHALL report the collision.
- FR-010  WHEN Antigravity and another skills-based target share a skill file, THE SYSTEM SHALL apply a
  single, documented rule for the self-report identity it carries: `codex` over `antigravity` over
  `antigravity-cli`.
- FR-011  THE SYSTEM SHALL leave the emitted output of every other target byte-identical.
- FR-012  THE SYSTEM SHALL keep recognizing Antigravity assistants in the dashboard under their
  existing identities.
- FR-013  THE SYSTEM SHALL update the compatibility matrix, the Antigravity rows of the README and CLI
  reference, and the workflow guide to describe the skills surface, the retired workflows surface and
  its cutoff date, citing Antigravity's documentation.
- FR-014  THE SYSTEM SHALL provide, for each Antigravity target, a snapshot test of the emitted paths
  and metadata against the matrix, and a test for each requirement above (Principle 5).
- FR-015  THE SYSTEM SHALL move both the IDE and the CLI target to skills now (decided 2026-11-04; the
  CLI already treats skills as slash commands). IF Antigravity's documentation later states that the
  cutoff does not apply to one product, THEN THE SYSTEM SHALL be able to emit workflows for that
  product alone without affecting the other.

## Success criteria

- SC-001  After a sync, every phase command is listed and runs in the Antigravity IDE and in the
  Antigravity CLI (live check on a current install), for 100% of the eleven phases.
- SC-002  Syncing a project that has the old workflow files ends in a state matching a fresh sync of
  the new release, apart from the stale-file handling chosen in US-2, with zero user-authored files
  changed.
- SC-003  With Antigravity plus any other skills-based target selected, every shared file appears
  exactly once and the doctor output lists every owner.
- SC-004  Re-emitting all targets other than the two Antigravity ones after this feature produces no
  diff.
- SC-005  Editing one neutral prompt and syncing updates the Antigravity skills with no hand editing.
- SC-006  Every requirement maps to an automated test except SC-001's live check; typecheck and the
  full test suite pass.
- SC-007  The compatibility matrix's Antigravity entries match Antigravity's documentation as checked
  on the day the feature ships, with sources.

## Edge cases

- A project selects the Antigravity IDE and CLI targets together: both write the same skills, so the
  files must be written once with a single self-report identity (US-3).
- A project selects Antigravity and Codex, so the same skill directory is read by both tools and a
  user could see each phase twice if a tool also reads another command surface.
- A project's own skill uses a name that collides with an AmbyKit phase skill: AmbyKit refuses to
  overwrite a file without its generated-file notice and reports it (FR-016).
- A user keeps an old Antigravity build that still runs workflows: they are not served, because the
  cutoff has passed and a skill wins over a workflow of the same name. (Assumption, 2026-11-04: the
  answer "it's ok" is read as accepting this; no transition period emits both surfaces. Overrule to
  keep dual output.)
- Antigravity's replacement for workflows ("a more powerful, dynamic way to define and use workflows")
  is announced but undocumented; a later change could require another migration.
- The retired workflows directory holds user-authored workflows that no longer run; AmbyKit does not
  convert them (Antigravity offers its own migration command).

## Assumptions

- Skills for Antigravity live in the project-level skills directory shared by the IDE and the CLI, with
  a required description and an optional name, per Antigravity's skills documentation (2026-11-04).
- Antigravity reads the shared `AGENTS.md` natively, so no rules file changes are needed.
- The Antigravity IDE and CLI targets can keep their two target ids, so existing configurations stay
  valid and the dashboard keeps both identities.
- AmbyKit-generated files are recognizable by their generated-file notice.
- Out of scope: converting users' own workflows to skills, Antigravity plugins, subagents and any
  user-level (global) skills location.
