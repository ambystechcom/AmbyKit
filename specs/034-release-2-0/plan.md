---
feature: 034-release-2-0
status: draft
created: 2026-11-24
---

# Implementation Plan — Release 2.0

> The HOW. Satisfies every `FR-###` in `@spec.md` and honors `@../../.amby/constitution.md`. Reference by ID; nothing here restates the spec.
> This feature adds **no product behaviour** (spec Assumptions): it adds release evidence, a gate check, release tooling, documents and tests
> that read them. The 2.0 features themselves are built by 030 to 033 and 036; this plan only orders what must be true on the release branch.

## Technical context

- **Stack:** Node ≥ 22 scripts (`scripts/*.mjs`, ESM, no new dependencies), GitHub Actions, Vitest, Markdown. Same style as `scripts/plugin-release.mjs`
  and `scripts/check-docs-sync.mjs`.
- **Reused, verified by reading the repository on 2026-11-24:**
  - `publish.yml`: Release trigger, `environment: Prod`, Node 22, npm upgrade for OIDC, tag-equals-version check (FR-008 already holds for the core),
    typecheck, test, build, skip-if-already-published, `npm publish --access public` (provenance automatic), `plugin/*` tags skipped.
  - `ci.yml`: matrix `ubuntu`/`windows`/`macos` on **Node 22 only**; after the matrix steps one extra `setup-node 20` step proves Node 20 stops with the
    "Node.js 22 or newer" message (030:FR-015). Spec FR-007 says CI "SHALL NOT run it on Node 20": the Node 20 step is not a test run but
    it is Node 20 in CI, so this is decision D-1.
  - `docs/migration.md`: what changes, four migrate steps, skip table, "a 1.x AmbyKit loses data on a v2 file", `--dual-write`, timeline to 2.1, the
    Antigravity move. `docs/contributing.md` "Release checklist" (bullets, no gate). `CHANGELOG.md` `[Unreleased]` already holds the 030 to 036 entries.
  - Gate evidence producers that exist: `ambykit migrate --dry-run` (030), `ambykit trace`, `analyze`, `ambykit run` fleet records in
    `.amby/fleet/` and `specs/033-*/dogfood.md` (033 T071), `specs/032-*/ui.md` signed off 2026-11-19 plus its keys-only tour (032 T113),
    `test/fixtures/spec-format*` (1.x fixtures), `RUN_STABILITY` in `src/core/run-stability.ts` (still `"experimental"`).
  - `package.json` is `1.6.0`; `npm publish` of a prerelease version needs an explicit `--tag` (npm refuses otherwise), which the workflow does not pass today.
- **Constraints driving choices:** Principle 6 (the gate is evidence on AmbyKit itself, not a claim), Principle 5 (every FR has a test or a recorded
  verification step), Principle 4 (a release-process statement is checked against the workflow file, not remembered), Principle 7 (the assistant prepares
  the branch and the checklist; `npm login`, publishing, tagging and `dist-tag` changes are person steps), Principle 3 (the guide is one page, no restating).

## Architecture

Three artifacts, two scripts, one checklist, plus documents. Nothing here runs at user runtime.

1. **Gate record `specs/034-release-2-0/gate.md` + `scripts/release-gate.mjs` (FR-003, FR-004).**
   `gate.md` holds a table of exactly the five conditions of US-2 (C1 own specs migrated, C2 1.x still read, C3 fleet built two dependent features, C4 dashboard
   designed and built with AmbyKit, C5 CI green on Node 22 on three platforms). Each row has `result` (`met` | `not met` | `pending`), a date and an `evidence`
   cell (a command and its summarized output, or a path to a recorded file). `release-gate.mjs` parses the table, exits non-zero naming the **first** condition
   that is not `met` with a date and non-empty evidence, and also checks the **preconditions** below. `npm run release:check` calls it. Pure parse function
   exported for the test.
2. **Preconditions (from US-4 and 036, not extra gate conditions) checked by the same script:** the Antigravity plugin is published
   (`npm view @ambystech/ambykit-emitter-antigravity version`, skipped offline with a warning) and `specs/036-*/tasks.md` shows T034, T035 and T037 ticked;
   the release candidate report exists (`rc-report.md`, FR-009) for a final release. The script distinguishes a final version from a prerelease by
   the version string, so a candidate can be cut without a finished gate.
