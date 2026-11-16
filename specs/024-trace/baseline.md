# Trace baseline — this repo (024 T091, SC-002)

Recorded with `ambykit trace --json` on the 024 branch (020 and 021 merged in; specs 019 and 022–032
live in other worktrees, so they are not counted here).

| | count |
|---|---|
| features with a spec | 22 |
| requirements | 296 |
| covered | 39 |
| uncovered | 257 |
| deliberately uncovered | 0 |
| uncited tests (no qualified id) | 655 |
| ambiguous (bare `FR-###` in a test name) | 62 |
| orphans | 12 |
| skipped tests citing an id | 1 |

Every requirement is accounted for (covered + uncovered + deliberate = total). Fully covered so far:
**024** (21/21) and 021 (16/17). Tests written before the convention name requirements as a suffix or
bare (`FR-011: …`), so they stay uncited or ambiguous; qualifying them is a per-feature follow-up, not
1.5 work. The 12 orphans are citation examples inside fixtures of 024's own tests (for example
`019:FR-099`): a text scan reads `it("…")` inside a string too (documented limit).
