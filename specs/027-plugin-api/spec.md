---
feature: 027-plugin-api          # NNN-slug
title: Plugin API for emitters and extensions
branch: 027-plugin-api
status: in-progress                     # draft | ready | in-progress | blocked | done
created: 2026-11-12
---

# Spec — Plugin API for emitters and extensions

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

AmbyKit supports 18 assistants from one core, so every upstream format change in any assistant is
otherwise an AmbyKit release. This feature opens the emitter layer: a **documented, semver-covered
plugin API** lets support for the long tail of assistants live in separate packages that release on
their own schedule, while the most-used targets stay built in. The same mechanism can later carry
custom phases, templates and roles. The API ships **experimental in 1.6** and is **frozen at 2.0**, not
earlier, so it does not lock in the 1.x spec shape before spec format v2 lands.

Reference model: Spec Kit's extensions and presets. Principles 1, 2, 4, 5 and 7 apply throughout.

**Out of scope:** pre-sales consulting features (estimates, proposals), which are candidates for a
plugin rather than core; a plugin marketplace or registry service; and any hosted service. Custom
phases, templates and roles (US-6) are out of scope for 1.6 and ship in a later 1.x release. Depends on
nothing; benefits from, but does not require, spec format v2 (spec 030) and the decision of spike 026.

## User scenarios & testing

### US-1 — Write a plugin emitter  (priority: P1)

As a plugin author, I want to support a new assistant by extending a documented base emitter, so that I
can add it without forking or waiting for a core release.

- **Why this priority:** this is the capability the whole feature exists to provide.
- **Independent test:** build a small plugin for a fictional assistant using only the documented API and
  confirm `sync` writes its files.
- **depends-on:** []
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the documented API, When an author extends the base emitter and sets only the paths and
  frontmatter that differ, Then the plugin emits that assistant's command files with no core change.
- Given the three extension points (base emitter, skills emitter, TOML command emitter), When an author
  picks the one matching their assistant's format, Then it needs no more than the overrides that differ
  (Principle 2).
- Given an assistant whose format fits none of the three, When an author extends the base emitter, Then
  it is still possible without touching the core.
- Given the API documentation, When an author reads it, Then every extension point, option and
  guarantee is described, with a worked example.

### US-2 — Discover and load plugins at sync  (priority: P1)

As a project maintainer, I want to list plugin packages in config and have `sync` load them, so that
adding an assistant is a config line, not a code change.

- **Why this priority:** without discovery, plugins cannot be used.
- **Independent test:** list a plugin package in config, run `sync`, and confirm its target is emitted
  and a second run produces no diff.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a config entry naming an `ambykit-emitter-*` package, When `sync` runs, Then the plugin's
  target is emitted like a built-in one.
- Given a listed package that is not installed or fails to load, When `sync` runs, Then it reports which
  package and why, and still syncs every other target.
- Given a plugin target with the same name as a built-in target, When it is loaded, Then the conflict is
  reported and neither silently overrides the other.
- Given a plugin, When `sync` runs twice, Then the second run produces no diff (Principle 6).
- Given a package whose name does not match the naming convention, When listed, Then it is rejected
  with a clear message.

### US-3 — Prove a plugin against its compatibility row  (priority: P1)

As a plugin author, I want a published test kit, so that I can prove my plugin's paths and frontmatter
match what the assistant actually expects.

- **Why this priority:** it keeps plugin quality in line with built-ins (Principle 5) and gives users a
  basis to trust a plugin.
- **Independent test:** run the test kit against a plugin and confirm it passes with a correct row and
  fails with a wrong path or key.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a plugin and its row of the compatibility matrix, When the test kit runs, Then it checks the
  emitted paths and frontmatter keys against that row.
- Given a plugin that emits a wrong path or an unknown key, When the kit runs, Then it fails and names
  the difference.
- Given a plugin with no compatibility row, When the kit runs, Then it fails and says a row is required
  (Principle 4).
- Given the kit, When a plugin author adds it to their project, Then it runs in their own test suite and
  needs no AmbyKit checkout.

### US-4 — Trust a documented, versioned API  (priority: P1)

As a plugin author, I want clear stability promises, so that I know when my plugin may break.

- **Why this priority:** a plugin ecosystem needs predictable compatibility, but the promise must not be
  made too early.
- **Independent test:** read the API version a plugin declares, and confirm loading rejects an
  incompatible one with a clear message.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the API in 1.6, When it is documented, Then it is labelled experimental and may change in minor
  releases.
