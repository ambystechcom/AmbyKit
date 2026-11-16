---
feature: 027-plugin-api
created: 2026-11-16
---

# Tasks — Plugin API for emitters and extensions

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes.
> Each phase ends with one `**Verify:**` line that `/amby.implement` runs before the checkpoint (spec 020).
> US-6 (custom phases, templates, roles) ships in a later 1.x release: no tasks here. Task IDs run in
> story order US-1, US-2, US-7, US-4, US-3, US-8, then US-5 (P2).
> Build order: 027 builds AFTER 025: rebase on 025; merge the `sync` output message by hand (shared: src/core/emit.ts 025 T062 vs T021, src/core/types.ts 025 T061 vs T001, src/emitters/base-emitter.ts, src/cli/sync.ts 025 T069 vs T040/T091).
> T080's 'goldens unchanged' check is a BATCH step: run after merging, not inside a lane branch.
> Shared hotspot files: rebase and merge by hand, different lines only (src/cli/index.ts, src/core/config.ts, src/core/types.ts, docs/cli-reference.md, CHANGELOG, docs/workflow.md, docs/tool-compatibility.md, README.md).

## Phase 1 — Setup

- [x] [T001] [P] Add optional `plugins` map (package → exact version) to the config schema and `AmbyConfig`; rebase on 025's changes to the same files (src/core/config.ts, src/core/types.ts)
- [x] [T002] [P] Add a fixture plugin package `ambykit-emitter-fake` (valid), plus broken variants: no pin match, wrong API range, bad shape (test/fixtures/plugins/)
- [x] [T003] [P] Add `./plugin` and `./testkit` subpath exports (package.json)

**Verify:** `npm run typecheck` passes, and `loadConfig` still parses an existing `.amby/config.json` with no `plugins` key. ✓ passed

## Phase 2 — Foundational  (blocks all feature work)

- [x] [T010] [P] Pure semver range check: exact, `^`, `~`, `>=`, `<`, AND by space, `||`; unsupported grammar returns a reason (src/plugins/semver.ts)
- [x] [T011] [P] Test `semver.ts` incl. `^1` vs `1.0.0`/`2.0.0` and an unsupported range (test/plugins/semver.test.ts)
- [x] [T012] [P] Plugin API surface: `PLUGIN_API_VERSION` = 1.0.0, `PLUGIN_API_EXPERIMENTAL`, `PluginModule`, `PluginFactory`, `PluginApi` types (src/plugins/api.ts)
- [x] [T013] [P] Manifest reader: package-name rule (`ambykit-emitter-*`, scoped ok), installed version, declared `ambykit.pluginApi` range (src/plugins/manifest.ts)
- [x] [T014] [P] Test `manifest.ts` for good, badly named, no-range and malformed package.json (test/plugins/manifest.test.ts)
- [x] [T015] [P] Target registry: built-ins + plugin targets, reports id collisions with built-ins and other plugins, never overrides (src/plugins/registry.ts)
- [x] [T016] [P] Test registry collisions: plugin vs built-in, plugin vs plugin, ordering and no silent override (test/plugins/registry.test.ts)
- [x] [T017] Async loader: resolve only `<root>/node_modules/<pkg>`, require exact pin = installed version, check API range, `import()`, validate shape, accept object or factory, return `{loaded, failures}` (src/plugins/loader.ts)
- [x] [T018] Test loader against the fixture plugins: loaded, missing, pin mismatch, wrong range, bad shape, throws on load (test/plugins/loader.test.ts)
- [x] [T019] Public barrel for plugin authors and re-export from the library entry (src/plugins/index.ts, src/index.ts)
- [x] [T020] Make `getTarget`, `emittersForTargets` and `sharedOutputs` accept an optional registry, defaulting to the built-in `TARGETS` (src/emitters/index.ts)
- [x] [T021] `buildEmittedFiles` takes a registry; guard every project-scope path against escaping the root; collision error names the plugin; rebase on 025 T062 (src/core/emit.ts)
- [x] [T022] Test the path guard and the plugin-naming collision error (test/plugins/emit-guard.test.ts)
- **Checkpoint:** Foundational complete: a plugin can be loaded and registered in code, and no caller is changed yet.

**Verify:** `npm run typecheck` and `npx vitest run test/plugins test/emitters-golden.test.ts` pass (built-in output unchanged). ? unverified: test/plugins passes and typecheck is clean; test/emitters-golden.test.ts still fails on 019's pending re-record only (amby.run and amby-worker files, checked by diff), so it is rerun in the integration batch

## Phase 3 — User story US-1  Write a plugin emitter (priority: P1)

- [x] [T030] [P] [US1] Worked example plugin `ambykit-emitter-example` extending each of the three extension points (examples/ambykit-emitter-example/)
- [x] [T031] [P] [US1] Author `docs/plugin-api.md`: every extension point, option and guarantee, the factory form and the experimental label (docs/plugin-api.md)
- [x] [T032] [US1] Test that a plugin built only from the documented API emits files via `BaseEmitter`, `SkillsEmitter` and `TomlCommandEmitter` with no core change (test/plugins/extension-points.test.ts)
- **Checkpoint:** US-1 is demoable: the example plugin emits files in code.

**Verify:** `npx vitest run test/plugins/extension-points.test.ts` passes, and every extension point in `docs/plugin-api.md` appears in the barrel exports. ✓ passed

## Phase 4 — User story US-2  Discover and load plugins at sync (priority: P1)

