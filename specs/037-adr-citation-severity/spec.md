---
feature: 037-adr-citation-severity          # NNN-slug
title: Configurable severity for dangling ADR citations
branch: 037-adr-citation-severity
status: ready                     # draft | ready | in-progress | blocked | done
created: 2026-11-25
---

# Spec — Configurable severity for dangling ADR citations

> WHAT and WHY only. No technology decisions (those belong in `plan.md`).
> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.

Today a spec that cites an `ADR-###` with no record is always an error, so `ambykit analyze` exits 1 (022:FR-007). That is right for
most projects, but a team that cites a decision before writing it down (a record planned for the same pull request, or one kept
elsewhere for a while) has no way to keep `analyze` green in CI without removing the citation. This feature lets a project choose the
severity of that one check, and settles the open question 1 of 022's plan ("Dangling `ADR-###` citation severity").

This feature and 038 are the 2.0 fleet dogfood (031 T094, 033 T071): one `ambykit run 037 038` fleet builds both.

## User scenarios & testing

### US-1 — Report dangling citations as warnings  (priority: P1)

As a maintainer, I want to set dangling `ADR-###` citations to warning level in my project's config, so that `analyze` still lists
them but does not fail CI while the record is on its way.

- **Why this priority:** it is the whole feature; without it the setting has no effect.
- **Independent test:** in a project with one dangling citation, set the severity to warning; `analyze` lists the citation as a
  warning and exits 0; remove the setting and it is an error with exit 1 again.
- **depends-on:** []
- **blocked-by:** []
- **status:** ready

**Acceptance criteria**
- Given the setting is "warning" and a spec cites an `ADR-###` with no record, When `ambykit analyze` runs, Then the citation is
  listed as a warning and the exit status is 0 (if nothing else fails).
- Given the setting is absent or "error", When `ambykit analyze` runs, Then the output and the exit status are what they are today.
- Given the setting is "warning", When `ambykit analyze --json` runs, Then the issue appears with `"level": "warning"` and the JSON has
  no new keys.
- Given the setting is "warning", When other decision problems exist (a duplicate id, a supersede mismatch), Then they keep their own
  level.

### US-2 — A wrong value is refused  (priority: P2)

As a maintainer, I want a mistyped severity to be refused with a clear message, so that a typo cannot silently change what fails CI.

- **Why this priority:** protects US-1 from a silent misconfiguration; small.
- **Independent test:** set the severity to `"warn"`; any command that reads the config stops with a message naming the key and the
  allowed values.
- **depends-on:** [US-1]
- **blocked-by:** []
- **status:** ready

**Acceptance criteria**
- Given the setting has a value other than "error" or "warning", When a command reads the config, Then it stops with a message that
  names the key and the two allowed values, as it does for other invalid settings.

## Requirements (EARS)

- FR-001  WHERE the project config sets the dangling-citation severity to "warning", THE SYSTEM SHALL report each dangling `ADR-###`
  citation at warning level and SHALL NOT fail the exit status of `analyze` because of it.
- FR-002  WHILE the setting is absent or "error", THE SYSTEM SHALL report dangling citations at error level with exit status 1, as before.
- FR-003  IF the setting has any other value, THEN THE SYSTEM SHALL refuse the config with a message naming the key and the allowed values.
- FR-004  THE SYSTEM SHALL carry the configured level in the `level` field of the issue in `analyze --json`, adding no new keys.
- FR-005  THE SYSTEM SHALL apply the setting to dangling citations only; every other decision check keeps its level.
- FR-006  THE SYSTEM SHALL document the setting where `analyze` and the decision records are documented, and record 022's open
  question 1 as resolved.

## Success criteria

- SC-001  A project with one dangling citation and the setting "warning" gets exit 0 from `analyze` and sees the citation as a warning.
- SC-002  Without the setting, the existing `analyze` decision tests pass unchanged.
- SC-003  `npm run typecheck` and `npm test` pass, and every FR maps to at least one test (Principle 5).

## Edge cases

- The setting is "warning" and there are no decision records at all, only citations: the citations are still listed, as warnings.
- The same ADR is cited from two files: one line per file, as today, each at the configured level.
- The setting is present but the project has no `decisions` problems: output unchanged.

## Assumptions

- The setting lives in `.amby/config.json` next to the other project settings; it is per project, not per spec.
- Only two levels are needed ("error", "warning"); turning the check off entirely is out of scope.
- 022's open question 1 is answered by the owner (2026-11-25): the default stays error, and a project may lower it to a warning.
