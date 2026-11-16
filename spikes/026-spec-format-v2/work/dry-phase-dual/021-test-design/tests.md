---
feature: 021-test-design
created: 2026-11-16
---

# Tests — Test design before code

> Hand-written before any code of this feature (SC-006, dogfood). Format: `@../../src/templates/tests.md`.

## Cases

- [TC-001] [US-1#1] [FR-001, FR-004] auto — every criterion has a case → checker reports an `uncovered-criterion` finding for a criterion with no case and no flag
- [TC-002] [US-1#2] [FR-003] auto — vague criterion is flagged, not invented → a `## Flags` entry satisfies the criterion and no case is required for it
- [TC-003] [US-1#3] [FR-002] manual:human-judgment — a draft spec stops test design → the assistant stops and says the spec must be ready first; verify: run `/amby.tasks` on a feature whose spec is `draft`; record: the converge notes of the feature
- [TC-004] [US-1#4] [FR-001] auto — negative and edge criteria get cases → the tasks prompt text requires cases for them (prompt contract test)
- [TC-005] [US-1#5] [FR-004] auto — at most 15 cases per story → a story with 16 cases yields a `too-many-cases` finding
- [TC-006] [US-2#1] [FR-004, FR-006] auto — every case has a decision → a case without `auto` or `manual:<reason>` is reported as a bad line
- [TC-007] [US-2#2] [FR-005] auto — a manual case says how it is verified → a manual case without `verify:` or `record:` yields a `missing-verify` finding
- [TC-008] [US-2#3] [FR-006] auto — automate by default, fixed manual reasons only → a reason outside the list yields a `bad-decision` finding
- [TC-009] [US-2#4] [FR-009] auto — changing one decision touches one case → parsing keeps every other case and its ID unchanged
- [TC-010] [US-3#1] [FR-004] auto — a case cites story and FR ids → the parser returns criteria and FR ids for each case
- [TC-011] [US-3#2] [FR-007] auto — an FR with no case is reported unless deliberately uncovered → both uncovered forms silence the finding
- [TC-012] [US-3#3] [FR-008] auto — an unknown id is reported → a case citing `FR-099` or `US-9#1` yields an `unknown-id` finding
- [TC-013] [US-3#4] [FR-009] auto — case ids are stable → the next id is highest plus one and a duplicate id is reported
- [TC-014] [US-4#1] [FR-010, FR-012] auto — the tasks phase writes `tests.md` → the tasks command writes list contains `tests.md` and no new command exists
- [TC-015] [US-4#2] [FR-010] auto — test design writes only its own artifact → the tasks prompt tells the assistant to write `tests.md` and `tasks.md` only
- [TC-016] [US-4#3] [FR-011] auto — a missing design is noted at the checkpoint → the implement prompt asks to note a missing `tests.md`
- [TC-017] [US-5#1] [FR-012] auto — another tool reads cases without a model → parseTestDesign is pure and exported from the core index
- [TC-018] [US-5#2] [FR-014] auto — converge reads the trace matrix first, then the cases → the converge prompt orders them and spends effort only on the rest
- [TC-019] [US-5#3] [FR-012] auto — tests are matched by the qualified id in the name → the implement prompt tells to name tests `NNN:FR-###`
- [TC-020] [US-6#1] [FR-013] auto — only cases citing a changed criterion change → the tasks prompt refresh rule and a `[stale]` case yield a `stale-case` finding
- [TC-021] [US-6#2] [FR-013] auto — a removed criterion obsoletes its cases → an `[obsolete]` case is kept and not reported as unknown
- [TC-022] [US-6#3] [FR-009] auto — new criteria add cases without renumbering → the next id continues after the highest existing id
- [TC-023] [US-7#1] [FR-015] auto — a feature without `tests.md` behaves as before → analyze output is byte-identical to the previous release's
- [TC-024] [US-7#2] [FR-015] auto — analyze adds at most a non-blocking note → such features appear only under `testDesign.missing` in `--json`
- [TC-025] [US-7#3] [FR-016, FR-017] auto — skip is a one-line file and the prompt and template come from neutral source → `skipped: <reason>` is valid and the emitted tool files match the source

## Uncovered

## Flags
