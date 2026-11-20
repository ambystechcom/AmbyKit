---
feature: 033-stable-run-and-plugin-api
status: draft
created: 2026-11-20
---

# Implementation Plan — Stable run and plugin API

> The HOW. Satisfies every `FR-###` in `@spec.md` (clarifications C-1..C-4 are assumed defaults, confirm with owner) and honors
> `@../../.amby/constitution.md`. Reference by ID; nothing here restates the spec.

## Technical context

- **Stack:** TypeScript, ESM, Node ≥ 22, Vitest. No new dependency (Principle 2: reuse, do not duplicate).
- **Reused, verified by reading the code:** `PLUGIN_API_VERSION` / `PLUGIN_API_EXPERIMENTAL` and `createPluginApi()` (`src/plugins/api.ts`),
  the range check `satisfies(PLUGIN_API_VERSION, manifest.pluginApi)` (`src/plugins/loader.ts:102`), the experimental note
  (`src/plugins/report.ts`), the contract kit (`src/testkit/contract.ts`), the runner table with `verified` / `verifiedVersion` and the single
  chokepoint `runnable()` (`src/core/runners.ts`), the doc-sync check (`scripts/check-docs-sync.mjs`, `test/check-docs-sync.test.ts`), and
  fleet state under `.amby/fleet/<run>/` (`src/core/fleet/runs.ts`, `FLEET_DIR`). `run` exits only with 0 or 1 today (`src/cli/run.ts`).
- **Constraints driving choices:** Principle 4 (never mark a runner verified without a live record), Principle 5 (every FR has a test;
  a promise with no test is not a promise), Principle 6 (the label changes only after the dogfood run), Principle 7 (no network, no
  telemetry; deprecation notices go to stderr only), Principle 3 (the contract is data a test reads, not prose to re-read).

## Architecture

Four small pieces, each pure where possible, side effects at the edges.

1. **Contract document, machine-checked (C-1).** `docs/stability.md` holds prose plus fenced `contract` blocks (`json`: run flags, exit
   codes, state-file layout, directive protocol, plugin exports, descriptor shape, kit exports). `test/stability-contract.test.ts` reads the
   blocks and checks each against the code: flags against the run command's usage and parser, exit codes against constants, exports against
   `src/index.ts` and `src/plugins/index.ts`, state layout against `src/core/fleet/runs.ts`. A listed item that disappears fails the test (SC-004).
2. **Runner verification record (C-2, C-3).** `RunnerSpec` gains `verifiedOn: NodeJS.Platform[]` and `verifiedRange: string` (a semver range);
   `verified`, `verifiedVersion` stay. `runnable(id, { platform, version? })` refuses a platform not in `verifiedOn` and a detected version
   outside the range, with a reason naming which. The flag is set **only** together with a record file under
   `specs/033-stable-run-and-plugin-api/verification/<runner>-<os>.md`; a test fails if `verified: true` has no record for each listed OS.
3. **Stability labels from one place.** A single `RUN_STABILITY` constant (`"experimental" | "stable"`) replaces the scattered
   "(experimental)" strings in `src/cli/run.ts`, `run-fleet.ts`, `run-script.ts` and `src/core/fleet-plan/format.ts`. It may be `"stable"`
   only if the dogfood record exists (`specs/033-stable-run-and-plugin-api/dogfood.md` with a fleet run id); a test enforces that (FR-006).
   The plugin API goes to `PLUGIN_API_VERSION = "2.0.0"`, `PLUGIN_API_EXPERIMENTAL` is removed from the exports, and the loader accepts a
   `^1` range as a 1.x plugin with a one-line note (C-4); a range excluding 1.x and 2.x is refused naming the version it needs (FR-009).
4. **Deprecation notice.** `src/core/deprecation.ts`: `deprecated(name, replacement)` prints one stderr line once per process (FR-010, FR-011).
   Nothing is deprecated at 2.0; tests use a fake name. The policy text lives in `docs/stability.md`.

## Phased approach

- **Phase 0 — Research:** confirm the exact current surface (flags, exit codes, exports, state files) and list what stays out of the
  contract (internal names); decide the `^1` compatibility rule against the loader tests → `research.md`.
- **Phase 1 — Foundation:** contract blocks format and the parser used by the test; the verification-record shape → `data-model.md`.
- **Phase 2 — US-1, US-5 (contract and policy):** `docs/stability.md`, the contract test, `src/core/deprecation.ts`.
- **Phase 3 — US-4, US-6 (plugin API freeze and compat):** version 2.0.0, remove the experimental flag and note, `^1` handling, hint when a
  1.x plugin imported an internal name, kit lists only the frozen surface, 1.6 run-directory resume fixture.
- **Phase 4 — US-2 (runner verification model):** `verifiedOn` / `verifiedRange`, `runnable()` platform and version rules, record-file test.
- **Phase 5 — Person gates (US-2, US-3):** live verification of each runner per OS (the 028 T044/T045 equivalent), the 031 T094 fleet dogfood,
  then flip `verified` and `RUN_STABILITY` from the records. Nothing in Phases 2-4 needs these.
- **Phase 6 — Integration:** goldens once (prompts or help text changed), `ambykit sync` twice, docs, changelog `[plugin-api]` line, full checks.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001, FR-002, FR-003, US-1 | `docs/stability.md` with a statement that unlisted things are not covered and additions are allowed in minor releases (Phase 2) |
| FR-004, FR-005, US-2 | `verifiedOn` / `verifiedRange` + `runnable()` + record-file test (Phase 4) |
| FR-006, US-3 | `RUN_STABILITY` guarded by the dogfood record test (Phases 2 and 5) |
| FR-007, US-4 | version 2.0.0, flag and note removed, exports and docs and changelog convention updated (Phase 3) |
| FR-008 | the kit's own exports and checks listed in the contract block; test compares (Phase 3) |
| FR-009 | loader `^1` rule and internal-name hint (Phase 3) |
| FR-010, FR-011, US-5 | `src/core/deprecation.ts` (Phase 2) |
| FR-012, US-6 | resume test on a run directory written by the 1.6.0 build (Phase 3) |
| FR-013 | each contract item has a test through the contract test; the rest map one test per FR (`tests.md`) |
| SC-001..SC-005 | covered by the tests above plus `npm run typecheck` and `npm test` |

## Risks & decisions

- **D1 — Data, not prose.** The contract is read by a test, so it cannot drift (Principle 5). Trade-off: the document is a little more rigid to edit.
- **D2 — Per-OS records.** One boolean cannot say "verified on macOS only" (edge case 1). Trade-off: two fields to maintain per runner.
- **R1 — Verification is a person task.** A live install and a person are needed; until then the runners stay unverified and `run` stays
  experimental. 2.0 can still ship with the plugin API stable and `run` marked experimental (US-4 does not depend on US-2/US-3); say so in 034.
- **R2 — A stable `run` with only two runners.** Claude and Codex have runners; Copilot, Cursor and OpenCode do not. State it in the contract
  so "stable" is not read as "every assistant" (C-2).
- **R3 — `^1` plugins.** Accepting `^1` assumes 2.0.0 is a superset of 1.0.0. The loader test and the kit prove the names still exist; a plugin
  that reached into internals fails at import, hence the hint in Phase 3.
- **R4 — 036 may need API additions** (for example the MCP command constant the Antigravity CLI emitter imports from `base-emitter.js`).
  Any addition must land **before** the freeze; recorded in 036's plan. Additions after 2.0 are minor (FR-003).
- **Gap for clarify:** none beyond C-1..C-4.
