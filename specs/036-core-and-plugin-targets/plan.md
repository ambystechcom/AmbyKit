---
feature: 036-core-and-plugin-targets
status: draft
created: 2026-11-20
---

# Implementation Plan — Core targets and official plugin targets

> The HOW. Satisfies every `FR-###` in `@spec.md` (clarifications C-1..C-5; C-2..C-4 are assumed defaults, confirm with owner) and
> honors `@../../.amby/constitution.md`. Reference by ID; nothing here restates the spec.

## Technical context

- **Stack:** TypeScript, ESM, Node ≥ 22, Vitest; plugins are npm packages on the 027 plugin API frozen by 033.
- **Reused, verified by reading the code:** the target registry `TARGETS` and `getTarget(id, source)` (`src/emitters/index.ts`), the plugin loader
  and registry (`src/plugins/*`), the contract kit (`src/testkit/contract.ts`), the moved-target mechanism `MOVED_TARGETS` / `movedTargetNotices`
  (`src/core/moved-targets.ts`, called from `sync.ts` and `check.ts`; it warns and deletes nothing), `sharedOutputs(ids, source)` for the
  co-owned `.agents/skills`, and `docs/plugin-split.md` (the earlier classification, which kept Antigravity built in).
- **The two Antigravity emitters are small** (`antigravity.ts` 25 lines, `antigravity-cli.ts` 23): both extend `SkillsEmitter`, so they fit
  the plugin API, with two exceptions: the CLI emitter imports `MCP_COMMAND` from `base-emitter.js` and the type names `EmittedFile` and
  `RulesContext`, none of which `createPluginApi()` hands out (see R1).
