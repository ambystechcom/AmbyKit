---
feature: 022-amby-decide
created: 2026-11-16
---

# Tasks — Decision records (amby.decide)

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Each phase ends with one `**Verify:**` line that runs before its checkpoint (spec 020 convention).
> Build order: 022 builds in ONE lane AFTER 021 (shared: scaffold.ts, ARTIFACT_TEMPLATES, src/core/rules.ts, test/scaffold.test.ts counts, test/roles-emit.test.ts); rebase the counts on 021's.
> T080 (golden re-record) and T096 (`ambykit sync`) are INTEGRATION steps: run once per batch after merging, never inside a lane branch.
> Shared hotspot files: rebase and merge by hand, different lines only (src/cli/index.ts, src/core/config.ts, src/core/types.ts, docs/cli-reference.md, CHANGELOG, docs/workflow.md, docs/tool-compatibility.md, README.md).

## Phase 1 — Setup

- [x] [T001] Write the decision record template (frontmatter: id, title, status, date, feature, principle, conflicts, supersedes, superseded-by; sections Context, Decision, Alternatives, Consequences)
  ```yaml
  files: ["src/templates/adr.md"]
  ```
- [x] [T002] Register `adr.md` in `ARTIFACT_TEMPLATES` so scaffold installs it write-if-absent
  ```yaml
  files: ["src/core/scaffold.ts"]
  ```

```yaml
verify:
  check: "`npm run typecheck` passes and `installArtifactTemplates` creates `.amby/templates/adr.md` in a temp project."
  result: passed
```

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Pure functions: `parseDecision` (gray-matter + zod), `findCitations` (`ADR-###`), `nextAdrNumber` (max of files and index rows, plus 1), and the `DecisionRecord` and `DecisionIssue` types
  ```yaml
  files: ["src/core/decisions.ts"]
  ```
- [x] [T011] Unit tests for parsing, citation matching and next-number including tombstones
  ```yaml
  files: ["test/core/decisions.test.ts"]
  ```

```yaml
verify:
  check: "`npx vitest run test/core/decisions.test.ts` passes."
  result: passed
```

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [US1] Write the neutral `/amby.decide` prompt: ask when no decision text, check the index for a duplicate, next number, fill the template, patch the index, run `ambykit activity`
  ```yaml
  files: ["src/prompts/decide.md"]
  ```
- [x] [T021] [P] [US1] Add `decide` to the phase order used for the agent-rules table
  ```yaml
  files: ["src/core/rules.ts"]
  ```
- [x] [T022] [P] [US1] Prompt tests: loads as `amby.decide`, no bound role, writes under `.amby/decisions/`, body within the word budget
  ```yaml
  files: ["test/decide-emit.test.ts"]
  ```
- [x] [T023] [P] [US1] Add `decide: undefined` to the role-per-phase expectation
  ```yaml
  files: ["test/roles-emit.test.ts"]
  ```
- [x] [T024] [P] [US1] `analyzeDecisions` with the `duplicate-id` check (two records sharing an id, or id differing from the filename) and its tests
  ```yaml
  files: ["src/core/decisions.ts", "test/core/decisions-analyze.test.ts"]
  ```

```yaml
verify:
  check: "`npx vitest run test/decide-emit.test.ts test/core/decisions-analyze.test.ts test/roles-emit.test.ts` passes."
  result: passed
```

- **Checkpoint:** US-1 is demoable: `/amby.decide` creates a numbered record and the index row.

## Phase 4 — User story US-2  (priority: P1)

- [x] [T030] [US2] Add `dangling-citation` and `index-drift` checks and the `loadDecisions(root)` fs edge
  ```yaml
  files: ["src/core/decisions.ts"]
  ```
- [x] [T031] [US2] Wire into `analyzeProject`: scan `specs/**/*.md`, the constitution and the records for citations, and attach an optional `decisions` section only when records or citations exist
  ```yaml
  files: ["src/core/analyze.ts"]
  ```
- [x] [T032] [US2] Print decision issues and exit non-zero on errors, leaving output unchanged without them
  ```yaml
  files: ["src/cli/analyze.ts"]
  ```
- [x] [T033] [US2] Tests: dangling citation reported, index drift warned, JSON key and text output unchanged with no decisions ↪ DEVIATION: the analyze tests live in test/cli/analyze-decisions.test.ts because test/analyze.test.ts only covers the pure graph
  ```yaml
  files: ["test/cli/analyze-decisions.test.ts", "test/core/decisions-analyze.test.ts"]
  ```

```yaml
verify:
  check: "`npx vitest run test/cli/analyze-decisions.test.ts test/core/decisions-analyze.test.ts` passes."
  result: passed
```

- **Checkpoint:** US-2 is demoable: a bad `ADR-###` citation is reported by `ambykit analyze`.

## Phase 5 — User story US-3  (priority: P1)

- [x] [T040] [US3] Add one agent-rules bullet: decisions live in `.amby/decisions/`, cite as `ADR-###`, load only cited records plus the index
  ```yaml
  files: ["src/core/rules.ts"]
  ```
- [x] [T041] [US3] Test that the generated rules region carries the bullet and that `decide` has no bound role
  ```yaml
  files: ["test/decide-emit.test.ts"]
  ```

```yaml
verify:
  check: "`npx vitest run test/decide-emit.test.ts` passes."
  result: passed
```

- **Checkpoint:** US-3 is demoable: any phase can cite and call decisions.

