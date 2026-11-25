---
feature: 037-adr-citation-severity
created: 2026-11-25
---

# Tasks — Configurable severity for dangling ADR citations

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Tests name what they cover as `037:FR-###`. Built together with 038 by one `ambykit run 037 038` fleet (the 2.0 dogfood).
> Written in the 1.x task format on purpose: the repo's own specs migrate last (030 T095).

## Phase 1 — Foundational  (blocks all feature work)

- [ ] [T001] Config key `decisions.danglingCitation`: zod `z.enum(["error", "warning"]).optional()` inside an optional `decisions` object, and the matching field on `AmbyConfig` — 037:FR-003 (src/core/config.ts, src/core/types.ts)
- [ ] [T002] `analyzeDecisions(input, options?)` takes `{ danglingCitation?: "error" | "warning" }` and uses it only for the `dangling-citation` issue; export `danglingCitationLevel(config)` returning the configured level or `"error"` — 037:FR-001, FR-002, FR-005 (src/core/decisions.ts)
- **Verify:** `npm run typecheck` passes and `npx vitest run test/core/decisions-analyze.test.ts test/cli/analyze-decisions.test.ts` passes unchanged.

## Phase 2 — User story US-1  (priority: P1)

- [ ] [T010] [US1] `analyzeProject` reads the project config and passes `danglingCitationLevel(config)` to `analyzeDecisions` — 037:FR-001, FR-002, FR-004 (src/core/analyze.ts)
- [ ] [T011] [P] [US1] Unit tests: "warning" gives a warning-level `dangling-citation`; absent and "error" give error level; a duplicate id and a supersede mismatch keep error level under "warning" — 037:FR-001, FR-002, FR-005 (test/core/decisions-severity.test.ts)
- [ ] [T012] [P] [US1] CLI tests on a temp project with one dangling citation: with "warning" `analyze` prints it as a warning and exits 0; without the key it is an error and exits 1; `--json` carries `"level": "warning"` and the report has the same keys as without the setting — 037:FR-001, FR-002, FR-004 (test/cli/analyze-decisions-severity.test.ts)
- **Checkpoint:** US-1 is demoable: one setting turns the dangling citation from a failing error into a warning.
- **Verify:** `npx vitest run test/core/decisions-severity.test.ts test/cli/analyze-decisions-severity.test.ts` passes.

## Phase 3 — User story US-2  (priority: P2)

- [ ] [T020] [US2] Config test: `"decisions": { "danglingCitation": "warn" }` is refused with a message naming `decisions.danglingCitation` and both allowed values; "error" and "warning" load — 037:FR-003 (test/core/config-schema.test.ts)
- **Verify:** `npx vitest run test/core/config-schema.test.ts` passes.

## Phase 4 — Polish

- [ ] [T030] [P] Docs: the `ambykit analyze` section of the CLI reference and the decision-record page name `decisions.danglingCitation`, its two values and the default — 037:FR-006 (docs/cli-reference.md, docs/artifacts/decision-record.md)
- [ ] [T031] [P] Mark 022's open decision 1 resolved: default error, a project may lower it to a warning with `decisions.danglingCitation` (037) — 037:FR-006 (specs/022-amby-decide/plan.md)
- [ ] [T032] Docs test: the CLI reference and the decision-record page mention `decisions.danglingCitation` with both values; 022's plan marks question 1 resolved — 037:FR-006 (test/docs-decision-severity.test.ts)
- [ ] [T033] Full gate: `npm run typecheck`, `npm test`, `node scripts/check-docs-sync.mjs`, `ambykit analyze`, `ambykit trace 037` covers FR-001 to FR-006 (specs/037-adr-citation-severity/tasks.md)
- **Verify:** every command in T033 passes; `trace 037` reports full coverage.