- Given the API in 2.0, When it is released, Then it is covered by semver: breaking changes need a major
  version.
- Given a plugin that declares the plugin-API semver range it targets in its package metadata (for
  example `^1`), When it is loaded by a core whose API version is outside that range, Then loading is
  refused with the expected range and the found version.
- Given a change to the API, When it is released, Then the changelog states whether it affects plugins.

### US-5 — Keep the core lean  (priority: P2)

As an AmbyKit maintainer, I want the long-tail targets to move to official plugins, so that upstream
format churn no longer forces core releases.

- **Why this priority:** it is the maintenance payoff, but it depends on the API proving itself first.
- **Independent test:** move one target out of the core to an official plugin and confirm existing
  projects keep working.
- **depends-on:** [US-2, US-3]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given the set of targets, When the split is decided, Then each target is recorded as built in or
  official plugin with the evidence used: issue and npm demand, and upstream format churn. The
  confirmed split is: built in = Claude, Copilot, Cursor, OpenCode, Codex and Antigravity (instead of
  Gemini); all other targets become official plugins.
- Given a target moved to a plugin, When an existing project that used it runs `sync`, Then it is told
  which package to install, and nothing is removed without consent.
- Given an official plugin, When its upstream format changes, Then it can release without a core
  release.
- Given the 2.0 gate, When the split is reviewed, Then the measures are re-checked and the list adjusted.

### US-6 — Extend beyond emitters  (priority: P3)

> DEFERRED to a later 1.x release (not 1.6).

As a team, I want plugins to carry custom phases, templates and roles, so that we can add, for example, a
security-review phase or a compliance template.

- **Why this priority:** a later extension of the same mechanism; emitters come first.
- **Independent test:** load a plugin that adds one role and one template and confirm they are emitted
  like built-in ones.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a plugin that provides a role file, When `sync` runs, Then the role is emitted for each target.
- Given a plugin that provides a phase or template, When `sync` runs, Then it is emitted like a built-in
  one and cannot replace a built-in one without explicit configuration.
- Given such extensions, When the project is analyzed, Then their artifacts follow the same ID
  conventions.
- Given the 1.6 release, When it ships, Then it contains only the experimental emitter API; this story
  ships in a later 1.x release, after emitter plugins have proven the loading model.

### US-7 — Load third-party code safely  (priority: P1)

As a project maintainer, I want to control which plugin code runs and where it can write, so that
installing a plugin cannot silently change my machine or repo.

- **Why this priority:** loading third-party code is the main risk of this feature (Principle 7).
- **Independent test:** list a plugin and confirm nothing runs until the listing is explicit, and that
  writes outside the project need consent.
- **depends-on:** [US-2]
- **blocked-by:** []
- **status:** done

**Acceptance criteria**
- Given a package that is installed but not listed in config, When `sync` runs, Then it is not loaded.
- Given a plugin that tries to write outside the project, When `sync` runs, Then the write is refused
  unless the person has consented (Principle 7), and consent is not part of the sync-diff check.
- Given a plugin's first load, When `sync` runs, Then the person sees which package and version is being
  loaded.
- Given a plugin listed in config without an exact version, When `sync` runs, Then it is not loaded and
  the missing version is reported.
- Given a trust model, When it is applied, Then it is documented, including what a plugin can and cannot
  do: a plugin loads only if explicitly listed with an exact version, nothing is auto-discovered, and
  there is no sandbox.

### US-8 — Existing projects keep working  (priority: P1)

As a maintainer of existing AmbyKit projects, I want built-in targets and `sync` to behave as before, so
that adopting the plugin API requires no migration.

- **Why this priority:** 1.x must stay additive; the experimental API must not disturb current users.
- **Independent test:** run `sync` on an existing project before and after and confirm identical output.
- **depends-on:** []
- **blocked-by:** []
- **status:** in-progress

**Acceptance criteria**
- Given a project with no plugins listed, When `sync` runs, Then output is identical to before.
- Given a built-in target, When the plugin API is introduced, Then its emitted files are unchanged.
- Given the repo's own self-hosted sync, When the API lands, Then it still produces no diff (Principle 6).

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL expose the base emitter, the skills emitter and the TOML command emitter as
  documented extension points that a plugin extends by overriding only what differs.
- FR-002  THE SYSTEM SHALL document every extension point, option and guarantee of the plugin API with
  a worked example.