## Phase 6 — User story US-4  (priority: P2)

- [x] [T050] [P] [US4] `supersede-mismatch` and `supersede-cycle` checks and `currentOf`
  ```yaml
  files: ["src/core/decisions.ts"]
  ```
- [x] [T051] [P] [US4] Prompt: `--supersede ADR-###` marks the old record superseded both ways; a wording-only edit keeps id and status
  ```yaml
  files: ["src/prompts/decide.md"]
  ```
- [x] [T052] [US4] Tests: chain resolves to the current record, mismatches and cycles reported, prompt mentions both rules
  ```yaml
  files: ["test/core/decisions-supersede.test.ts", "test/decide-emit.test.ts"]
  ```

```yaml
verify:
  check: "`npx vitest run test/core/decisions-supersede.test.ts test/decide-emit.test.ts` passes."
  result: passed
```

- **Checkpoint:** US-4 is demoable: supersede ADR-001 and follow the chain to the current record.

## Phase 7 — User story US-5  (priority: P2)

- [x] [T060] [P] [US5] `accepted-with-conflict` check
  ```yaml
  files: ["src/core/decisions.ts"]
  ```
- [x] [T061] [P] [US5] Prompt: record the feature and principle, and keep a conflicting decision `proposed` with `conflicts` filled and a flag for a person
  ```yaml
  files: ["src/prompts/decide.md"]
  ```
- [x] [T062] [US5] Tests: accepted-with-conflict is an error, prompt carries the conflict rule
  ```yaml
  files: ["test/core/decisions-conflict.test.ts", "test/decide-emit.test.ts"]
  ```

```yaml
verify:
  check: "`npx vitest run test/core/decisions-conflict.test.ts test/decide-emit.test.ts` passes."
  result: passed
```

- **Checkpoint:** US-5 is demoable: a principle conflict cannot be accepted.

## Phase 8 — User story US-6  (priority: P3)

- [x] [T070] [US6] Write the security reviewer role: read-only, advisory, findings by stable ID, may point to recording an ADR but never creates one
  ```yaml
  files: ["src/roles/security.md"]
  ```
- [x] [T071] [US6] Register `security.md` in `SHIPPED_ROLES`
  ```yaml
  files: ["src/core/scaffold.ts"]
  ```
- [x] [T072] [US6] Tests: role parses, stays within the 150-word limit, is installed by scaffold, scaffold counts updated on top of 021's (rebase)
  ```yaml
  files: ["test/security-role.test.ts", "test/scaffold.test.ts"]
  ```

```yaml
verify:
  check: "`npx vitest run test/security-role.test.ts test/scaffold.test.ts test/roles-emit.test.ts` passes."
  result: passed
```

- **Checkpoint:** US-6 is demoable: `/amby.review --as security` finds the role.

## Phase 9 — User story US-7  (priority: P1)

- [x] [T080] [US7] INTEGRATION STEP (once per batch, after merging, not in a lane branch): re-record the golden fixtures with `UPDATE_GOLDEN=1` and review the diff: only the new command and the rules bullet change
  ```yaml
  files: ["test/fixtures/emitters-golden/"]
  ```
- [x] [T081] [P] [US7] Test that every target with a command surface emits `decide`
  ```yaml
  files: ["test/decide-emit.test.ts"]
  ```
- [x] [T082] [P] [US7] Adoption tests: with no decisions, analyze text and JSON are identical to before, and init creates no `.amby/decisions/`
  ```yaml
  files: ["test/core/decisions-adoption.test.ts"]
  ```

```yaml
verify:
  check: "`npx vitest run test/emitters-golden.test.ts test/decide-emit.test.ts test/core/decisions-adoption.test.ts` passes."
  result: passed
```

- **Checkpoint:** US-7 is demoable: an existing project is unchanged until its first decision.

## Phase 10 — Polish

- [x] [T090] [P] Docs site page for the `decide` phase with matching command, reads and writes, order 12
  ```yaml
  files: ["site/src/content/docs/workflow/decide.mdx"]
  ```
- [x] [T091] [P] Add the `decide` card, diagram node and summary text to the workflow overview
  ```yaml
  files: ["site/src/content/docs/workflow/index.mdx"]
  ```
- [x] [T092] [P] Add the `/amby.decide` row to the workflow table
  ```yaml
  files: ["docs/workflow.md"]
  ```
- [x] [T093] [P] Add `/amby.decide` to the README command list
  ```yaml
  files: ["README.md"]
  ```
- [x] [T094] [P] Document the decision record format and the security role
  ```yaml
  files: ["docs/artifacts/decision-record.md"]
  ```
- [x] [T095] [P] Add the Unreleased changelog entry
  ```yaml
  files: ["CHANGELOG.md"]
  ```
- [x] [T096] INTEGRATION STEP (once per batch, after merging, not in a lane branch): regenerate this repo's own tool files with `ambykit sync` and confirm a second run is a no-op
  ```yaml
  files: [".claude/", ".agents/", "AGENTS.md", "CLAUDE.md"]
  ```
- [x] [T097] Record this feature's own design choices as ADRs (SC-006): files not a database, prompt-maintained index, no slug in the filename
  ```yaml
  files: [".amby/decisions/"]
  ```

```yaml
verify:
  check: "`npm run typecheck`, `npm test` and `node scripts/check-docs-sync.mjs` pass, and `ambykit sync` followed by `git status` shows no further diff."
  result: passed
```
