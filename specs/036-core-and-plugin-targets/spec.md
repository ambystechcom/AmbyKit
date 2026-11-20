---
feature: 036-core-and-plugin-targets          # NNN-slug
title: Core targets and official plugin targets
branch: 036-core-and-plugin-targets
status: draft                     # draft | ready | in-progress | blocked | done
created: 2026-11-20
---

# Spec — Core targets and official plugin targets

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

AmbyKit emits files for 15 assistant targets, and every upstream format change in any of them forces a core release.
Spec 027 made the emitter plugin API and decided that long-tail targets move to official plugins; spec 033 makes that
API stable in 2.0. This feature applies the split: the owner's decision of 2026-11-20 is that the targets built into
the core for 2.0 are **Claude Code, Codex, Copilot, Cursor and OpenCode**, with their existing variants. Every other
registered target becomes an **official plugin**, published separately and maintained by the project, so each can
release when its upstream format changes. Nobody who uses a moved target loses it or has files removed without consent.

**Reading of the decision (flagged):** Antigravity is not on the owner's list, so it moves out. That reverses the split
recorded in 027:US-5, which kept Antigravity built in. [NEEDS CLARIFICATION: confirm Antigravity (`antigravity`,
`antigravity-cli`) moves to a plugin]

**Out of scope:** the plugin API itself (027, 033); new targets; per-assistant behaviour changes; third-party plugins.

## Target map (from the registry and `docs/tool-compatibility.md`)

| Product | Registered ids | 2.0 |
|---|---|---|
| Claude Code | `claude`, `claude-vscode` (alias) | built in |
| Codex | `codex` | built in |
| GitHub Copilot | `copilot`, `copilot-cli` | built in |
| Cursor | `cursor`, `cursor-cli` | built in |
| OpenCode | `opencode` | built in |
| Antigravity | `antigravity`, `antigravity-cli` | plugin (flagged above) |
| Long tail | `gemini`, `llxprt`, `qwen`, `kilo`, `augment`, `windsurf`, `kiro` | plugin (027:US-5: "all other targets") |
| Pi | `pi` (alias of the Codex emitter) | [NEEDS CLARIFICATION: stays an alias of built-in `codex`, or moves with the plugins?] |

## User scenarios & testing

### US-1 — An existing project keeps its moved target  (priority: P1)

As a user of a moved target, I want `sync`, `init`, `check` and `update` to keep emitting it, so that 2.0 does not
break my setup.

- **Why this priority:** removing a target from the core must not remove it from a person's project.
- **Independent test:** a project configured for `antigravity` with its plugin installed produces the same files as 1.x.
- **depends-on:** [027:US-2, 033:US-4]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a project that lists a moved target and has its official plugin installed and listed, When `sync` runs, Then the
  files are byte-identical to what 1.x emitted.
- Given a project that lists a moved target and the plugin is not installed, When `sync`, `check` or `update` runs, Then
  it names the target and prints the exact install and config lines, and fails only that target, not the others.
- Given that situation, When any command runs, Then no file the target previously emitted is deleted or changed.
- Given a built-in target, When any command runs, Then behaviour is unchanged.

### US-2 — Official plugins exist and are published  (priority: P1)

As a maintainer, I want each moved target built as a plugin on the stable API, so that it can release without a core
release.

- **Why this priority:** without the packages the move is a removal.
- **Independent test:** install one official plugin and run the contract kit against its compatibility row.
- **depends-on:** [027:US-1, 027:US-3, 033:US-4]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a moved target, When its plugin is built, Then it is an `ambykit-emitter-*` package published under the
  project's npm scope, with its API range declared. [NEEDS CLARIFICATION: package names, e.g.
  `@ambystech/ambykit-emitter-antigravity`, and one package per target or one bundle]
- Given the plugin, When the published contract kit runs, Then it passes the emitted-path, frontmatter and idempotence
  checks against the target's row in the compatibility doc.
- Given an upstream format change for a moved target, When it is fixed, Then only that plugin is released.

### US-3 — Move without surprise  (priority: P1)

As a person upgrading from 1.x, I want to be told what moved and what to do, so that I am never surprised by a missing
target.

