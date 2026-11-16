---
feature: 022-amby-decide
status: draft
created: 2026-11-16
---

# Implementation Plan — Decision records (amby.decide)

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`.
> Reference spec by ID; do not restate it. No UI, so there is no `ui.md`.

## Technical context

- **Stack:** TypeScript, ESM, Node ≥ 20 (existing). No new dependencies: `gray-matter` and `zod`
  already parse role and prompt frontmatter, and decision records use the same pattern (Principle 2).
- **Pattern followed:** feature 013 roles. A neutral prompt in `src/prompts/`, a neutral template in
  `src/templates/`, a shipped role in `src/roles/`, installed write-if-absent by `scaffold.ts`, and
  emitted by the existing emitters with no emitter code (Principles 1 and 2).
- **Constraints driving choices:**
  - Machine reads stay local and cost zero model tokens (Principle 3): the checks below are pure
    functions in `src/core`, side effects only at the edge.
  - Additive in 1.x: a project with no `.amby/decisions/` and no `ADR-###` citation sees byte-identical
    `analyze` text and JSON (FR-015, US-7).
  - Prompts stay small: the `/amby.decide` body gets a word budget test (FR-017, Principle 3).
  - Every FR maps to a test; emitters keep their snapshot tests (Principle 5).
  - `ambykit sync` stays idempotent and the repo's own files are regenerated (Principles 1 and 6).

## Architecture

```
src/prompts/decide.md      neutral phase /amby.decide (record, duplicate check, supersede, index)
src/templates/adr.md       record template, installed to .amby/templates/adr.md
src/roles/security.md      shipped read-only security reviewer, used as /amby.review --as security
src/core/decisions.ts      PURE: parse record, find citations, next number, analyze, current-of chain
                           + one fs edge: loadDecisions(root)
src/core/analyze.ts        analyzeProject() adds an optional `decisions` section
src/cli/analyze.ts         prints decision issues, exits non-zero on errors
src/core/rules.ts          one bullet in the agent-rules region (any phase can cite and consult)
```

**Storage (in the consumer project, created on first use, never at init):**

- `.amby/decisions/ADR-###.md`, one record per file. The filename carries no slug, so two branches that
  create the same number produce an add/add conflict in git (FR-005); the title lives in frontmatter.
- `.amby/decisions/README.md`, the index: one row per record, `| ADR-### | title | status |`. The prompt
  patches it in place. A row whose file was deleted by hand stays as a tombstone, so a number is never
  reused (FR-005).
- **Record frontmatter:** `id`, `title`, `status` (proposed | accepted | superseded | deprecated),
  `date`, optional `feature`, `principle`, `conflicts` (principle numbers), `supersedes`,
  `superseded-by`. Body sections: Context, Decision, Alternatives, Consequences (FR-002, FR-012).
- **Next number** = highest of the record filenames and index rows, plus 1, zero-padded to three digits.

**Checks (all in `analyzeDecisions`, pure):**

| Issue kind | Level | Trigger |
|---|---|---|
| `duplicate-id` | error | two records share an `id`, or `id` differs from the filename |
| `dangling-citation` | error | an `ADR-###` cited in `specs/**/*.md`, the constitution or a record has no record |
| `supersede-mismatch` | error | A `supersedes` B but B is not `superseded` with `superseded-by: A` (or the reverse) |
| `supersede-cycle` | error | the supersede chain loops |
| `accepted-with-conflict` | error | `status: accepted` with a non-empty `conflicts` |
| `index-drift` | warning | a record has no row in the index |

`currentOf(records, id)` follows `superseded-by` to the live record (SC-003). Citations are matched with
`/\bADR-\d{3,}\b/`, in markdown files only, never in code.

**Additive rule.** `analyzeProject` attaches `report.decisions` only when records or citations exist, so
the JSON and the text output are unchanged otherwise (FR-015). Error-level issues join the exit code the
same way structural graph issues do today.

## Phased approach

- **Phase 0 — Research:** none needed. Formats are internal. The one verified external fact, that every
  emitter takes its commands from `loadCommandSpecs()`, was confirmed in `src/core/emit.ts`.
- **Phase 1 — Foundation:** the template, its install registration, and the pure parse, citation and
  numbering functions in `decisions.ts`.
- **Phase 2 — US-1, US-2, US-3 (P1):** the `/amby.decide` prompt, the dangling-citation and index checks,
  the analyze wiring, and the agent-rules bullet.