- **Constraints driving choices:** Principle 7 (never delete or rewrite a moved target's files; never install or write user-level files
  without consent), Principle 4 (each plugin's format row comes from the host's docs; the kit fails without a row), Principle 5 (tests per FR),
  Principle 6 (the 2.0 gate is the Antigravity plugin published and install-tested), Principle 2 (plugins subclass the API's classes, no copy).

## Architecture

1. **Core (this repository).** Two entries are added to `MOVED_TARGETS` (`antigravity`, `antigravity-cli`, package
   `@ambystech/ambykit-emitter-antigravity`, since `2.0.0`); the long-tail ids get a `deprecated` state naming the package that will replace
   them. A pure `targetStatus(id)` returns `built-in | moved | deprecated` and feeds `init`, `add`, `check`, `update` and the docs check, so one
   function decides what is core. `sync`, `check` and `update` turn the existing warning into a per-target failure: the other targets still run,
   the exit code is non-zero, nothing is deleted (FR-004, FR-005). `init` and `add` list moved targets as "official plugin, install first"
   (FR-010); `update` offers the install and config change and writes nothing user-level without consent (FR-006).
2. **Plugins in this repository (decided, C-3): `plugins/<name>/`, no npm workspaces, one deploy workflow.** One package per moved target,
   `@ambystech/ambykit-emitter-<target>`; the Antigravity package contains both harnesses and `export default (api) => …` built on
   `api.SkillsEmitter`, with only `import type` from `@ambystech/ambykit/plugin`. Each package declares `ambykit.pluginApi`, carries its
   compatibility row and golden fixture, and its tests run in the root vitest with the published contract kit (`@ambystech/ambykit/testkit`).
   `scripts/build-plugins.mjs` runs `tsc` per plugin (a no-op with none); `ci.yml` calls it. `publish-plugins.yml` (a push to `main`
   that changes `plugins/**`, publishing each plugin whose version is not on npm yet, or a manual run with a `plugin` input) runs typecheck,
   build, the plugin's tests and the package and API-range check (`scripts/plugin-release.mjs`), then `npm publish --access public` with
   OIDC and provenance, then tags `plugin/<name>/v<x.y.z>` with a Release from `GITHUB_TOKEN` (which starts no other workflow);
   `publish.yml` also skips `plugin/*` tags. (Changed after 1.0.1: the first design published from a Release, which started a skipped
   `publish.yml` run, and every core release started a skipped plugin run.) The Antigravity package is built first and is the only one that gates 2.0 (C-4).
3. **Removal is the last step.** The built-in Antigravity emitters are deleted from `TARGETS` only after the plugin is published and
   install-tested (a person task), so 2.0 can never ship with Antigravity in neither place. Until then both exist and the registry prefers
   the built-in.
4. **Tests.** Generic behaviour (missing plugin, co-owned directory, installed plugin, outdated plugin) is tested in core with a **fixture
   plugin shaped like Antigravity** (`test/fixtures/plugins/skills-target/`), so core never depends on the published package. Antigravity's own
   format tests and goldens move to `plugins/antigravity/test/` (FR-012).

## Phased approach

- **Phase 0 — Research:** confirm coupling points (below), the API gaps and which tests reference Antigravity → `research.md`.
- **Phase 1 — Foundation:** `targetStatus`, the fixture plugin, callers that need the registry.
- **Phase 2 — US-1:** missing-plugin failure semantics, installed-plugin identity, co-owned `.agents/skills`.
- **Phase 3 — US-2:** the release workflow and its scripts, the Antigravity package in `plugins/antigravity/`, contract runs, first publish and install test (person tasks).
- **Phase 4 — US-3:** `MOVED_TARGETS` entries, `init`/`update` messages, changelog and migration guide.
- **Phase 5 — US-4 (gated by Phase 3):** remove the built-in Antigravity emitters, docs, goldens, rewrite or move the tests.
- **Phase 6 — Integration and person gates:** goldens once, `sync` twice, full checks, confirm the defaults.

**Coupling points found (verify in Phase 0):** `SELF_REPORT_PRIORITY` in `src/core/emit.ts` names `antigravity` ids as strings (stays valid);
`src/core/agents.ts` and `src/core/subagents.ts` hold per-id data (agent families, worker-agent support); `src/core/legacy.ts` cleans retired
Antigravity workflow files and calls `getTarget(id)` **without** a registry, so a plugin-provided target would be invisible there; the dashboard's
agent badges (`live-tokens.ts`) identify running processes and are unrelated to emission, so they stay. Twelve test files mention Antigravity
(`test/antigravity-*.test.ts`, `test/legacy.test.ts`, `test/emit-collision.test.ts`, `test/emit-mcp.test.ts`, `test/mcp-emit-antigravity.test.ts`,
`test/m3-emitters.test.ts`, `test/worker-emit.test.ts`, `test/core/antigravity-identity-018.test.ts`, `test/ui/dashboard-agents.test.ts`,
`test/emitters-golden.test.ts`).

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001, US-4 | `TARGETS` keeps exactly the eight built-in ids; a registry test compares to the list (Phase 5) |
| FR-002 | Antigravity entries in `MOVED_TARGETS`, removal gated on the install test; long tail `deprecated` until published (Phases 4, 5) |
| FR-003, US-1, SC-001 | plugin built on `api.SkillsEmitter` emits what 1.x emitted; contract run plus an install test against 1.6-synced files (Phase 3) |
| FR-004, FR-005, US-1, SC-002 | per-target failure with install line, others continue, non-zero exit, no delete (Phase 2) |
| FR-006 | `update` offers and asks; no user-level write, no install (Phase 4) |
| FR-007, FR-008, US-2, SC-003 | one package per target with its row and the kit in CI; per-package release (Phase 3) |
| FR-009, US-3 | changelog and migration guide list ids, packages, install lines (Phase 4) |
| FR-010 | `init` and `add` list moved targets as official plugins (Phase 4) |
| FR-011 | `docs/tool-compatibility.md`, README, `docs/plugin-split.md` updated; doc-sync stays green (Phase 5) |
| FR-012 | core goldens keep the built-in ids only; Antigravity goldens live in `plugins/antigravity/test/` (Phase 5) |

## Risks & decisions

- **D1 — Plugins in this repository (C-3, decided).** Core and plugin change in one pull request and share CI; independent versions (FR-008) come from per-plugin tags, not a second repository. No workspaces: plugins have no runtime dependencies. Cost: the first publish of each package is manual (npm cannot trust a package that does not exist yet) and a plugin release depends on this repository's workflow.
- **D2 — Gate on Antigravity only (C-4, assumed).** Keeps 2.0 from waiting on seven low-use plugins; the cost is seven targets stay built in with a notice.
- **D3 — Fixture plugin in core.** Core tests never need the published package, so core CI stays offline and fast (Principle 7).
- **R1 — Plugin API gaps.** `MCP_COMMAND` and the `EmittedFile` / `RulesContext` types are not in `PluginApi`. They must be added (or the plugin
  inlines them) **before** 033's T040 freezes the API; otherwise the CLI emitter needs a core release to fix. Recorded as a gate in tasks.
- **R2 — Registry-blind callers.** `legacy.ts` and any `getTarget(id)` without a registry hide plugin targets; T012 finds and fixes each.
- **R3 — Co-owned `.agents/skills`.** `codex` and `pi` (built in) share the directory with Antigravity; `sharedOutputs(ids, source)` must see the
  plugin's target. Tested with the fixture plugin.
- **R4 — Two repositories** to coordinate (RC of core for the plugin's CI, goldens duplicated until removal). Mitigation: the plugin CI installs the core RC.
- **R5 — Publish slips.** If the Antigravity plugin is not published, 2.0 keeps the built-in emitters with a deprecation notice and says so (C-4 fallback).
- **Gap for clarify:** none beyond C-2..C-4 (person task T094).
