---
feature: 034-release-2-0
created: 2026-11-24
---

# Tasks — Release 2.0

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes. **Extra gates:** (1) Phases 3 and 4 evidence tasks wait for the 2.0 features: 030 T095 (own specs migrated, the
> last commit before release), 031 T094 / 033 T071 (fleet dogfood), 032 T113 (tour), 036 T034, T035, T037 (Antigravity plugin published and install-tested); (2) Phase 8 runs only on a
> `release/2.0.0` branch after every earlier phase passes, and only the owner publishes; (3) a task marked **PERSON** is not done by an assistant.
> Tests name what they cover as `034:FR-###`. Story order: US-1 → US-3 → US-4/US-2 → US-6 → US-5 → US-7.
> No version bump, tag or publish happens before Phase 8. Written in the 1.x task format on purpose: the repo's own specs migrate last (030 T095).

## Phase 1 — Setup

- [x] [T001] Research: confirm each fact in the plan against the repository (`publish.yml`, `ci.yml` Node 20 step, contributing checklist, migration guide sections, 1.x fixtures, `RUN_STABILITY`) and inventory every "experimental" label and 1.x-only statement in README, docs and site (specs/034-release-2-0/research.md)
- [x] [T002] PERSON: answer the owner decisions D-1 (Node 20 step in CI vs FR-007), D-2 (plugin as precondition, not a sixth gate condition), D-3 (candidate dist-tag name), D-4 (last 1.x version for rollback), D-5 (`RUN_STABILITY` outcome); record the answers as clarifications in `spec.md`, and amend FR-007/US-2 if D-1/D-2 change them (specs/034-release-2-0/spec.md)
- **Verify:** `research.md` lists every coupling and every label hit, and `spec.md` records D-1 to D-5. T002 answered (spec.md Clarifications).

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] Gate record: `gate.md` with exactly the five US-2 conditions (C1 to C5), each `pending` with the task that will fill it; `release-gate.mjs` parses it, exits non-zero naming the first condition that is not `met` with a date and non-empty evidence, and returns the unmet list as data; `npm run release:check` — 034:FR-003, FR-004 (specs/034-release-2-0/gate.md, scripts/release-gate.mjs, package.json, test/release/release-gate.test.ts) ↪ DEVIATION: the gate guards the final 2.0.x versions only (a candidate and a 1.x patch pass straight through), so `npm run release:check` asks for 2.0.0 explicitly (`--version 2.0.0`) while the package is still 1.6.0; `--offline` skips the npm lookup of the plugin with a warning
- [x] [T011] [P] `release-tag.mjs`: print the dist-tag for a version (`next` or the D-3 name for a prerelease suffix, `latest` for a plain version), reject a malformed version — 034:FR-009 (scripts/release-tag.mjs, test/release/release-tag.test.ts)
- [x] [T012] `publish.yml`: compute the tag with `release-tag.mjs` and pass `--tag` to `npm publish`; for a plain version run `release-gate.mjs` before publishing; keep tag-equals-version, skip-if-published, OIDC, provenance and the `plugin/*` guard unchanged — 034:FR-004, FR-008, FR-009 (.github/workflows/publish.yml) ↪ DEVIATION: the gate step runs for every publish and decides itself whether the version is gated, so the workflow has no version condition of its own
- [x] [T013] Workflow structure test: reads `ci.yml` and `publish.yml` as text and pins the matrix (three platforms, `node-version: 22`), the one allowed Node 20 negative step (per D-1), the tag check, `id-token: write`, no `NODE_AUTH_TOKEN`, the `plugin/` guard and the `--tag` step — 034:FR-007, FR-008, FR-009 (test/release/workflows.test.ts) ↪ DEVIATION: the Node 20 step is in the same job as the build, after the self-host checks, not a separate job; the test pins that nothing after Node 20 is set up builds, tests or publishes and that exactly one step follows
- **Verify:** `npx vitest run test/release` and `npm run typecheck` pass; `npm run release:check` exits non-zero and names C1.

## Phase 3 — User story US-1  (priority: P1)