3. **Dist-tag rule `scripts/release-tag.mjs` (FR-009).** From `package.json` version: a version with a prerelease suffix (`2.0.0-rc.1`) prints `next`
   (name is decision D-3), a plain version prints `latest`. `publish.yml` gains one step that computes it and passes `--tag` to `npm publish`,
   and, for a plain version only, runs `release-gate.mjs` before publishing (FR-004 enforced in CI as well as in the checklist). Existing safeguards
   (tag == version, skip if already published, OIDC, provenance, `plugin/*` ignored) are untouched.
4. **CI (FR-007).** The matrix stays Node 22 on the three platforms. A **workflow structure test** reads `ci.yml` and `publish.yml` as text and asserts the
   facts the spec states (matrix os list, `node-version: 22`, no `20` in the build matrix, tag check step, no `NODE_AUTH_TOKEN`, `id-token: write`, `plugin/`
   guard). What happens to the extra Node 20 step is D-1; the plan assumes it stays as a **separate step that is a negative check**, and the test
   allows exactly that one occurrence and names it.
5. **Documents.** `docs/release.md` (new): the release checklist in order, how to cut a candidate, the gate, the publish steps, fresh-install verification
   and the **rollback plan** (FR-010, FR-011); `docs/contributing.md` "Release checklist" keeps its bullets that apply every release and links to it.
   `docs/migration.md` gets a short **"Upgrade a 1.x project to 2.0"** section at the top that lists the order (Node 22, upgrade every tool that reads specs,
   `migrate --dry-run`, `migrate`, review, plugins for Antigravity, what `run` and the plugin API now promise, the pinned-1.x-CI path with `--dual-write`),
   pointing to the existing sections instead of repeating them (FR-002, US-1). The `[Unreleased]` changelog block is reorganised into a **Breaking changes**
   list (who is affected, what to do) that a test checks for the six breaking items of US-1 (FR-001); it is retitled `[2.0.0]` only on the release branch.
6. **Docs and site sweep (FR-012, US-7).** One inventory in `research.md` (the 8 current "experimental" hits in README, `docs/cli-reference.md`,
   `docs/plugin-api.md`, `docs/stability.md`, `docs/tool-compatibility.md`, `site/src/content/docs/cli/index.mdx`, plus 1.x-only statements); a test asserts there is no
   unqualified "experimental" label on `run` or the plugin API **when `RUN_STABILITY` is `"stable"`**, and that the label that remains when it is not is the single one
   033 produces (so 034 never contradicts 033 T072). The docs sync check (`scripts/check-docs-sync.mjs`) stays the CLI reference gate.
7. **Evidence, not code, for the person steps.** Release candidate: `rc-report.md` (project, date, steps, `check`/`analyze` result, problems found), and
   `gate.md` rows link to `specs/033-*/dogfood.md`, `specs/030-*/notes.md`, 032's tour record and CI run URLs.

## Phased approach

> `tasks.md` numbers its phases from 1 (Setup = Phase 1), so plan Phase N is tasks Phase N+1.

- **Phase 0 — Research:** confirm each fact above and inventory the label hits → `research.md`; the owner decisions D-1..D-5 are asked once (a person task) and recorded in `spec.md`.
- **Phase 1 — Foundational:** gate record format + `release-gate.mjs`, `release-tag.mjs`, `publish.yml` step, structure test. Blocks the rest because the gate and the tag rule are what
  every later release step calls.
