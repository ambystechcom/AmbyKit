---
feature: 027-plugin-api
status: draft
created: 2026-11-16
---

# Implementation Plan — Plugin API for emitters and extensions

> The HOW. First artifact where technology appears. Must satisfy every `FR-###` in `@spec.md` and
> honor the `@../../.amby/constitution.md`. Reference spec/UI by ID — do not restate them.
> No UI: `/amby.design` skipped. Role: Architect (`@.amby/roles/architect.md`).

## Technical context

- **Stack:** TypeScript, ESM, NodeNext, Node ≥ 20 (unchanged; the 22 bump is spec 030). Vitest for tests.
- **Key libraries:** none added. `zod` (already used by `src/core/config.ts`) validates the new config
  key. Node built-ins only: `node:fs`, `node:path`, `node:url` (`pathToFileURL`) and dynamic `import()`.
- **What exists and is reused** (verified in the worktree, not assumed):
  - `src/emitters/base-emitter.ts` — `BaseEmitter` with the `emit` template method and the protected
    hooks plugins override (`commandFrontmatter`, `commandFileName`, `commandFilePath`, `renderCommand`,
    `transformBody`, `generatedNotice`, `roleFiles`, `rulesFiles`).
  - `src/emitters/skills-emitter.ts` — `SkillsEmitter` plus the helpers `skillName`, `skillPath`,
    `skillFrontmatter`.
  - `src/emitters/toml-command-emitter.ts` — `TomlCommandEmitter` plus `tomlBasic`, `tomlPrompt`.
  - `src/emitters/index.ts` — `TARGETS: TargetDef[]` (module-level, synchronous), `getTarget`,
    `emittersForTargets`, `sharedOutputs`. These are the three functions every caller uses.
  - `src/core/emit.ts` — `buildEmittedFiles(root, config)`; already throws on conflicting output paths.
  - `src/cli/io/fsops.ts` — `applyFiles` already skips `scope: "user"` files unless `--include-user`.
  - `src/core/config.ts` — zod `configSchema`; `.amby/config.json`.
- **Constraints driving choices:**
  - Principle 1/2: plugins subclass the existing emitters; no new emit orchestration.
  - Principle 3: loading is on demand — nothing is imported when `plugins` is absent (FR-016, SC-003).
  - Principle 4: contract kit checks a plugin against a *row*; no row means failure.
  - Principle 5: every FR gets a test; the plugin loader and kit are pure/injectable so they are testable.
  - Principle 6: the repo's own `sync --check` must stay clean; no template change is made.
  - Principle 7: no auto-discovery, exact version pins, no writes outside the project without consent.
  - 1.x additive: `loadConfig` must accept configs with no `plugins` key and old `ambykit` versions
    must ignore the key (it is `optional()`).

## Architecture

A new **pure-ish** module `src/plugins/` sits between config and the emitter registry. Side effects
(filesystem reads, dynamic `import`) are confined to `loader.ts`; the rest are pure functions.

```
.amby/config.json  plugins: { "ambykit-emitter-foo": "1.2.3" }
        │
        ▼
 loader.ts  (async, edge)            for each listed package:
   resolve <root>/node_modules/<pkg> ─ manifest.ts: name pattern, installed version == pin,
   import() ─ validate shape            declared plugin-API range (semver.ts) vs PLUGIN_API_VERSION
        │  PluginLoadResult { loaded[], failures[] }
        ▼
 registry.ts (pure)  built-in TARGETS + plugin targets → TargetRegistry
   collisions (id vs built-in, id vs plugin) reported; neither overrides
        │
        ▼
 emit.ts  buildEmittedFiles(root, config, registry)   path guard on every file, then the existing
                                                      collision handling names the owning plugin
 sync.ts / check.ts / add.ts   use the registry instead of the module-level TARGETS
```

### Contracts

**Config** (additive, optional): `"plugins": { "<package name>": "<exact version>" }`. The key is the
package name; the value must be an exact `x.y.z` (no range, no tag). Package name rule: its last path
segment starts with `ambykit-emitter-` (so `ambykit-emitter-foo` and `@acme/ambykit-emitter-foo` pass).

**Plugin package metadata** (`package.json` of the plugin): `"ambykit": { "pluginApi": "^1" }`. The
loader refuses a plugin when the range does not contain `PLUGIN_API_VERSION` and prints the expected
range and the version found (FR-010). The plugin lists `@ambystech/ambykit` as a peer dependency.

**Plugin module** (default export of the package entry, ESM): either an object or a factory.

```ts
type PluginModule = { targets: TargetDef[] };                    // TargetDef is the existing type
type PluginFactory = (api: PluginApi) => PluginModule;           // api = { BaseEmitter, SkillsEmitter, TomlCommandEmitter, helpers }
```

