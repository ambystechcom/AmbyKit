---
feature: 036-core-and-plugin-targets
created: 2026-11-20
---

# Research — Core targets and official plugin targets

> Phase 1 (T001, T003). Everything here was verified by reading the code at 1.6.0 + 030/031/032 on 2026-11-20.
> The plan's "coupling points" list was a prediction; this is what the code says.

## T001 — Coupling points

| Where | What it holds | Verdict |
|---|---|---|
| `src/core/emit.ts` | `SELF_REPORT_PRIORITY = ["codex", "antigravity", "antigravity-cli"]` (strings compared with an emitter's `toolId`); `label()` already names a plugin's emitter | **Stays.** Compares ids, so a plugin whose emitters keep the tool ids `antigravity` and `antigravity-cli` ranks the same. |
| `src/core/agents.ts` | `AGENTS` has `antigravity` and `antigravity-cli` (family `antigravity`) for detecting running processes | **Stays.** It identifies processes for the dashboard, not emission. |
| `src/core/subagents.ts` | `SUBAGENT_SUPPORT` has both ids (`unconfirmed`, no agent file); `BaseEmitter` asks `supportsSubagents(this.toolId)` | **Stays until Phase 5.** The lookup is by `toolId`, so a plugin that keeps the ids gets the same answer. |
| `src/core/legacy.ts` | `legacyWorkflowFiles` looked the target up with `getTarget(id)` and **no registry** | **Fixed in this phase (T012).** It takes the registry now; `sync` and `check` pass it. |
| `src/cli/init.ts` | `getTarget(t)` and `TARGETS` for validating and listing tools, and `buildEmittedFiles(target, config)` | **Registry-blind on purpose.** `init` runs before a project can list any plugin. FR-010 (Phase 4) lists moved targets there as "official plugin, install first". |
| `src/cli/add.ts`, `check.ts`, `sync.ts`, `update.ts`, `core/emit.ts` | take the registry | Already registry-aware. |
| `src/cli/ui/dashboard/live-tokens.ts` | icons and colours for the antigravity agent badge | **Stays.** Presence display, unrelated to emission. |
| `src/core/rules.ts` | a comment | Nothing to do. |

`sharedOutputs(ids, source)` and `emittersForTargets(ids, source)` (in `src/emitters/index.ts`) already take the registry, so the
co-owned `.agents/skills` directory is seen for a plugin target (risk R3 is covered by a registry-aware lookup; the Phase 3 test proves it).

**Tests that mention Antigravity: 16 files, not the 12 the plan predicted.** `test/antigravity-migration-018.test.ts`,
`antigravity-shared-018.test.ts`, `antigravity-skills-018.test.ts`, `core/antigravity-identity-018.test.ts`, `legacy.test.ts`,
`emit-collision.test.ts`, `emit-mcp.test.ts`, `mcp-emit-antigravity.test.ts`, `m3-emitters.test.ts`, `worker-emit.test.ts`,
`emitters-golden.test.ts`, `ui/dashboard-agents.test.ts`, and four the plan missed: `converge-emit.test.ts`, `decide-emit.test.ts`,
`review-emit.test.ts`, `roles-emit.test.ts`. Phase 5's rewrite-or-move task (T053) covers 16.

## T003 — Plugin API gaps for the Antigravity plugin (the hand-off to 033)

The two Antigravity emitters are small, and `antigravity-cli.ts` is the only one that touches anything the API does not give.

| Needed | In 1.6 | Action |
|---|---|---|
| `MCP_COMMAND` (how a host starts the server) | in `src/emitters/base-emitter.ts`, **not exported to plugins** | **Added** to `PluginApi`, `createPluginApi()` and `@ambystech/ambykit/plugin`. |
| `MCP_SERVER_NAME` (`ambykit`) | same | **Added** with it, for the same reason (the inherited `mcpFile()` keys on it). |
| `EmittedFile`, `RulesContext` types | already exported, as types, from `@ambystech/ambykit/plugin` | **Nothing to add.** The plan (R1) said they were missing from `PluginApi`; a type cannot sit on a value object and a JavaScript plugin needs none. A TypeScript plugin imports them from the barrel. |
| `mcpFile()`, `mcpFiles()`, `mcpSkipReason()` | members of `BaseEmitter` (the first is `protected`) | **Nothing to add.** A subclass inherits them. |
| `SkillsEmitter` and the skills helpers | in the API | Nothing to add. |
| posix `join` | `node:path/posix` | Node built-in; the plugin imports it itself. |

Both additions are **additive**: nothing in the 027 API changed, existing plugins are unaffected, and `PLUGIN_API_VERSION` stays
`1.0.0` for now (decision: not bumped here, because 033 T040 moves it to `2.0.0` and a `1.1.0` in between would only churn the
pinned messages in the 027 tests). **Consequence for 036:** the official Antigravity plugin uses `api.MCP_COMMAND`, so it must declare
`"ambykit": { "pluginApi": "^2" }` and will be refused, with the usual range message, by a core that predates the addition.

### What 033 T040 still must do

- Freeze the API **with these two included**: list `MCP_SERVER_NAME` and `MCP_COMMAND` in the plugin `contract` block of
  `docs/stability.md` (033 T021) and in the contract kit's listed exports (033 T042).
- Set `PLUGIN_API_VERSION = "2.0.0"`; remove `PLUGIN_API_EXPERIMENTAL` and the "experimental" wording.
- Make sure the hint for an internal name (033 T041) does not fire for `MCP_COMMAND` / `MCP_SERVER_NAME`.
- Keep `test/fixtures/plugins/ambykit-emitter-skills-target` (T002 here) as the loader's "stable API" fixture; it already uses the
  new values.

## T002 — Fixture plugin

`test/fixtures/plugins/ambykit-emitter-skills-target/` (↪ the task names the folder `skills-target`; the loader requires the package
name `ambykit-emitter-*`, and the test helper installs a fixture by that name). Two targets, `skills-target` and `skills-target-cli`,
on `api.SkillsEmitter` writing `.agents/skills/<phase>/SKILL.md`, the CLI one adding `.agents/mcp_config.json` through
`api.MCP_COMMAND`. `test/plugins/api-mcp.test.ts` shows its paths and MCP file are byte-identical to the built-in Antigravity
emitters', which is what the Phase 3 tests build on.

## T035 — Install test on a project synced by 1.6 (2026-11-25, accepted by the owner)

- Project: a new git repository with `npm install -D @ambystech/ambykit@1.6.0` and `ambykit init . --tools=claude,antigravity,antigravity-cli`,
  committed as the 1.6 state. Then the core from branch `036-split-core` (packed tarball, built-in Antigravity emitters removed,
  `SPLIT_ACTIVE` true) was installed over it.
- Without the plugin: `ambykit sync` refuses `antigravity` and `antigravity-cli` with the install line
  (`npm install --save-exact @ambystech/ambykit-emitter-antigravity`, list it under `plugins`) and leaves their files in place.
- With the plugin: `npm install --save-exact @ambystech/ambykit-emitter-antigravity` (1.0.1, from npm) and
  `"plugins": { "@ambystech/ambykit-emitter-antigravity": "1.0.1" }` in `.amby/config.json`. `ambykit check` lists the plugin and
  reports `.agents/skills/` owned by both targets; `ambykit sync` succeeds.
- Diff against the 1.6 state: 6 skills changed (`amby-converge`, `-implement`, `-revise`, `-run`, `-specify`, `-tasks`). These are the
  prompts that 030 rewrote for 2.0; the same six Claude commands changed too, so the difference is prompt text, not the plugin.
- Plugin against built-in: the same 1.6 project synced with `main`'s core (built-in Antigravity emitters, same prompts) gives
  `.agents/` and `AGENTS.md` identical to the plugin's output (compared ignoring line endings). SC-001 holds: the plugin writes
  what the built-in emitters wrote.
