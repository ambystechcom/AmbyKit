---
feature: 016-agent-surface-expansion
title: Agent surface expansion — eight new assistants, verified formats only
branch: 016-agent-surface-expansion
status: ready
created: 2026-09-18
---

# Spec — Agent surface expansion — eight new assistants, verified formats only

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

## Problem

AmbyKit emits to ten targets across six assistant families. Competing SDD frameworks reach roughly
seventeen, and breadth of assistant support is the most common reason a team picks a competitor: a
framework that does not speak your assistant is not a candidate, however good its artifacts are. Nine
assistants are missing — Gemini CLI, Windsurf, Qwen Code, Kiro, Kilocode, Augment Code, LLxprt Code,
Amazon Q, and Pi. Amazon Q is out of scope (see Edge cases), leaving eight to add.

Two things make this more than mechanical. First, at least one missing target does not use
markdown-with-frontmatter for its commands, which is the only command shape the emitter base currently
expresses — so the base abstraction, not just a subclass, has to grow. Second, Principle 4 forbids
guessing: every path, file extension, and frontmatter key must come from official documentation before
any emitter is written, and any format that cannot be verified must be declared out of scope rather
than approximated.

## User scenarios & testing

### US-1 — Formats are verified before anything is emitted  (priority: P1)

As a maintainer, I want every new target's paths and frontmatter recorded from official documentation
before an emitter exists, so that AmbyKit never writes a file shape it invented.

- **Why this priority:** Principle 4 makes this a precondition for all other stories; an emitter built
  on a guessed format is worse than no emitter, because it fails silently in the user's project.
- **Independent test:** For each of the eight targets, the compatibility matrix names the command
  directory, file extension, frontmatter keys, rules-file behavior, and argument placeholder, each
  traceable to an official source; anything unverified is listed as out of scope with the reason.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a candidate target, When its row is added to the compatibility matrix, Then command directory,
  file extension, frontmatter keys, rules-file location, argument placeholder, and scope (project or
  user level) are each recorded with an official source.
- Given a format that cannot be verified from official documentation, When the research pass finishes,
  Then that target is recorded as out of scope with the reason, and no emitter is written for it.
- Given a target whose commands are installed outside the repository, When its row is written, Then the
  out-of-tree path is flagged so it can be excluded from the sync check and gated on consent
  (Principle 7).
- Given the research pass is complete, When the docs-sync checker runs, Then it passes.

### US-2 — Markdown-command assistants are supported  (priority: P1)

As a user of Windsurf, Qwen Code, Kilocode, or Augment Code, I want AmbyKit to emit
my assistant's native commands, so that I can run the workflow without translating anything by hand.

- **Why this priority:** The largest group of missing targets, and each is a thin subclass once its
  format is verified.
- **Independent test:** For each target, `ambykit init` with only that target selected produces command
  files at the documented paths with the documented frontmatter, and a snapshot test asserts both.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a verified markdown-command target, When sync runs, Then one command file per phase appears at
  the documented path with the documented frontmatter keys and no others.
- Given a target that reads `AGENTS.md` natively, When sync runs, Then no redundant tool-specific rules
  file is emitted.
- Given a target that does not read `AGENTS.md`, When sync runs, Then a bridge or pointer rules file is
  emitted and an existing user-authored rules file is preserved and merged, never overwritten.
- Given a new target is added, When the existing targets are re-emitted, Then their output is
  byte-identical to before (no regressions).
- Given a new target, When it is implemented, Then it is a subclass overriding only what differs, with
  no duplicated orchestration (Principle 2).

### US-3 — A non-markdown command format is expressible  (priority: P1)

As a Gemini CLI or LLxprt Code user, I want AmbyKit to emit commands in the format my assistant actually reads, even
though it is not markdown with YAML frontmatter, so that these are first-class targets rather than
an exception.

- **Why this priority:** It is the single largest missing audience and the only story that requires
  changing the emitter base, so it carries the architectural risk and should be settled early.