- **Why this priority:** the move is a 2.0 breaking change and must be in the migration path.
- **Independent test:** upgrade a 1.6 project that lists three moved targets and follow only the printed steps.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the 2.0 changelog and migration guide, When a user reads them, Then the moved targets, their package names and
  the install line are listed.
- Given a config that lists a moved target, When `update` runs, Then it offers the install and config change and writes
  nothing user-level without consent (Principle 7).
- Given `ambykit init` in a new project, When targets are offered, Then built-in targets are listed and moved targets
  appear as "official plugin, install first" with the install line.

### US-4 — The core and the docs match the split  (priority: P2)

As a contributor, I want the code, goldens and docs to reflect the split, so that nothing claims a built-in target that
is not.

- **Why this priority:** a stale compatibility table misleads users and contributors.
- **Independent test:** compare the registry, the compatibility doc and the README target list.
- **depends-on:** [US-1, US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the 2.0 registry, When listed, Then it holds the built-in ids of the table above and no others.
- Given `docs/tool-compatibility.md` and the README, When read, Then each target is marked built in or official plugin
  with its package, and the doc-sync check passes.
- Given the golden fixtures, When re-recorded, Then built-in targets are unchanged and each moved target's golden lives
  with its plugin and is checked by the plugin's contract run.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL keep `claude`, `claude-vscode`, `codex`, `copilot`, `copilot-cli`, `cursor`, `cursor-cli` and
  `opencode` built in for 2.0.
- FR-002  THE SYSTEM SHALL move every other registered target to an official plugin, subject to the clarifications above.
- FR-003  WHERE a project lists a moved target and its plugin is installed and listed, THE SYSTEM SHALL emit files
  byte-identical to 1.x.
- FR-004  IF a project lists a moved target whose plugin is not installed, THEN THE SYSTEM SHALL name the target, print
  the install and config lines, continue with the other targets and exit non-zero.
- FR-005  THE SYSTEM SHALL NOT delete or rewrite files emitted for a moved target because its plugin is missing.
- FR-006  THE SYSTEM SHALL NOT write a user-level file or install a package without explicit consent (Principle 7).
- FR-007  THE SYSTEM SHALL publish each official plugin with its plugin-API range declared and passing the published
  contract kit against its compatibility row.
- FR-008  WHEN a moved target's upstream format changes, THE SYSTEM SHALL allow releasing its plugin alone.
- FR-009  THE SYSTEM SHALL list moved targets, package names and install lines in the 2.0 changelog and migration guide.
- FR-010  THE SYSTEM SHALL present moved targets in `init` as official plugins with the install line.
- FR-011  THE SYSTEM SHALL mark each target built in or official plugin in `docs/tool-compatibility.md` and the README,
  and keep the doc-sync check passing.
- FR-012  THE SYSTEM SHALL keep golden fixtures for built-in targets unchanged and move each moved target's fixture to
  its plugin's contract run.

## Success criteria

- SC-001  A 1.6 project using a moved target upgrades to 2.0, installs the plugin and gets byte-identical files.
- SC-002  Without the plugin, no file is removed and the message names the exact install line.
- SC-003  Each official plugin passes the contract kit; one upstream-format fix ships as a plugin release only.
- SC-004  Every FR maps to at least one test (Principle 5), and `npm run typecheck` and `npm test` pass.

## Edge cases

- A project lists both `codex` and a moved target that shares `.agents/skills` (co-owned directories: removing one owner
  leaves the files for the rest).
- A plugin is installed but not listed in config, or listed with a version that does not match (027:FR-006).
- `check` on a project whose moved-target plugin is installed but outdated for the stable API.
- Offline or no registry access during `update`.
- A moved target whose official plugin has not been published yet at 2.0: [NEEDS CLARIFICATION: is publishing every
  plugin a 2.0 gate, or may a target stay built in until its plugin ships?]

## Assumptions

- Spec 033 (stable plugin API) is met first; plugins are built against the frozen surface.
- The contract kit (027, `@ambystech/ambykit/testkit`) is enough to prove a plugin; no new checks are required.
- Plugin packages are maintained by the project, not third parties, and live under the project's npm scope.
- The moved targets' file formats are those in `docs/tool-compatibility.md`; this feature does not change them.
