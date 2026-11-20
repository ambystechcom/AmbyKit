---
feature: 036-core-and-plugin-targets
created: 2026-11-20
---

# Tasks — Core targets and official plugin targets

> Line format: `- [ ] [T###] [P?] [US#] description (file/path)`
> `[x]` = done (source of truth for `ambykit dashboard`). `[P]` = parallelizable. `[US#]` = story tag.
> Gate: no user-story task starts until Foundational completes. **Extra gates:** (1) **033's plugin-API freeze** (033 T040): any addition the
> Antigravity plugin needs (`MCP_COMMAND`, the `EmittedFile` and `RulesContext` types) must be in `PluginApi` before that task; T003 records
> the list; (2) Phase 5 (removing the built-in Antigravity emitters) starts only after the plugin is **published and install-tested** (person
> tasks T034, T035); (3) the plugin repository is a **sibling repository** (assumed default C-3): its paths are written `ambykit-plugins:` and are
> not in this repository. Tests name what they cover as `036:FR-###`.
> Story order: US-1 → US-2 → US-3 → US-4.
> Written in the 1.x task format on purpose: the repo's own specs migrate last (030 T095).

## Phase 1 — Setup

- [ ] [T001] Research: confirm each coupling point (`emit.ts`, `agents.ts`, `subagents.ts`, `legacy.ts`, `live-tokens.ts`), the 12 test files, and every `getTarget(id)` call without a registry (specs/036-core-and-plugin-targets/research.md)
- [ ] [T002] Fixture plugin shaped like Antigravity: a `SkillsEmitter` target writing `.agents/skills/`, in factory form, with its `package.json` (test/fixtures/plugins/skills-target/)
- [ ] [T003] Gate: list the API additions the Antigravity plugin needs and hand them to 033 before its T040 (`MCP_COMMAND`, types) (specs/036-core-and-plugin-targets/research.md)
- **Verify:** `npm run typecheck` passes and `research.md` names every coupling point and API gap. ? unverified: T003 depends on 033's schedule.

## Phase 2 — Foundational  (blocks all feature work)

- [ ] [T010] [P] `targetStatus(id)`: `built-in`, `moved` (package, since) or `deprecated` (package that will replace it); pure (src/core/moved-targets.ts, test/plugins/moved-targets.test.ts)
- [ ] [T011] [P] `sync`, `check` and `update`: a configured moved target with no plugin fails only that target, prints the install and config lines, continues, exits non-zero, deletes nothing (src/cli/sync.ts, src/cli/check.ts, src/cli/update.ts)
- [ ] [T012] [P] Pass the plugin registry to every caller that looked a target up without one, so a plugin-provided target is visible (src/core/legacy.ts, src/core/emit.ts)
- **Verify:** `npm run typecheck` and `npx vitest run test/plugins/moved-targets.test.ts` pass.
- **Checkpoint:** `targetStatus` exists, a missing plugin is a per-target failure, and no caller is registry-blind. User stories may start.

## Phase 3 — User story US-1  (priority: P1)

- [ ] [T020] [US1] Tests: a moved target with its plugin listed and installed emits the files the fixture plugin defines, and a built-in target is unchanged — 036:FR-003 (test/plugins/moved-installed.test.ts)
- [ ] [T021] [US1] Tests: a moved target with no plugin names the target, prints the exact install and config lines, other targets still sync, exit is non-zero, no file is changed or deleted — 036:FR-004, FR-005 (test/plugins/moved-missing.test.ts)
- [ ] [T022] [US1] Tests: `codex` plus a plugin target sharing `.agents/skills` keep the shared files; removing one owner leaves them (test/plugins/moved-shared-outputs.test.ts)
- [ ] [T023] [US1] Tests: plugin installed but not listed, version mismatch, plugin outdated for the stable API, offline `update` — 036:FR-004 (test/plugins/moved-edge.test.ts)
- **Verify:** `npx vitest run test/plugins` passes.
- **Checkpoint:** US-1 done in core with the fixture plugin.

## Phase 4 — User story US-2  (priority: P1; mostly in the plugin repository, ends in person gates)

