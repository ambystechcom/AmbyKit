---
feature: 037-adr-citation-severity
status: ready
created: 2026-11-25
---

# Implementation Plan — Configurable severity for dangling ADR citations

> The HOW. Must satisfy every `FR-###` in `@spec.md` and honor the `@../../.amby/constitution.md`. Reference spec by ID.

## Technical context

- **Stack:** TypeScript (ESM, Node 22), zod for the config schema, vitest.
- **Key libraries:** none new.
- **Constraints driving choices:** small pure functions in `src/core`, side effects at the CLI edge; the JSON output is a stable
  surface (`docs/stability.md`), so no new keys (FR-004); every FR gets a test that cites it (Principle 5).

## Architecture

1. **Config key.** `decisions: { danglingCitation?: "error" | "warning" }` in the zod schema of `src/core/config.ts` and in
   `AmbyConfig` (`src/core/types.ts`). zod's enum gives the refusal of FR-003 with the key path and the allowed values, the same way
   other invalid settings are refused.
2. **The level is an input of the pure check.** `analyzeDecisions(input, options?)` in `src/core/decisions.ts` takes
   `{ danglingCitation?: "error" | "warning" }` and uses it only for the `dangling-citation` issue (FR-005). A small exported helper,
   `danglingCitationLevel(config)`, returns the configured level or `"error"`. 038 reuses both, which is why 038 depends on this feature.
3. **`analyzeProject` passes the level.** `src/core/analyze.ts` reads the project config where it loads the decisions and passes the
   level. `hasDecisionErrors` and the CLI's text output already follow `issue.level`, so `analyze`'s exit status and its text and JSON
   output need no other change (FR-001, FR-002, FR-004).
4. **Docs.** The `ambykit analyze` section of `docs/cli-reference.md` and `docs/artifacts/decision-record.md` name the setting; 022's
   plan marks open question 1 as resolved (FR-006).

No prompt or template changes, so no golden re-record and no `ambykit sync` step.

## Phased approach

- **Phase 1 — Foundation:** config key and the pure check's option (T001, T002).
- **Phase 2 — US-1:** wire it into `analyzeProject`, then the core and CLI tests (T010–T012).
- **Phase 3 — US-2:** the invalid-value test (T020).
- **Phase 4 — Polish:** docs, 022's open question, the docs test, the full gate (T030–T033).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `analyzeDecisions` emits `dangling-citation` at the configured level; `hasDecisionErrors` ignores warnings |
| FR-002 | absent or "error" gives `"error"` (the helper's default); existing tests unchanged |
| FR-003 | zod enum on `decisions.danglingCitation`; `loadConfig` refuses other values with the key and the allowed values |
| FR-004 | the issue's existing `level` field carries it; no new JSON keys |
| FR-005 | the option is read only in the `dangling-citation` branch |
| FR-006 | `docs/cli-reference.md`, `docs/artifacts/decision-record.md`, `specs/022-amby-decide/plan.md` |
| US-1 | T010–T012 |
| US-2 | T020 |

## Risks & decisions

- **No new JSON keys.** The configured level is not echoed in the report; a reader sees it in each issue's `level`. Echoing it would be a
  new key on a stable surface for no gain.
- **Per project, not per citation.** A per-citation waiver (for example a marker next to the citation) was considered and left out: it
  spreads policy across specs and is harder to audit.
- **Shared file with 038.** 038 also edits `docs/cli-reference.md` (the `check` section). The fleet orders 038 after this feature, so the
  two never edit it at the same time.
