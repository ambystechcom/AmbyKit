---
feature: 038-check-reports-decisions
status: ready
created: 2026-11-25
---

# Implementation Plan — check reports decision-record problems

> The HOW. Must satisfy every `FR-###` in `@spec.md` and honor the `@../../.amby/constitution.md`. Reference spec by ID.

## Technical context

- **Stack:** TypeScript (ESM, Node 22), vitest.
- **Key libraries:** none new.
- **Constraints driving choices:** reuse the analysis instead of duplicating it (golden rule 2, FR-006); side effects stay in the CLI
  edge; every FR gets a test that cites it (Principle 5).
- **Depends on:** 037 (`analyzeDecisions(input, options)` and `danglingCitationLevel(config)` in `src/core/decisions.ts`). Declared as
  a story dependency on `037:US-1`, which `ambykit run 037 038` uses to start 038 only after 037 has merged.

## Architecture

1. **One call in `check`.** In `src/cli/check.ts`, after the existing checks and before the healthy/unhealthy verdict:
   `loadDecisions(root)`; if it found records, invalid records or citations, `analyzeDecisions(input, { danglingCitation:
   danglingCitationLevel(config) })` (FR-002, FR-006). With none of the three, nothing is printed (FR-005), exactly as `analyze` skips its
   section.
2. **Output.** One line per issue, `[kind] message`, through `this.error` for error level and `this.warn` for warning level, the same
   shape as `analyze`'s decision section (FR-001, FR-003). An error-level issue sets `ok = false`, so `check` exits 1 and does not print
   "Healthy" (FR-004).
3. **Docs.** The `ambykit check` section of `docs/cli-reference.md` gets one sentence (FR-007).

No prompt or template changes, so no golden re-record and no `ambykit sync` step.

## Phased approach

- **Phase 1 — US-1:** the call and output in `check` (T010), its tests (T011), docs and the docs test (T012, T013).
- **Phase 2 — Polish:** the full gate (T020).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | one `[kind] message` line per issue in `check` |
| FR-002 | `danglingCitationLevel(config)` from 037 passed to `analyzeDecisions` |
| FR-003 | warning-level issues through `this.warn`; `ok` unchanged |
| FR-004 | an error-level issue sets `ok = false` |
| FR-005 | the section runs only when records, invalid records or citations exist |
| FR-006 | the same `loadDecisions` + `analyzeDecisions` as `analyzeProject`; a test compares both commands on one project |
| FR-007 | `docs/cli-reference.md`, `check` section |
| US-1 | T010–T013 |

## Risks & decisions

- **`check` stays short.** It prints the issues, not the record list `analyze` prints; `analyze` remains the full report.
- **Shared file with 037.** Both edit `docs/cli-reference.md` (different sections). The fleet runs 038 after 037 merges, so there is no
  concurrent edit.