- **Independent test:** With only Gemini CLI (or only LLxprt Code) selected, sync produces command files in the documented
  non-markdown format that the assistant loads successfully, verified against a live install.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a target whose commands are not markdown with YAML frontmatter, When sync runs, Then its files
  are emitted in its documented format, correctly escaped for that format.
- Given the neutral prompt body contains an argument placeholder, When it is emitted, Then the
  placeholder is translated to that format's convention, or reworked into prose where the format has
  none, as already done for targets without placeholders.
- Given the base emitter grows to express this format, When every existing target is re-emitted, Then
  output is byte-identical to before.
- Given a prompt body containing characters that are special in the target format, When it is emitted,
  Then the file remains valid and a test asserts the escaping.
- Resolved 2026-10-26 (Principle 4): Gemini CLI reads TOML files under `.gemini/commands/` with a
  required `prompt` and optional `description` key and the `{{args}}` placeholder; LLxprt Code reads
  the same shape under `.llxprt/commands/`. Sources are recorded in the compatibility matrix; the live
  load is SC-006.

### US-4 — Skill-host assistants reuse the existing skills surface  (priority: P2)

As a Pi or Kiro user, I want AmbyKit to emit the project-local skill packages my assistant reads, so
that support costs almost nothing and behaves like the existing skill targets.

- **Why this priority:** Cheapest target in the set, but it depends on the research pass and is a
  smaller audience than US-2 or US-3.
- **Independent test:** With only Pi selected, sync produces skill packages at the documented path; with
  Pi and Codex both selected, the shared directory is written once and both are recorded as owners.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a skill-host target, When sync runs, Then skill packages appear at the documented project-local
  path in the documented shape.
- Given two skill-host targets sharing one directory, When sync runs, Then files are written once and
  both targets are recorded as owners.
- Given one of two owning targets is removed, When sync runs, Then shared files still used by the
  remaining target are kept, not deleted.
- Given a skill-host target, When it is implemented, Then it reuses the existing skills emitter rather
  than introducing a parallel implementation (Principle 2).

### US-5 — Breadth does not degrade the maintenance story  (priority: P2)

As a maintainer, I want eighteen targets to cost about what ten cost, so that a prompt change stays a
one-line edit plus a regenerate rather than a day of snapshot triage.

- **Why this priority:** Without this, the expansion becomes a tax on every future feature.
- **Independent test:** Change one neutral prompt, run sync, and confirm every target updates with no
  hand editing and the sync check reports no drift.
- **depends-on:** [US-2, US-3, US-4]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a change to one neutral prompt, When sync runs, Then every target reflects it with no per-tool
  hand editing (Principle 1).
- Given all targets, When the test suite runs, Then each has a snapshot test asserting its paths and
  frontmatter against the compatibility matrix (Principle 5).
- Given the target list, When a user runs the selector, Then eighteen targets are choosable and the
  selector remains usable at that length.
- Given the doctor command, When it runs, Then it verifies the new targets' files and reports drift for
  them as it does for existing ones.
- Given a target's documented format changes upstream, When its matrix row is updated, Then exactly one
  emitter and one snapshot change.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL record, for each new target, the command directory, file extension,
  frontmatter keys, rules-file behavior, argument placeholder convention, and scope in
  `docs/tool-compatibility.md`, each traceable to official documentation (Principle 4).
- FR-002  IF a target's format cannot be verified from official documentation, THEN THE SYSTEM SHALL
  declare that target out of scope with a recorded reason and SHALL NOT emit files for it.
- FR-003  THE SYSTEM SHALL add support for Gemini CLI, Windsurf, Qwen Code, Kiro, Kilocode, Augment
  Code, LLxprt Code, and Pi, subject to FR-002; Amazon Q is declared out of scope under FR-002.
- FR-004  THE SYSTEM SHALL express command surfaces that are not markdown with YAML frontmatter,
  including correct escaping for the target format.
- FR-005  WHEN a target's format has no argument placeholder, THE SYSTEM SHALL rework the neutral
  placeholder into prose rather than emitting an unsubstituted token.