- **Phase 2 — US-1 (P1):** changelog breaking list, upgrade section of the guide, the two tests, the person walk-through on a real 1.x project (SC-001).
- **Phase 3 — US-3 and FR-006 (P1):** the 1.x fixture test, then the **dogfood evidence** recorded in `gate.md` once 030 T095 has been committed (that task is the last commit before release).
- **Phase 4 — US-4 and US-2 (P1):** CI/publish structure test, plugin prerequisites checkpoint, gate rows filled as evidence arrives.
- **Phase 5 — US-6 (P2):** the candidate: branch prepared by the assistant, published, tried on a project other than this repository by a person, report recorded.
- **Phase 6 — US-5 (P2):** `docs/release.md` with the rollback plan and its test.
- **Phase 7 — US-7 (P2):** label and 1.x sweep and its test.
- **Phase 8 — Release (integration, person-run):** goldens once, `sync` twice, release branch bump, full gate, `release:check`, tag and publish, fresh-install check.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `[2.0.0]` changelog block with a Breaking changes list (who, what to do); `test/release/changelog-2-0.test.ts` checks the six items of US-1 and the `[plugin-api]` stable line |
| FR-002 | "Upgrade a 1.x project to 2.0" section in `docs/migration.md`; `test/release/migration-guide.test.ts` checks every `ambykit <command>` in the guide's code blocks is a registered command and every flag exists in `--help`; person walk-through (SC-001) in `rc-report.md` |
| FR-003 | `gate.md` rows with result, date and evidence; `release-gate.mjs` rejects a `met` row without a date or evidence; `test/release/release-gate.test.ts` |
| FR-004 | `release-gate.mjs` exits non-zero naming the first unmet condition; `npm run release:check`; `publish.yml` runs it before publishing a plain version; tested with fixture tables |
| FR-005 | 030 T095 does the migration; 034 records the proof in `gate.md` C1: `migrate --dry-run` reports nothing to do, second run no-op, `analyze`, `trace`, full suite on the migrated tree (person/assistant task, last) |
| FR-006 | `test/release/legacy-fixtures.test.ts` asserts 1.x fixtures exist in `test/fixtures/` and read through the 1.x reader to the same model as their v2 twins |
| FR-007 | `test/release/workflows.test.ts` reads `ci.yml`; matrix `os` is exactly the three platforms on `node-version: 22`; the Node 20 step is the one allowed negative check (D-1) |
| FR-008 | the existing workflow steps, pinned by the same structure test (tag check, `id-token: write`, no stored token, provenance via `npm publish`) |
| FR-009 | `release-tag.mjs` + `publish.yml` `--tag`; `test/release/release-tag.test.ts`; the gate script requires `rc-report.md` with a project other than this repository for a plain version |
| FR-010 | `docs/release.md` rollback section names `npm dist-tag add`, `npm deprecate`, `gh release edit`, who runs each, and "ship 2.0.1"; `test/release/rollback-doc.test.ts` |
| FR-011 | the same section states what 1.x loses on a v2 file and the two ways back (dual-write, restore from version control); the test checks it links `docs/migration.md` |
| FR-012 | sweep per `research.md`; `test/release/stable-labels.test.ts`; `scripts/check-docs-sync.mjs` passes |
| US-1 | Phase 2 |
| US-2 | Phase 1 and Phase 4 (gate record and script) |
| US-3 | Phase 3 (depends on 030 T095) |
| US-4 | Phase 4 and Phase 8 |
| US-5 | Phase 6 |
| US-6 | Phase 5 |
| US-7 | Phase 7 |

## Risks & decisions

- **D-1 (owner): the Node 20 step in `ci.yml`.** FR-007 says CI does not run on Node 20. The current job installs Node 20 only to prove the required-version message (030:FR-015),
  which is the behaviour users on Node 20 will hit. Recommended: **keep it** as a negative check and amend FR-007 to "no build, test or publish job runs on Node 20". 030 T090 asked
  the same question and is still open. Alternative: delete the step and cover the message with a unit test of the bin entry (loses the real-Node-20 proof).
- **D-2 (owner): is the Antigravity plugin a gate condition?** US-2 says the gate has *exactly* five conditions and US-4 puts the plugin in the checklist; 036 says it "gates 2.0".
  Plan default: a **precondition** enforced by the same script, not a sixth condition. Changing it means amending US-2.
- **D-3 (owner): candidate dist-tag name.** Plan default `next`. Spec only says "non-`latest`".
- **D-4 (owner): last 1.x version for rollback.** Today 1.6.0; if a 1.6.x or 1.7 ships first, `docs/release.md` must name that one. The rollback test reads the version from `package.json` of the
  last tag, so the doc states a placeholder the release branch task fills.
- **D-5 (owner): `RUN_STABILITY`.** 033 T072 decides it. If `run` stays experimental, the 2.0 changelog must say so and FR-012's "no experimental label" applies to the plugin API only. The label test reads the constant so both outcomes pass.
- **Risk: gate and release are blocked by person steps** (033 T063/T064/T071, 030 T090/T091/T095, 032 T113, 036 T034/T035/T037). Not waivable per the spec edge cases; the plan makes them visible in `gate.md` as `pending` with the task id instead of tracking them twice.
- **Risk: `gate.md` becomes ceremony.** Mitigated by the script refusing empty evidence and by evidence being a command or a file path that a reviewer can re-run.
- **Out of the plan:** no version bump, tag or publish happens in this feature's build until Phase 8, which is person-run on a `release/2.0.0` branch after every earlier phase passes; 035 (2.1) is untouched.