- [ ] [T030] [US2] **Plugin repo:** create the sibling repository as an npm-workspaces monorepo with CI and Trusted Publishing (ambykit-plugins: package.json, .github/workflows/)
- [ ] [T031] [US2] **Plugin repo:** `@ambystech/ambykit-emitter-antigravity` with both harnesses on `api.SkillsEmitter`, declaring `ambykit.pluginApi` (ambykit-plugins: packages/emitter-antigravity/)
- [ ] [T032] [US2] **Plugin repo:** the contract kit against the Antigravity row from `docs/tool-compatibility.md`, and the two goldens moved here from core — 036:FR-007, FR-012 (ambykit-plugins: packages/emitter-antigravity/test/)
- [ ] [T033] [US2] **Plugin repo:** CI installs the core 2.0 release candidate and runs the kit; one package releases without the others — 036:FR-008 (ambykit-plugins: .github/workflows/)
- [ ] [T034] [US2] **Person task:** publish `@ambystech/ambykit-emitter-antigravity` (ambykit-plugins: packages/emitter-antigravity/)
- [ ] [T035] [US2] **Person task:** install-test on a project synced by 1.6 with `antigravity` and `antigravity-cli`: install the package, list it, run `ambykit sync`, expect no diff — 036:SC-001 (specs/036-core-and-plugin-targets/research.md)
- [ ] [T036] [US2] Long-tail plugins (`gemini`, `llxprt`, `qwen`, `kilo`, `augment`, `windsurf`, `kiro`), one package each; **not a 2.0 gate** (ambykit-plugins: packages/)
- **Verify:** the plugin repository's CI is green on the kit and goldens. ? unverified: T034 and T035 need a person; T036 is after 2.0.
- **Checkpoint:** US-2 done for Antigravity when T034 and T035 pass; this unlocks Phase 6.

## Phase 5 — User story US-3  (priority: P1)

- [ ] [T040] [US3] `MOVED_TARGETS` entries for `antigravity` and `antigravity-cli` (since 2.0.0); `deprecated` entries for the long tail naming the replacing package (src/core/moved-targets.ts)
- [ ] [T041] [US3] `update` offers the install and config change and writes nothing user-level without consent — 036:FR-006 (src/cli/update.ts, test/plugins/moved-update.test.ts)
- [ ] [T042] [US3] `init` and `add` list built-in targets and show moved ones as "official plugin, install first" with the install line — 036:FR-010 (src/cli/init.ts, src/cli/add.ts, test/cli/init-targets.test.ts)
- [ ] [T043] [US3] Changelog and migration guide list the moved ids, package names and install lines — 036:FR-009 (CHANGELOG.md, docs/migration.md)
- **Verify:** `npx vitest run test/plugins/moved-update.test.ts test/cli/init-targets.test.ts` pass.
- **Checkpoint:** US-3 done.

## Phase 6 — User story US-4  (priority: P2; gated by T034 and T035)

- [ ] [T050] [US4] Remove the built-in Antigravity emitters from `TARGETS`; `TARGETS` is exactly the eight built-in ids — 036:FR-001, FR-002 (src/emitters/index.ts, src/emitters/antigravity.ts, src/emitters/antigravity-cli.ts, test/plugins/registry-core.test.ts)
- [ ] [T051] [US4] Mark each target built in or official plugin, with its package, and update the earlier split page — 036:FR-011 (docs/tool-compatibility.md, README.md, docs/plugin-split.md)
- [ ] [T052] [US4] Core goldens keep the built-in ids only; the Antigravity fixtures are removed (they live in the plugin repo) — 036:FR-012 (test/emitters-golden.test.ts, test/fixtures/emitters-golden/)
- [ ] [T053] [US4] Rewrite or move the Antigravity-specific tests: generic behaviour uses the fixture plugin, format tests move to the plugin repo (test/antigravity-migration-018.test.ts, test/antigravity-shared-018.test.ts, test/antigravity-skills-018.test.ts, test/core/antigravity-identity-018.test.ts, test/mcp-emit-antigravity.test.ts, test/legacy.test.ts, test/emit-collision.test.ts, test/emit-mcp.test.ts, test/m3-emitters.test.ts, test/worker-emit.test.ts, test/ui/dashboard-agents.test.ts)
- [ ] [T054] [US4] The doc-sync check and the registry test agree on the built-in list — 036:FR-011 (scripts/check-docs-sync.mjs, test/check-docs-sync.test.ts)
- **Verify:** `npx vitest run test/plugins test/check-docs-sync.test.ts test/emitters-golden.test.ts` pass and `ambykit trace 036` lists 12 of 12 requirements covered.
- **Checkpoint:** US-4 done; core and docs match the split.

## Phase 7 — Polish and integration

- [ ] [T080] INTEGRATION STEP (once per batch, after merges, not in a lane branch): re-record the emitter goldens with `UPDATE_GOLDEN=1 npx vitest run test/emitters-golden.test.ts` (test/fixtures/emitters-golden/)
- [ ] [T081] INTEGRATION STEP (once per batch, after merges): run `ambykit sync` twice; the second run is a no-op (.claude/, .agents/, .github/)
- [ ] [T082] Full gate: `npm run typecheck`, `npm test`, `node scripts/check-docs-sync.mjs`, `ambykit trace 036` (test/check-docs-sync.test.ts)
- [ ] [T094] **Person task:** confirm the assumed defaults C-2 (`pi` stays with `codex`), C-3 (one package per target, sibling repo) and C-4 (only Antigravity gates 2.0); record the answers in `spec.md` (specs/036-core-and-plugin-targets/spec.md)
- **Verify:** `npm run typecheck` and `npm test` pass and `node dist/cli/index.js trace 036` shows every FR covered. ? unverified: T094 is a person task.
- **Checkpoint:** feature complete except the person gates above.