- FR-006  THE SYSTEM SHALL implement each new target as a subclass overriding only what differs, with
  no duplicated orchestration (Principle 2).
- FR-007  WHEN a new target shares a directory with an existing target, THE SYSTEM SHALL write shared
  files once, record every owner, and preserve files still used by a remaining owner when one target is
  removed.
- FR-008  WHERE a target's command or configuration location is outside the repository, THE SYSTEM SHALL
  write it only with explicit consent and SHALL exclude it from the sync check (Principle 7).
- FR-009  WHEN a new target reads `AGENTS.md` natively, THE SYSTEM SHALL NOT emit a redundant
  tool-specific rules file; otherwise it SHALL emit a bridge or pointer file and merge
  non-destructively into an existing user-authored rules file.
- FR-010  THE SYSTEM SHALL keep output for all pre-existing targets byte-identical after this feature.
- FR-011  THE SYSTEM SHALL provide a snapshot test per target asserting emitted paths and frontmatter
  against the compatibility matrix (Principle 5).
- FR-012  THE SYSTEM SHALL include every new target in the doctor command's presence and drift checks.
- FR-013  THE SYSTEM SHALL keep the target selector usable at eighteen targets.
- FR-014  THE SYSTEM SHALL update the README, workflow guide, and CLI reference to list the supported
  targets, passing the docs-sync checker.

## Success criteria

- SC-001  Every implemented target has a matrix row with an official source, and every unverified
  target is listed as out of scope with a reason.
- SC-002  Eighteen targets are selectable, or fewer with each omission recorded under FR-002.
- SC-003  Selecting one new target at a time produces exactly the documented files and nothing else,
  asserted per target by snapshot test.
- SC-004  Re-emitting the ten pre-existing targets after this feature produces no diff.
- SC-005  Editing one neutral prompt updates every target via sync with no hand editing, and the sync
  check reports no drift.
- SC-006  The non-markdown target's emitted files load successfully in a live install of that
  assistant, recorded as a manual verification step.
- SC-007  Every FR maps to an automated test except SC-006's live check; `npm run typecheck` and
  `npm test` pass.

## Edge cases

- A target documented only in a blog post or changelog rather than official reference docs — treat as
  unverified under FR-002.
- Amazon Q is described upstream as legacy — declared out of scope deliberately (resolved
  2026-10-26): its CLI line continues as Kiro CLI, which US-2 already targets. Recorded under FR-002
  with that reason, so the target count is eighteen.
- Two new targets that both claim the same directory with different file shapes — record the collision
  in the matrix and decide ownership before implementing.
- A target whose commands live only at user level, with no project-scoped option — consent-gated and
  excluded from the sync check; note that such a target cannot be version-controlled with the project.
- A target that supports personas or sub-agents — role emission applies only where the format is
  verified, consistent with feature 013.
- A target whose command names cannot contain a dot, breaking the `amby.*` namespace — record the
  naming fallback in the matrix.
- Selector length at eighteen entries on a short terminal — must remain navigable.
- Several new targets (Gemini CLI, Qwen Code, LLxprt Code, Kilocode, Augment Code, Windsurf, Pi) also
  read the shared `.agents/skills/` directory. When one of them is selected together with Codex, it
  sees each phase both as its own command and as a skill. AmbyKit cannot stop another tool from
  reading a directory, so the overlap is documented in the matrix rather than suppressed.
- A target whose skill names forbid dots (Kiro) uses the hyphenated `amby-<phase>` names already used
  for Codex.

## Assumptions

- Project-scoped, committed command files remain the preference; user-level emission is a fallback
  required by a target's design, not a choice.
- The `amby.*` command namespace is retained on every new target unless the target forbids it.
- The phase set emitted to new targets is whatever feature 014 settles on; this feature adds targets,
  not phases, and should land after 014 so each new snapshot is written once.
- Breadth is worth the maintenance only because emitters are thin; if a target requires substantial
  bespoke logic, that is a signal to reconsider rather than to duplicate orchestration.