- FR-003  WHEN config lists a package named `ambykit-emitter-*`, THE SYSTEM SHALL load it at sync and
  emit its targets like built-in ones.
- FR-004  IF a listed package is missing or fails to load, THEN THE SYSTEM SHALL report the package and
  reason and SHALL still sync all other targets.
- FR-005  IF a plugin target name collides with a built-in or another plugin target, THEN THE SYSTEM
  SHALL report the conflict and SHALL NOT let either silently override the other.
- FR-006  THE SYSTEM SHALL NOT load a package that is not explicitly listed in config with an exact
  version, SHALL NOT auto-discover plugins, and SHALL NOT sandbox plugin code.
- FR-007  IF a plugin attempts to write outside the project, THEN THE SYSTEM SHALL refuse unless the
  person has consented, and SHALL keep consented out-of-tree files out of the sync-diff check
  (Principle 7).
- FR-008  WHEN `sync` loads plugins, THE SYSTEM SHALL print each loaded plugin's package name and
  version.
- FR-009  THE SYSTEM SHALL provide a published test kit that checks a plugin's emitted paths and
  frontmatter keys against its compatibility-matrix row, and SHALL fail when the row is missing
  (Principles 4 and 5).
- FR-010  THE SYSTEM SHALL let a plugin declare, in its package metadata, the plugin-API semver range it
  targets (for example `^1`) and SHALL refuse to load a plugin whose range excludes the running API
  version, naming the expected range and the found version.
- FR-011  THE SYSTEM SHALL label the plugin API experimental in 1.6 and cover it with semver from 2.0.
- FR-012  WHEN the API changes in a release, THE SYSTEM SHALL state in the changelog whether plugins are
  affected.
- FR-013  THE SYSTEM SHALL record, for each target, whether it is built in or an official plugin and the
  evidence used (issue and npm demand, upstream format churn), and SHALL review it at the 2.0 gate.
- FR-014  WHEN a project uses a target that moved to a plugin, THE SYSTEM SHALL tell the person which
  package to install and SHALL NOT remove existing files without consent.
- FR-015  WHERE a plugin provides roles, phases or templates (in a later 1.x release, not 1.6), THE
  SYSTEM SHALL emit them like built-in ones and SHALL NOT let them replace a built-in one without explicit configuration.
  DEFERRED to a later 1.x release.
  uncovered: FR-015 — deferred to a later 1.x release (US-6); no 1.6 behavior to test.
- FR-016  WHERE no plugins are listed, THE SYSTEM SHALL produce `sync` output identical to the previous
  release.
- FR-017  WHEN `sync` runs twice with the same plugins, THE SYSTEM SHALL produce no diff on the second
  run (Principle 6).

## Success criteria

- SC-001  A plugin for a new assistant can be written, tested with the kit and used by `sync` without any
  change to the AmbyKit core.
- SC-002  Every official plugin passes the contract test kit against its matrix row before release.
- SC-003  A project with no plugins listed produces byte-identical `sync` output before and after the
  feature.
- SC-004  No unlisted package is ever loaded, and no out-of-tree write happens without recorded consent.
- SC-005  An upstream format change to a plugin-hosted target is released without an AmbyKit core
  release.
- SC-006  Every FR maps to at least one test (Principle 5), and `npm run typecheck` and `npm test` pass.
- SC-007  The core-versus-plugin split is reviewed at the 2.0 gate using the recorded demand and churn
  measures.

## Edge cases

- Two plugins that provide the same target name.
- A plugin that throws during load or emit.
- A plugin written for a newer API than the installed core, or an older one.
- A plugin installed globally or in a parent directory rather than the project.
- A plugin that changes a built-in target's behavior by extending it.
- A target moved to a plugin while projects still pin the old core version.
- A plugin whose compatibility row lives in the plugin's repo rather than in AmbyKit's matrix.
- Offline installs, or a plugin whose package name is taken over by someone else.
- A project that lists a plugin on one machine but not on a teammate's.

## Assumptions

- Spec format v2 (spec 030), whose shape is decided by spike 026, lands before the API is frozen at
  2.0, so plugins target the final shape and this spec cites 026's decision by ID.
- Targets continue to be described by a row in the compatibility matrix, and a plugin's row is the
  reference for its contract tests.
- The Spec Kit extensions and presets model is used as the reference, but not copied.
- Plugin packages are distributed through the standard package registry the CLI is already installed
  from; no separate registry is built here.
- The built-in set is the confirmed split in US-5, reviewed at the 2.0 gate against demand and churn.
