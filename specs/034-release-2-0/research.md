---
feature: 034-release-2-0
created: 2026-11-24
---

# Research — Release 2.0

> T001. Each fact the plan relies on, checked against the repository on 2026-11-24 (main a7bb666), and the inventory the
> docs sweep (T071) works from. Owner decisions D-1 to D-5 are in `spec.md` → Clarifications.

## Facts confirmed

| Plan fact | Where | Found |
|---|---|---|
| Core publish trigger, environment and auth | `.github/workflows/publish.yml` | GitHub Release `published` or manual dispatch; `environment: Prod`; `permissions: id-token: write`; no `NODE_AUTH_TOKEN`; npm upgraded for OIDC |
| Tag equals package version | same | `Verify tag matches package version` step, release events only |
| Skip if already published | same | `Check whether this version is already on npm` step, then `Publish` guarded by `exists != 'true'` |
| No dist-tag passed | same | `npm publish --access public` with no `--tag`: a prerelease version would be refused by npm. T012 adds the tag |
| `plugin/*` tags ignored | same | job-level `if` skips release tags starting `plugin/` |
| CI matrix | `.github/workflows/ci.yml` | `os: [ubuntu-latest, windows-latest, macos-latest]`, one `setup-node` with `node-version: 22` |
| Node 20 step | same | **in the same job**, after the self-host checks: a second `setup-node` with `node-version: 20` and one step that expects a non-zero exit and the "Node.js 22 or newer" message. Kept per D-1 as the one negative check |
| Contributing release checklist | `docs/contributing.md` → "Release checklist" | four bullets (changelog move and bump, Plugins line, 2.x spec-format note, typecheck/test/sync check); no gate, no candidate, no rollback |
| Migration guide sections | `docs/migration.md` | What changes; Migrate in four steps; It is safe by construction (skip table, 8 reasons); A 1.x AmbyKit loses data on a v2 file (`--dual-write`); Editing a v2 file; Timeline; Antigravity is a plugin in 2.0; Also in 2.0. No single ordered upgrade path |
| Changelog | `CHANGELOG.md` `[Unreleased]` | holds the 030 to 036 entries under Added / Changed (two `### Changed` headings); breaking items are marked inline, not grouped |
| 1.x fixtures | `test/fixtures/spec-format-twins/{v1,v2}` | one 1.x/v2 twin pair (spec and tasks); `test/fixtures/spec-format/{edge-rich,malformed}` and `test/fixtures/spec-model-v1.json` (1.x model baseline); `test/fixtures/run-1.6` (1.6 run state) |
| `RUN_STABILITY` | `src/core/run-stability.ts` | `"experimental"`; `stabilityLabel()` returns `(experimental)`; a test refuses `"stable"` without a passing `specs/033-*/dogfood.md` |
| Version | `package.json` | `1.6.0`; `engines.node` `>=22` |
| Script style | `scripts/plugin-release.mjs` | ESM, pure functions exported for a test in `test/scripts/`, `main()` behind an argv guard, `::error::` lines |

## Couplings

- `release-gate.mjs` reads `specs/034-release-2-0/gate.md`, `specs/036-*/tasks.md` (T034, T035, T037 ticked) and, for a plain
  version, `specs/034-release-2-0/rc-report.md`. The npm lookup of the plugin is skipped offline with a warning.
- `publish.yml` calls `release-tag.mjs` (every publish) and `release-gate.mjs` (plain versions only).
- `docs/release.md` is linked from `docs/contributing.md`; the rollback test reads `docs/release.md`.
- The label test reads `RUN_STABILITY` so it passes before and after 033 T072 (D-5).

## "experimental" labels (README, docs, site)

| File | Line | About | 2.0 outcome |
|---|---|---|---|
| `README.md` | 160 | `ambykit run` row | stays while `RUN_STABILITY` is `"experimental"` (D-5) |
| `docs/cli-reference.md` | 370, 373 | `ambykit run` heading; "Experimental in 1.6" | heading stays (D-5); "in 1.6" reworded to name the condition, not a version |
| `docs/cli-reference.md` | 420 | fleets heading | stays with `run` (D-5) |
| `docs/plugin-api.md` | 129 | version history "1.x: experimental" | history, qualified by version: allowed |
| `docs/stability.md` | 102 | `run` stays experimental until the dogfood | the one statement 033 makes: allowed |
| `docs/tool-compatibility.md` | 198 | headless runners heading | stays with `run` (D-5) |
| `site/src/content/docs/cli/index.mdx` | 305, 307 | `ambykit run` heading; "Experimental in 1.6" | as cli-reference |
| `site/src/content/docs/cli/index.mdx` | 319 | fleets | stays with `run` (D-5) |

No page labels the **plugin API** experimental except the version history line above.

## 1.x-only statements

- No README, docs or site page describes the 1.x format as the current one; the 1.x mentions are `migrate`/`edit` descriptions and
  the migration guide.
- No page says how long 1.x is read except `docs/migration.md` → Timeline (2.1). README and the site's CLI page mention 1.x without
  saying it is supported until 2.1: the sweep adds that one statement.