The factory form exists because a plugin installed next to a *different copy* of AmbyKit (global or
`npx` use) would otherwise subclass a foreign `BaseEmitter`. The loader therefore validates by shape
(`toolId`, `displayName`, `commandSurface`, `commandDir`, an `emit` function), never `instanceof`.

**Extension points exported for plugins** (from `@ambystech/ambykit/plugin`, re-exported from the
root entry): `BaseEmitter`, `SkillsEmitter`, `TomlCommandEmitter`, the helpers `skillName`,
`skillPath`, `skillFrontmatter`, `tomlBasic`, `tomlPrompt`, the types `CommandSpec`, `EmittedFile`,
`RulesContext`, `Role`, `TargetDef`, and the constants `PLUGIN_API_VERSION`, `PLUGIN_API_EXPERIMENTAL`.

**Test kit** (`@ambystech/ambykit/testkit`): `checkEmitterContract(target, row): ContractFailure[]`
and `assertEmitterContract(target, row)` (throws one error listing every difference, so it works under
any test runner). A **matrix row** is data, not prose:

```ts
interface MatrixRow {
  target: string; commandSurface: CommandSurface; commandDir: string;
  fileTemplate: string;            // e.g. "amby.<phase>.md" or "<phase>/SKILL.md"
  frontmatterKeys: string[];       // exact, ordered keys the host documents
  sourceUrl: string;               // where the row was verified (Principle 4)
}
```

The kit runs `target.emitter.emit(loadCommandSpecs(), ctx)`, then compares emitted paths and the
leading frontmatter (YAML `key:` lines or TOML `key =` lines) with the row. Rules-only targets
(`commandSurface: "none"`) are checked for emitting no command files.

### Boundaries and side effects

- Pure: `semver.ts`, `manifest.ts` (given file text), `registry.ts`, `moved-targets.ts`,
  `testkit/contract.ts`, the path guard.
- Edge: `loader.ts` (reads `package.json`, dynamic `import`), `sync.ts`/`check.ts`/`add.ts` (print).
- Resolution is **only** `<project root>/node_modules/<package>`. No walking up parents, no global
  lookup (spec edge case), so a plugin on one machine and not another fails loudly rather than loading
  something unexpected.

### Cost (Principle 3)

No plugins listed → no new imports, no new fs reads beyond one `plugins` key check; `sync` output is
byte-identical (FR-016). With plugins: one `package.json` read and one dynamic import per package.

## Phased approach

- **Phase 0 — Research:** done in this plan, no `research.md`. Settled: resolution scope, dual-copy risk
  (shape validation + factory form), semver grammar (in-house, see Open decisions), consent mechanism.
- **Phase 1 — Setup:** config key, test fixture plugin, package subpath exports.
- **Phase 2 — Foundational (gate):** semver check, plugin API surface, manifest reader, registry,
  loader, registry-aware `getTarget`/`emittersForTargets`/`sharedOutputs`, path guard in `emit.ts`.
- **Phase 3+ — Stories in priority/dependency order:** US-1 (write), US-2 (load at sync), US-3 (test
  kit), US-4 (versioned API), US-7 (trust), US-8 (no regression), then US-5 (lean core, P2).
  **US-6 is out of scope for 1.6** (spec says it ships in a later 1.x); no task is planned for it.
  FR-015 and US-6 are explicitly DEFERRED to a later 1.x release (marked in the spec).
- **Build order:** 027 builds AFTER 025: rebase on 025 and merge the `sync` output message by hand. Shared changes: src/core/emit.ts
  (025 T062 vs T021), src/core/types.ts (025 T061 vs T001), src/emitters/base-emitter.ts, src/cli/sync.ts (025 T069 vs
  T040/T091). T080's 'goldens unchanged' check stays a batch step run after merging.
- **Shared hotspot files:** rebase and merge by hand, different lines only (src/cli/index.ts, src/core/config.ts,
  src/core/types.ts, docs/cli-reference.md, CHANGELOG, docs/workflow.md, docs/tool-compatibility.md, README.md).
- **Phase last — Polish:** docs and release notes.

## Requirement mapping

