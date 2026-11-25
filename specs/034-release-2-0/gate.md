---
feature: 034-release-2-0
created: 2026-11-24
---

# Release gate — 2.0.0

> The five conditions of US-2, each with a result (`met` | `not met` | `pending`), the date it was checked and the evidence (a command
> and its summarised output, a run URL or a recorded file). `npm run release:check` (`scripts/release-gate.mjs`) reads this table and
> stops a 2.0.x release at the first row that is not `met` with a date and evidence. A `pending` row names the task that fills it.
> Preconditions that are not gate conditions (D-2): the Antigravity plugin is published and install-tested (036 T034, T035, T037),
> and `rc-report.md` records a project other than this repository (FR-009). The script checks those too.

| ID | Condition | Result | Date | Evidence |
|---|---|---|---|---|
| C1 | AmbyKit's own specs are migrated to format v2 | pending | | T031, after 030 T095 |
| C2 | 1.x files are still read | pending | | T031 (`test/release/legacy-fixtures.test.ts` and the migrated tree) |
| C3 | Two dependent features were built by one fleet | pending | | T041, from 031 T094 and `specs/033-stable-run-and-plugin-api/dogfood.md` |
| C4 | The dashboard redesign was designed with the design phase and built with AmbyKit | pending | | T041, from 032 `ui.md` sign-off and 032 T113 |
| C5 | CI is green on Node 22 on Linux, macOS and Windows | pending | | T042, the release branch's CI run URL |
