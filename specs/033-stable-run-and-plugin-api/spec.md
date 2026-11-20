---
feature: 033-stable-run-and-plugin-api          # NNN-slug
title: Stable run and plugin API
branch: 033-stable-run-and-plugin-api
status: ready                     # draft | ready | in-progress | blocked | done
created: 2026-11-20
---

# Spec — Stable run and plugin API

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Two surfaces ship labelled **experimental**: `ambykit run` (spec 028, multi-feature fleets in 031) and the emitter
plugin API (spec 027, `PLUGIN_API_VERSION`). Experimental means "may change in any release", which is the right label
while neither has been used for real. For 2.0 both are to become **stable**: a person can build on them and expect
them not to break until the next major version. Stable is a promise, so this feature defines what is promised,
what must be true before the label changes, and how a stable thing is later changed or removed. It does not add
capabilities to `run` or to plugins.

**Out of scope:** new run or plugin features; which assistants ship as built-in targets versus plugins (decided by the
owner and specified in spec 036); the release itself (spec 034).

## User scenarios & testing

### US-1 — Know exactly what "stable" promises  (priority: P1)

As a person building on AmbyKit, I want a written list of what is stable, so that I know what I can rely on.

- **Why this priority:** a promise nobody can read is not a promise; everything else here refers to this list.
- **Independent test:** open the contract document and confirm it names, for `run` and for the plugin API, every
  command, flag, exit code, state file and exported name that is covered.
- **depends-on:** []
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the contract document, When a person reads the `run` section, Then it lists the flags, the exit codes, the printed
  plan and finish lines' structure, the layout of the fleet state files and the directive protocol it promises.
- Given the contract document, When a person reads the plugin section, Then it lists the exported names, the plugin
  descriptor shape, the loading rules and the test kit it promises.
- Given something not in the document, When it changes, Then that is not a breaking change.
- Given the document, When a flag or file is added, Then adding is allowed in a minor release and the document says so.

### US-2 — `run` is verified live before it loses "experimental"  (priority: P1)

As a maintainer, I want `run` marked stable only after each runner has been verified on a real install, so that
the label never over-promises (Principle 4).

- **Why this priority:** 028's runners are listed as unverified; shipping them stable would claim what nobody checked.
- **Independent test:** read the runner table and confirm every runner marked stable has a recorded live check.
- **depends-on:** [028:US-3]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a runner, When it is listed as runnable in a stable `run`, Then a record exists of the assistant version, the
  headless invocation, prompt delivery, exit behaviour and usage reporting checked on a live install.
- Given a runner with no such record, When `run` is stable, Then it is not runnable by default and the plan says it
  is unverified.
- Given a runner's verified flag, When it is set, Then it is set only from a recorded check (028's T044 and T045).
- Given Windows, When `run` launches an assistant that ships as a `.cmd` shim, Then that path has been exercised on a
  real Windows install before the label changes.

### US-3 — One fleet builds two dependent features  (priority: P1)

As a maintainer, I want the fleet scenario proven end to end on AmbyKit itself, so that "stable" rests on real use
(Principle 6).

- **Why this priority:** it is the 2.0 gate for multi-feature fleets and the only test against a live assistant.
- **Independent test:** read the recorded dogfood run and confirm two dependent features were built by one fleet.
- **depends-on:** [031:US-1, 031:US-3, US-2]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given two dependent features of this repository, When one fleet builds them with a verified runner, Then the second
  starts only after the first has merged and no start, order or merge step was done by hand.
- Given the run, When it ends, Then its fleet run id, runner, versions and result are recorded in the feature's notes.
- Given the run did not complete, When the gate is read, Then it is not met and `run` stays experimental.

### US-4 — The plugin API is frozen  (priority: P1)

As a plugin author, I want the API version and contract frozen, so that my plugin keeps working across 2.x.