- [x] [T020] [P] [US1] Changelog test: the `[Unreleased]`/`[2.0.0]` block has a Breaking changes list with the six items of US-1 (format v2 + `migrate`, config schema version, Node 22, stable `run`, stable plugin API with its deprecation policy, targets moved to plugins), each saying who is affected and what to do, and a `[plugin-api]` line that says the API is stable — 034:FR-001 (test/release/changelog-2-0.test.ts) ↪ DEVIATION: the `ambykit run` entry follows `RUN_STABILITY` (D-5): while it is `"experimental"` the entry says run is still labelled experimental, and the test flips with the constant
- [x] [T021] [P] [US1] Guide test: every `ambykit <command>` and flag in the upgrade section's code blocks is a registered command or a documented flag (checked against the CLI registry and `docs/cli-reference.md`), and the section names each skip reason of `migrate` by the table's wording — 034:FR-002 (test/release/migration-guide.test.ts) ↪ DEVIATION: the commands come from `ambykit --help` (main's registry is not exported); the upgrade section links the skip table instead of repeating it (T022's "do not repeat"), so the test checks the link and that the guide's table names all eight reasons; it also checks every in-page link resolves and the step order
- [x] [T022] [US1] "Upgrade a 1.x project to 2.0" at the top of the migration guide, in order: Node 22, upgrade every tool that reads specs, `migrate --dry-run`, `migrate`, review, Antigravity plugin, what `run` and the plugin API now promise, the pinned-1.x-CI path with `--dual-write`; link the existing sections, do not repeat them — 034:FR-002 (docs/migration.md)
- [x] [T023] [US1] Changelog: group the breaking changes into one **Breaking changes** list (who is affected, what to do) above the existing Added/Changed entries — 034:FR-001 (CHANGELOG.md)
- [ ] [T024] [US1] PERSON: follow only the guide on a copy of a real 1.x project that is not this repository; `check` and `analyze` must be clean; record project, date, steps and problems in `rc-report.md` (SC-001) (specs/034-release-2-0/rc-report.md)
- **Checkpoint:** US-1 is demoable: a reader can follow the guide end to end.
- **Verify:** `npx vitest run test/release/changelog-2-0.test.ts test/release/migration-guide.test.ts` pass. ? unverified: T024 is a person task.

## Phase 4 — User story US-3  (priority: P1)  — and FR-005, FR-006

- [x] [T030] [P] [US3] Legacy fixture test: 1.x fixtures exist under `test/fixtures/` (spec, tasks, a mixed repo) and read through the 1.x reader to the same model as their v2 twins — 034:FR-006 (test/release/legacy-fixtures.test.ts) ↪ DEVIATION: the mixed repository is built in the test from the twin pair (the v1 twin as 001, the v2 twin renamed 002) instead of a third committed fixture; analyze reports no format issue on it
- [ ] [T031] [US3] Record the C1 evidence once 030 T095 is committed and every 2.0 feature is merged: `migrate --dry-run` reports nothing to do, a second `migrate` changes nothing, `analyze`, `trace` and the full suite pass on the migrated tree with the same coverage as before; fill C1 and C2 in `gate.md` with dates and the command output — 034:FR-005, FR-006 (specs/034-release-2-0/gate.md)
- **Checkpoint:** US-3 is demoable: C1 and C2 are `met` with evidence.
- **Verify:** `node dist/cli/index.js migrate --dry-run` reports 0 to convert and `npx vitest run test/release/legacy-fixtures.test.ts` passes. ? unverified: T031 waits for 030 T095.

## Phase 5 — User stories US-4 and US-2  (priority: P1)

- [ ] [T040] [US4] Checkpoint, not new work: confirm 036 T034, T035 and T037 are ticked (Antigravity plugin published, install-tested, trusted publisher added) and that `release-gate.mjs` checks them as preconditions (per D-2); tick here only when the script says so — 034:FR-004 (scripts/release-gate.mjs, specs/036-core-and-plugin-targets/tasks.md)
- [ ] [T041] [US2] Fill C3 (fleet built two dependent features) from `specs/033-stable-run-and-plugin-api/dogfood.md` and 031 T094, and C4 (dashboard designed with the design phase, built with AmbyKit) from `specs/032-*/ui.md` sign-off and 032 T113; a row with no recorded run stays `pending` and the release waits (spec edge case) — 034:FR-003 (specs/034-release-2-0/gate.md)
- [ ] [T042] [US2] Fill C5 (CI green on Node 22 on Linux, macOS and Windows) with the run URL of the release branch, after the candidate and again before the final tag — 034:FR-003, FR-007 (specs/034-release-2-0/gate.md)
- [x] [T043] [US4] If D-1 says remove the Node 20 step: replace it with a unit test of the bin entry's required-version message and delete the step; otherwise leave it and amend FR-007's wording in `spec.md` — 034:FR-007 (.github/workflows/ci.yml, test/release/workflows.test.ts, specs/034-release-2-0/spec.md) ↪ DEVIATION: D-1 kept the Node 20 step, so `ci.yml` is unchanged; FR-007 was reworded with T002, and `test/release/workflows.test.ts` (T013) pins the step as the one Node 20 occurrence
- **Verify:** `npm run release:check` names the first unmet condition, and names none once C1 to C5 and the preconditions are met. ? unverified: depends on person tasks in 030, 031, 032, 033 and 036.

## Phase 6 — User story US-6  (priority: P2)

- [ ] [T050] [US6] Prepare the candidate branch `release/2.0.0-rc.1`: version `2.0.0-rc.1` in `package.json` and the lockfile, changelog heading, then T080 and T081 once, full tests — 034:FR-009 (package.json, package-lock.json, CHANGELOG.md)
- [ ] [T051] [US6] PERSON: publish the candidate: GitHub Release marked prerelease, tag `v2.0.0-rc.1`; confirm `npm view @ambystech/ambykit dist-tags` shows the candidate under the D-3 tag and `latest` still 1.x, and that `npm install @ambystech/ambykit` without a tag gets 1.x — 034:FR-009 (specs/034-release-2-0/rc-report.md)
- [ ] [T052] [US6] PERSON: install the candidate in at least one project other than this repository, migrate and use it for a real feature cycle; record the result (what worked, what broke) in `rc-report.md`; a data-loss bug in `migrate` means no final release until a fix and a second candidate — 034:FR-009 (specs/034-release-2-0/rc-report.md)
- [x] [T053] [US6] `release-gate.mjs` requires `rc-report.md` to name a project other than this repository and a date before a plain version passes; test with fixtures — 034:FR-009 (scripts/release-gate.mjs, test/release/release-gate.test.ts) ↪ DEVIATION: built with the gate script in Phase 2 (same file); the report needs `- **Project:**` (not this repository) and `- **Date:** YYYY-MM-DD` lines
- **Verify:** `npx vitest run test/release/release-gate.test.ts` passes. ? unverified: T051 and T052 are person tasks.