- **Phase 3 — US-4, US-5 (P2):** supersede and conflict handling in the prompt and the checks.
- **Phase 4 — US-6 (P3):** the security role.
- **Phase 5 — US-7 and polish:** re-record golden fixtures, emission and scaffold tests, docs site and
  README, changelog, and `ambykit sync` on this repo.
- **Build order and integration:** 022 builds in ONE lane after 021: both edit scaffold.ts (`ARTIFACT_TEMPLATES`,
  `SHIPPED_ROLES`), src/core/rules.ts, the count assertions in test/scaffold.test.ts and test/roles-emit.test.ts, so
  022 rebases its counts on 021's. The security role is the seventh read-only role (019 T038 will say seven). The golden
  re-record (T080) and `ambykit sync` (T096) are integration steps run once per batch after merging, never in a lane.
- **Shared hotspot files:** rebase and merge by hand, different lines only (src/cli/index.ts, src/core/config.ts,
  src/core/types.ts, docs/cli-reference.md, CHANGELOG, docs/workflow.md, docs/tool-compatibility.md, README.md).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| US-1, FR-001, FR-003 | `decide.md` step 1 asks when no decision text is given; step 3 writes `ADR-<next>.md` from `adr.md` |
| FR-002, FR-012 | `adr.md` frontmatter and sections; prompt fills `feature` from the current feature and `principle` when relevant |
| FR-004 | prompt reads the index titles first and points to an existing ID instead of creating a record |
| FR-005 | next number from files and index (tombstones), add/add git conflict on the same filename, `duplicate-id` check |
| US-2, FR-006 | index `README.md` patched by the prompt; `index-drift` warns when a record is missing from it |
| FR-007 | `dangling-citation` over `specs/**/*.md`, constitution and records, reported by `ambykit analyze` |
| US-3, FR-008 | prompt has no bound role and no phase assumption; the agent-rules bullet tells every phase it may cite and call it |
| FR-009 | agent-rules bullet: load only the records cited by ID plus the index, never all records |
| US-4, FR-010 | prompt `--supersede ADR-###` marks the old record `superseded` both ways; `supersede-mismatch` and `supersede-cycle` verify; `currentOf` resolves the chain |
| FR-011 | prompt rule: a wording-only edit keeps `id` and `status` |
| US-5, FR-013 | prompt sets `proposed` and fills `conflicts` when a principle conflicts; `accepted-with-conflict` blocks `accepted` |
| US-6, FR-014 | `src/roles/security.md`, read-only and advisory, registered in `SHIPPED_ROLES`; `review.md` already takes `--as <id>` |
| US-7, FR-015 | optional `decisions` section in analyze; nothing created at init; golden fixtures re-recorded for the one new command and bullet |
| FR-016 | the prompt is emitted by every emitter through `loadCommandSpecs()`; `sync` idempotence is covered by the existing tests |
| FR-017 | a word-budget test on the `decide` body and a line cap on the template |
| SC-001..SC-006 | SC-001 prompt and template size tests; SC-002 `dangling-citation`; SC-003 `currentOf` test; SC-004 additive test; SC-005 the test suite; SC-006 record this feature's own design choices as ADRs during implementation |

## Risks & decisions

- **Golden fixtures change.** Adding a command and an agent-rules bullet changes the output of all ten
  recorded targets. This is intended and is re-recorded once, with the diff reviewed to show only those
  two additions (the same approach feature 015 used for its lane prompts).
- **Review prompt unchanged.** `/amby.review --as security` already resolves `.amby/roles/<id>.md`, so
  no change to `review.md` is needed; the missing-role behavior is the existing one (US-6).
- **Read-only security role.** The role says no edits, but review is advisory by design and only the
  prompt enforces it. It reuses the existing `amby-*` role emission, so no new surface.
- **Index maintained by the prompt, not a CLI verb.** Cheapest and needs no new command (and so no
  docs-sync verb entries). The cost is that a model can forget to patch it; `index-drift` catches that.
- **Spec 019 interplay.** The read-only claim in 019 (FR-006) covers all review roles, including this
  one; nothing to change here.

## Open decisions

1. **Dangling `ADR-###` citation severity.** Default: error (exit 1), like a dangling story reference.
   Alternative: warning only.
2. **Index file name.** Default: `.amby/decisions/README.md`. Alternative: `INDEX.md`.
3. **Default role for `/amby.decide`.** Default: none, so it is callable from any phase (FR-008).
   Alternative: bind to `architect`.
4. **Where citations are scanned.** Default: `specs/**/*.md`, `.amby/constitution.md` and the records.
   Alternative: also `docs/` and the README.
5. **Where the `decisions` section appears in `--json`.** Default: top-level `decisions`, present only when
   records or citations exist.