- **Why this priority:** a plugin author cannot rely on a surface that still changes.
- **Independent test:** load a plugin written against the frozen API in the next minor release and confirm it works.
- **depends-on:** [027:US-4, US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given the 2.0 release, When the API version is read, Then it is a 2.x version and the experimental marker is gone from
  the exports, the docs and the changelog convention.
- Given the contract kit, When a plugin runs it, Then the kit checks the frozen surface and nothing outside it.
- Given the frozen API, When a change would break an existing plugin, Then it is held for the next major version.
- Given a plugin written for the 1.x experimental API, When it is loaded, Then the loader says plainly that the API
  moved and what to change, instead of failing in an unrelated place.

### US-5 — A stable thing is changed by a published policy  (priority: P2)

As a user of a stable surface, I want to know how it can change, so that nothing is removed without notice.

- **Why this priority:** the policy is what makes the stable label useful after 2.0.
- **Independent test:** read the policy and apply it to a hypothetical rename; confirm the steps are unambiguous.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a stable flag, command or exported name, When it is to be removed, Then it is first deprecated in a minor
  release with a one-line notice that names its replacement, and removed only in the next major release.
- Given a deprecated name, When it is used, Then the notice is printed once per run, to the error stream, and the
  command still works.
- Given a security fix, When it must break a stable behaviour, Then the policy allows it and requires the changelog to say so.

### US-6 — Existing runs and plugins keep working  (priority: P2)

As an existing user, I want my 1.6 fleet state and my plugins to survive the label change, so that I am not stranded.

- **Why this priority:** stable must not be bought by breaking what people already started.
- **Independent test:** resume a run directory written by 1.6 and load a plugin written for the 1.0 API.
- **depends-on:** [027:US-8, US-4, US-1]
- **blocked-by:** []
- **status:** draft

**Acceptance criteria**
- Given a fleet run directory written by 1.6, When 2.0 resumes it, Then it continues without repeating completed lanes.
- Given a plugin that targeted the 1.0 API, When 2.0 loads it, Then it loads if the frozen surface still covers what it
  uses, and otherwise reports exactly which names it relied on.

## Requirements (EARS)

- FR-001  THE SYSTEM SHALL publish one contract document that lists the stable surface of `run` and of the plugin API.
- FR-002  WHERE something is not in the contract document, THE SYSTEM SHALL treat changing it as not breaking.
- FR-003  THE SYSTEM SHALL allow additions to a stable surface in a minor release and SHALL say so in the document.
- FR-004  WHERE a runner is listed as runnable, THE SYSTEM SHALL have a recorded live verification for it, and SHALL
  set its verified flag only from that record.
- FR-005  IF a runner has no recorded verification, THEN THE SYSTEM SHALL NOT run it by default and SHALL say it is unverified.
- FR-006  THE SYSTEM SHALL NOT remove the experimental label from `run` until one fleet has built two dependent features
  of this repository with a verified runner, recorded in the feature's notes.
- FR-007  WHEN 2.0 is released, THE SYSTEM SHALL carry a 2.x plugin API version and no experimental marker in exports,
  docs or the changelog convention.
- FR-008  THE SYSTEM SHALL keep the contract kit checking only the frozen surface.
- FR-009  WHEN a plugin written for the 1.x API is loaded, THE SYSTEM SHALL load it if the frozen surface covers what it
  uses, and otherwise name the names it relied on and what to change.
- FR-010  THE SYSTEM SHALL deprecate a stable name for one minor release, with a one-line notice naming the
  replacement, before removing it in a major release.
- FR-011  WHEN a deprecated name is used, THE SYSTEM SHALL print the notice once per run to the error stream and keep
  the behaviour working.
- FR-012  THE SYSTEM SHALL resume a fleet run directory written by 1.6 without repeating completed lanes.
- FR-013  THE SYSTEM SHALL keep a test for every stable promise in the contract document (Principle 5).

## Success criteria

- SC-001  Every runner marked runnable in 2.0 has a recorded live verification, and none without one is runnable by default.
- SC-002  One fleet has built two dependent features of this repository with no manual start, order or merge step.
- SC-003  A plugin written for the frozen API loads unchanged in a later 2.x release, shown by the contract kit.
- SC-004  The contract document and the code agree: a test fails when a listed flag, exit code or export disappears.
- SC-005  `npm run typecheck` and `npm test` pass, and every FR maps to at least one test (Principle 5).

## Edge cases

- A runner verified on one operating system but not another: it is runnable only where it was verified.
- An assistant updates its CLI after verification and the invocation changes: the record carries a version, and a
  version outside it is reported as unverified.
- A plugin that uses an internal name that is not in the contract.
- A deprecation announced in 2.3 for a name that a 2.0 plugin still uses.
- A fleet run directory from a 1.6 run that was interrupted mid-merge.

## Assumptions

- Specs 027, 028 and 031 are merged; spec 030's reader and writer are the only route to task state, so the run state
  contract does not include markdown layout.
- Live verification needs a real install of each assistant and a person to run it (028's T044 and T045 and 031's T094 are
  person tasks); a missing verification blocks the label change and does not delay 2.0 for the surfaces that have one.
- The set of built-in targets versus plugins is specified in spec 036, does not change this contract, and 036 depends on it.

## Clarifications

No `[NEEDS CLARIFICATION]` marker was open. Found while reading the code; each is an **assumed default, confirm with owner**.

- **C-1 Where the contract lives.** One document, `docs/stability.md`, with machine-checked lists (run flags, exit codes, state-file layout, plugin exports); a test fails when a listed item disappears (SC-004). `docs/plugin-api.md` and `docs/cli-reference.md` link to it and do not repeat the lists.
- **C-2 Which runners.** `RUNNERS` in `src/core/runners.ts` holds two entries, `claude` and `codex`, both `verified: false`. "Every runner" in US-2 and FR-004 means those two; Copilot, Cursor and OpenCode have no headless runner and stay "no runner recorded" (not a gap, and not a 2.0 blocker).
- **C-3 Per-OS verification.** A record names the operating systems it was checked on; a runner is runnable only there (edge case 1). A runner may be stable on one OS and refused on another, so `verified` alone is not enough: the record also carries the OS list and the version range.
- **C-4 Plugins written for 1.x.** API 2.0.0 is a superset of 1.0.0, so a plugin declaring `^1` is accepted with a one-line note that it targets 1.x; a range that excludes both 1.x and 2.x is refused with the version it needs (FR-009).
