---
feature: 038-check-reports-decisions
created: 2026-11-25
---

# Tasks — check reports decision-record problems

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: starts only after 037 has merged (US-1 depends on 037:US-1); `ambykit run 037 038` enforces the order.
> Tests name what they cover as `038:FR-###`. Built together with 037 by one fleet (the 2.0 dogfood).
> Written in the 1.x task format on purpose: the repo's own specs migrate last (030 T095).

## Phase 1 — User story US-1  (priority: P1)

- [ ] [T010] [US1] `check` loads the decision records and, when there are records, invalid records or citations, runs `analyzeDecisions` with `danglingCitationLevel(config)` (037); prints one `[kind] message` line per issue (error or warning); an error-level issue makes `check` exit 1 without "Healthy" — 038:FR-001, FR-002, FR-003, FR-004, FR-005, FR-006 (src/cli/check.ts)
- [ ] [T011] [US1] CLI tests on temp projects: a dangling citation prints one line and exits 1; with `decisions.danglingCitation: "warning"` the line is a warning and `check` exits 0; a record missing from the index is a warning only; no records and no citations leave the output unchanged; `analyze` and `check` list the same decision issues at the same levels — 038:FR-001, FR-002, FR-003, FR-004, FR-005, FR-006 (test/cli/check-decisions.test.ts)
- [ ] [T012] [P] [US1] Docs: the `ambykit check` section says it reports decision-record problems, at the severity set by `decisions.danglingCitation` — 038:FR-007 (docs/cli-reference.md)
- [ ] [T013] [P] [US1] Docs test: the `check` section of the CLI reference mentions decision records — 038:FR-007 (test/docs-check-decisions.test.ts)
- **Checkpoint:** US-1 is demoable: `ambykit check` lists decision problems and fails only on error-level ones.
- **Verify:** `npx vitest run test/cli/check-decisions.test.ts test/docs-check-decisions.test.ts` passes and the existing `check` tests pass unchanged.

## Phase 2 — Polish

- [ ] [T020] Full gate: `npm run typecheck`, `npm test`, `node scripts/check-docs-sync.mjs`, `ambykit analyze`, `ambykit trace 038` covers FR-001 to FR-007 (specs/038-check-reports-decisions/tasks.md)
- **Verify:** every command in T020 passes; `trace 038` reports full coverage.