- [x] [T040] [P] [US2] `sync` loads plugins from config, prints `name@version` and the experimental note, reports each failure, syncs the other targets, exits 1 on any failure; rebase on 025 T069 and merge the sync output message by hand (src/cli/sync.ts)
- [x] [T041] [P] [US2] `check` validates plugin-provided targets and shared outputs through the registry (src/cli/check.ts)
- [x] [T042] [P] [US2] `add` accepts a plugin target id only when its plugin loads (src/cli/add.ts)
- [x] [T043] [US2] E2E: list the fixture plugin, `sync`, assert files, a missing package, a collision, and an empty second-run diff (test/cli/sync-plugins.test.ts)
- **Checkpoint:** US-2 is demoable: `sync` emits a plugin's target from a config line.

**Verify:** `npx vitest run test/cli/sync-plugins.test.ts` passes, and `ambykit sync --check` is clean on a project with the fixture plugin after one `sync`. ✓ passed

## Phase 5 — User story US-7  Load third-party code safely (priority: P1)

- [x] [T050] [P] [US7] Test trust rules: unlisted package never loaded, listing without an exact version refused, installed version ≠ pin refused, parent/global install ignored (test/plugins/trust.test.ts)
- [x] [T051] [P] [US7] Test `scope:"user"` plugin files need `--include-user` and stay out of `sync --check` (test/cli/sync-plugin-userscope.test.ts)
- [x] [T052] [P] [US7] Author `docs/plugin-trust.md`: what a plugin can and cannot do, pins, consent, no sandbox (docs/plugin-trust.md)
- **Checkpoint:** US-7 holds: nothing runs unlisted, unpinned or unconsented.

**Verify:** `npx vitest run test/plugins/trust.test.ts test/cli/sync-plugin-userscope.test.ts` passes. ✓ passed

## Phase 6 — User story US-4  Trust a documented, versioned API (priority: P1)

- [x] [T060] [US4] Test the API-range refusal names the expected range and the found version, and the experimental label is printed (test/plugins/api-version.test.ts)
- [x] [T061] [P] [US4] Add the `[plugin-api]` changelog convention and the 1.6 entry stating the API is experimental (CHANGELOG.md)
- [x] [T062] [P] [US4] Add a release-checklist line: state in the changelog whether plugins are affected (docs/contributing.md)
- **Checkpoint:** US-4 holds: version mismatches are refused clearly and the stability promise is written down.

**Verify:** `npx vitest run test/plugins/api-version.test.ts` passes, and CHANGELOG.md has a `[plugin-api]` line under the unreleased section. ✓ passed

## Phase 7 — User story US-3  Prove a plugin against its compatibility row (priority: P1)

- [x] [T070] [P] [US3] `MatrixRow` type and `checkEmitterContract` comparing emitted paths and leading YAML/TOML frontmatter keys with the row; missing row fails (src/testkit/contract.ts)
- [x] [T071] [US3] Testkit entry exporting `checkEmitterContract` and a throwing `assertEmitterContract` that lists all differences (src/testkit/index.ts)
- [x] [T072] [US3] Test the kit: a correct row passes; a wrong path, an unknown key and a missing row each fail and name the difference (test/plugins/testkit.test.ts)
- [x] [T073] [P] [US3] Document the machine-readable row format next to the matrix (docs/tool-compatibility.md)
- **Checkpoint:** US-3 is demoable: the example plugin passes the kit; a deliberately wrong row fails.

**Verify:** `npx vitest run test/plugins/testkit.test.ts` passes, and the kit runs from a directory with no AmbyKit checkout using only the package exports. ✓ passed

## Phase 8 — User story US-8  Existing projects keep working (priority: P1)

- [x] [T080] [US8] BATCH STEP (run after merging, not in a lane branch): test that a project with no `plugins` key produces byte-identical `sync` output and never imports the loader (test/plugins/no-plugins-regression.test.ts)
- **Checkpoint:** US-8 holds.

**Verify:** `npm test` passes in full, and `ambykit sync --check` reports no diff for this repo's own tool files. ? unverified: npm test passes except the 10 emitters-golden tests, which fail only on 019's pending re-record; sync --check differs by 019's three files. Emitted bytes for all 18 targets (183 files, MCP on) are identical to 019's tip when both commits are built from git archive. Rerun both in the integration batch

## Phase 9 — User story US-5  Keep the core lean (priority: P2)

- [ ] [T090] [P] [US5] Moved-target map (target id → official package) and a pure lookup (src/core/moved-targets.ts)
- [ ] [T091] [US5] `sync` tells the person which package to install for a moved target and removes nothing; rebase on 025 T069 (src/cli/sync.ts)
- [ ] [T092] [P] [US5] Record each target as built in or official plugin with the demand and churn evidence columns, for review at the 2.0 gate (docs/plugin-split.md)
- [ ] [T093] [US5] Test the notice for a moved target and that no existing file is removed (test/plugins/moved-targets.test.ts)
- **Checkpoint:** US-5 mechanism is demoable; no built-in target is removed in 1.6 (see plan, open decision 3).

**Verify:** `npx vitest run test/plugins/moved-targets.test.ts` passes, and `docs/plugin-split.md` lists all 18 targets.

## Phase 10 — Polish

- [ ] [T100] [P] Document the `plugins` config key and the testkit entry (docs/cli-reference.md)
- [ ] [T101] [P] Add the plugin loader to the architecture overview (docs/architecture.md)

**Verify:** `npm run typecheck` and `npm test` pass, and the docs link to `docs/plugin-api.md` and `docs/plugin-trust.md`.