## Phase 7 — User story US-5  (priority: P2)

- [ ] [T060] [P] [US5] Rollback test: `docs/release.md` has a rollback section that names `npm dist-tag add`, `npm deprecate`, `gh release edit`, who runs each, that a published version cannot be reused so the fix is 2.0.1, what 1.x loses on a v2 file, and the two ways back (`--dual-write`, restore from version control, linking `docs/migration.md`) — 034:FR-010, FR-011 (test/release/rollback-doc.test.ts)
- [ ] [T061] [US5] Write `docs/release.md`: the release checklist in order (preconditions, candidate, gate, branch, publish, fresh-install check) and the rollback plan with the last 1.x version from D-4; link it from the contributing checklist, which keeps its per-release bullets — 034:FR-010, FR-011 (docs/release.md, docs/contributing.md)
- [ ] [T062] [US5] PERSON: read the plan as the person who would run it and confirm each step is a command they can type; rehearse only the read-only parts (`npm dist-tag ls`, `gh release view`) — 034:FR-010 (specs/034-release-2-0/notes.md)
- **Verify:** `npx vitest run test/release/rollback-doc.test.ts` passes. ? unverified: T062 is a person task.

## Phase 8 — User story US-7  (priority: P2)

- [ ] [T070] [P] [US7] Label test: no unqualified "experimental" on `ambykit run` or the plugin API when `RUN_STABILITY` is `"stable"`; when it is `"experimental"` the only label left is the one 033 emits, and the changelog says so (per D-5); README, `docs/` and `site/src/content/docs` say 1.x is supported until 2.1 — 034:FR-012 (test/release/stable-labels.test.ts)
- [ ] [T071] [US7] Sweep README, docs and site per the T001 inventory: describe format v2 as the format, mention 1.x only as supported until 2.1, drop the labels the outcome of 033 T072 allows — 034:FR-012 (README.md, docs/, site/src/content/docs/)
- [ ] [T072] [US7] `node scripts/check-docs-sync.mjs` passes and the CLI reference matches `ambykit --help` — 034:FR-012 (docs/cli-reference.md, scripts/check-docs-sync.mjs)
- **Verify:** `npx vitest run test/release/stable-labels.test.ts` and `node scripts/check-docs-sync.mjs` pass.

## Phase 9 — Release  (integration, person-run, only after Phases 1 to 8)

- [ ] [T080] INTEGRATION STEP (once per batch, after merges, not in a lane branch): re-record the emitter goldens with `UPDATE_GOLDEN=1 npx vitest run test/emitters-golden.test.ts` and review that only the intended 2.0 prompt and template changes appear (test/fixtures/emitters-golden/)
- [ ] [T081] INTEGRATION STEP (once per batch, after merges): `ambykit sync` twice, the second a no-op (.claude/, .agents/, .github/, .amby/templates/)
- [ ] [T082] PERSON: cut `release/2.0.0` from main: `package.json` and lockfile to 2.0.0, retitle `[Unreleased]` to `[2.0.0]` with the date and the Plugins line, fill the last-1.x placeholder in `docs/release.md` — 034:FR-001, FR-010 (package.json, package-lock.json, CHANGELOG.md, docs/release.md)
- [ ] [T083] Full gate on the release branch: `npm run typecheck`, `npm test`, `node scripts/check-docs-sync.mjs`, `ambykit sync --check`, `ambykit analyze`, `ambykit trace 034` (every FR covered) — 034:FR-003 (test/release/)
- [ ] [T084] PERSON: `npm run release:check` passes with C1 to C5 `met`, dated and with evidence; any condition not met stops here and is named — 034:FR-003, FR-004 (specs/034-release-2-0/gate.md)
- [ ] [T085] PERSON: publish: merge the release branch, tag `v2.0.0`, `gh release create v2.0.0`; the workflow verifies the tag and publishes with provenance and no stored token; if provenance fails, do not retry under another version without a recorded reason — 034:FR-008 (.github/workflows/publish.yml, CHANGELOG.md)
- [ ] [T086] PERSON: fresh install of the published package in an empty directory: `ambykit --version` prints 2.0.0 and `ambykit migrate --help` exists; record in `gate.md` (SC-004) — 034:FR-003 (specs/034-release-2-0/gate.md)
- **Verify:** T083 passes on the release branch and T086 is recorded. ? unverified: T082, T084 to T086 are person tasks; nothing is published by an assistant.
