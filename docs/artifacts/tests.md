# Artifact: `tests.md`

The **test design** of a feature: one case per acceptance criterion, written *before* the code. Produced by
`/amby.tasks` in the same phase as `tasks.md`; read by `/amby.implement`, `/amby.converge` and
`ambykit analyze`. It holds cases, not test code: the tests themselves are still written while implementing.

## Format

```
---
feature: 021-test-design
---
## Cases
- [TC-001] [US-1#2] [FR-003] auto — vague criterion is flagged → a ## Flags entry, no invented case
- [TC-002] [US-1#3] [FR-002] manual:human-judgment — draft spec stops → it says the spec must be ready first; verify: run /amby.tasks on a draft spec; record: the converge notes
## Uncovered
- FR-009: deliberately uncovered — documentation only
uncovered: FR-010 — covered by another feature's tests
## Flags
- US-2#3: too vague to test — no observable outcome
```

- **`TC-###`** — case id: highest existing + 1, never reused or renumbered. Obsolete cases keep their id.
- **`US-n#k`** — the criterion the case covers: the *k*-th acceptance bullet of story *n*. **`FR-###`** — the requirement(s) it covers.
- **Decision** — `auto` by default. A manual case needs a reason from a fixed list (`human-judgment`,
  `external-system`, `visual-check`, `one-off`) and says how it is verified and where the result goes
  (`verify:` and `record:`).
- **At most 15 cases per story**; a story that needs more is split.
- **Uncovered** — a requirement no case covers is listed with a reason, in either spelling above.
- **Flags** — a criterion too vague to test is flagged, and no case is invented for it.
- **Refresh** — when a criterion changes, `/amby.revise` marks the cases that cite it `[stale]`, and a cited
  criterion that was removed marks them `[obsolete]` (never deleted). Re-running `/amby.tasks` patches only those.
- **Skip** — a file whose only content line is `skipped: <reason>` records a deliberate skip.

Name the tests in code with the qualified requirement id, for example `it("021:FR-003: …")`, so a coverage
check can match them to the design. Case ids stay in `tests.md`.

## Checks

`ambykit analyze` reads each feature's `tests.md` at zero model tokens and reports, as warnings that never change
the exit status: unknown ids, requirements with no case and no reason, criteria with neither case nor flag,
duplicate case ids, bad or missing manual reasons, more than 15 cases for a story, and `[stale]` cases. A
project without any `tests.md` is analyzed exactly as before.