| Requirement | How it's satisfied |
|---|---|
| FR-001 | `src/plugins/index.ts` re-exports `BaseEmitter`, `SkillsEmitter`, `TomlCommandEmitter` and helpers; test subclasses each (T032). |
| FR-002 | `docs/plugin-api.md` with every extension point/option/guarantee and a worked example plugin under `examples/` (T030, T031). |
| FR-003 | `loader.ts` + `registry.ts` + `sync.ts`; target emitted like a built-in (T017, T040, T043). |
| FR-004 | Loader returns structured `failures[]`; `sync` prints package + reason and still syncs the rest (T017, T040). |
| FR-005 | `registry.ts` rejects a plugin target whose id equals a built-in or earlier plugin target; reports both owners (T015, T016). |
| FR-006 | Loader reads only listed packages with an exact pin; no discovery; no sandbox, stated in `docs/plugin-trust.md` (T017, T050, T052). |
| FR-007 | Path guard in `emit.ts` rejects project-scope paths escaping the root; `scope:"user"` files need the existing `--include-user` and are excluded from `--check` (T021, T022, T051). |
| FR-008 | `sync` prints `name@version` for each loaded plugin on every run (T040). |
| FR-009 | `src/testkit/` `checkEmitterContract`, fails when the row is missing (T070–T072). |
| FR-010 | `manifest.ts` + `semver.ts`; refusal message names expected range and found version (T010, T013, T060). |
| FR-011 | `PLUGIN_API_EXPERIMENTAL = true`; load prints an experimental note; docs label it (T012, T040, T031). |
| FR-012 | `CHANGELOG.md` convention `[plugin-api]` tag plus a release-checklist line (T061, T062). |
| FR-013 | `docs/plugin-split.md` records built-in vs plugin with evidence columns, reviewed at the 2.0 gate (T092). |
| FR-014 | `moved-targets.ts` map id → package; `sync` prints which to install and removes nothing (T090, T091). |
| FR-015 | Out of scope for 1.6 (spec US-6). Not planned. |
| FR-016 | No `plugins` key → loader never runs; regression test over golden outputs (T080). |
| FR-017 | Second `sync` over the same plugins is a no-op, asserted in the e2e (T043). |
| US-1 … US-4, US-7, US-8 | Phases 3–8 below. US-5 → Phase 9. US-6 → later 1.x. |

## Risks & decisions

- **Dual copy of AmbyKit** (plugin imports a different install than the running CLI) breaks
  `instanceof`. Mitigation: shape validation and the factory form; documented in `plugin-api.md`.
- **Experimental API frozen too early** would lock the 1.x spec shape (spec intro). Mitigation: label
  experimental, version it `1.0.0`, and keep `MatrixRow`/`PluginApi` small; the freeze is a 2.0 task.
- **Third-party code runs at sync with the user's permissions.** Mitigation per US-7: exact pin, explicit
  listing, installed-version equality, printed name and version. No sandbox is claimed.
- **Plugin output colliding with a built-in file path** is already fatal in `emit.ts`; the error is
  extended to name the plugin so the cause is findable.
- `agents.ts` (dashboard agent detection) reads built-in ids only; plugin targets are not detected as
  agents in 1.6. Noted, not fixed here.

## Open decisions

Defaults were chosen so tasks are not blocked; each is cheap to reverse.

1. **Semver grammar:** in-house `semver.ts` supporting exact, `^`, `~`, `>=`, `<`, space-joined AND and
   `||`; anything else refuses the plugin with a clear message. *Alternative:* add the `semver`
   package (one more runtime dependency). Default: in-house.
2. **API version number:** `1.0.0` with an `experimental` flag, matching the spec's `^1` example.
   *Alternative:* `0.x`, where `^0.1` pins a minor and fits "may change in minor releases". Default: `1.0.0`.
3. **Which targets are "built in":** the spec names families (Claude, Copilot, Cursor, OpenCode, Codex,
   Antigravity). Default: sibling targets of a built-in family stay built in (`claude-vscode`,
   `copilot-cli`, `cursor-cli`, `antigravity-cli`, `pi`); the plugin candidates are `gemini`, `llxprt`,
   `qwen`, `kilo`, `augment`, `windsurf`, `kiro`. **No target is removed from the core in 1.6**: this
   feature ships the mechanism, the moved-target notice and the recorded split; the first extraction is a
   follow-up after the API is dogfooded.
4. **Out-of-tree consent (FR-007):** the spec does not define the consent mechanism. Default: reuse the
   existing `--include-user` flag for `scope:"user"` files; a project-scope path that escapes the root
   is always refused (no consent path in 1.6).
5. **Exit code when a plugin fails to load or collides:** other targets still sync (FR-004); `sync`
   then exits **1** so CI notices. *Alternative:* exit 0 with a warning.
6. **Hoisted installs (monorepos):** only `<root>/node_modules` is searched. A plugin hoisted to a parent
   `node_modules` is not found. Revisit with spec 031-era monorepo work.
7. **Scoped package names:** accepted when the last segment starts with `ambykit-emitter-`; the config
   key is the full scoped name.
8. **Row source for official plugins:** each plugin ships its row as `matrix-row.json` in its own repo
   (spec edge case); AmbyKit's `docs/tool-compatibility.md` gets a human-readable summary only.
