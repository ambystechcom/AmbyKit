# Plugin API

> **Stable from 2.0.** What [`stability.md`](./stability.md) lists does not change incompatibly within 2.x; additions are
> allowed in a minor release. Plugins say which API range they support, and AmbyKit refuses a plugin outside it. Read
> [`plugin-trust.md`](./plugin-trust.md) before you install one: a plugin is code that runs on your
> machine. Maintainers releasing an official plugin: [`plugins-release.md`](./plugins-release.md).

A plugin adds **emitter targets**: a new assistant that `ambykit sync` writes native command files for.
Roles, phases and templates are not extensible yet (they ship in a later 1.x release).

## What a plugin is

An npm package named `ambykit-emitter-<name>` (a scope is fine: `@acme/ambykit-emitter-foo`) whose
default export is a **factory**:

```js
export default function (api) {
  class MyEmitter extends api.BaseEmitter {
    toolId = "mytool";
    displayName = "My tool";
    commandSurface = "commands";
    commandDir = ".mytool/commands";
    commandFrontmatter(spec) {
      return [["description", this.yamlQuote(spec.description)]];
    }
  }
  return { targets: [{ id: "mytool", displayName: "My tool", emitter: new MyEmitter() }] };
}
```

The factory receives the **extension points** (below), so your classes always extend the running copy of
AmbyKit, never a second install next to your package. A plain object `{ targets: [...] }` is also
accepted; it cannot subclass anything, so it is only useful for an emitter written from scratch. A
working example with all three extension points is in
[`examples/ambykit-emitter-example/`](../examples/ambykit-emitter-example/).

`package.json` must carry the range of plugin API versions the plugin supports:

```json
{ "name": "ambykit-emitter-mytool", "version": "1.0.0", "type": "module",
  "ambykit": { "pluginApi": "^2" },
  "peerDependencies": { "@ambystech/ambykit": ">=2.0.0" } }
```

The current API version is `2.0.0` (`PLUGIN_API_VERSION`). A plugin whose range contains neither it nor the 1.x API is
refused, and the message names the range it asked for and the version found. **A plugin written for the 1.x API (`^1`)
still loads**: 2.0 keeps everything 1.0 had and only adds, so `sync` prints a one-line note that the plugin declares
the 1.x API; declare `^2` once you have tested it. A 1.x plugin that imported a name the API does not export is refused with
the name it relied on (and, if the factory's `api` argument provides it, where to get it). Ranges may use an exact
version, `^`, `~`, `>=`, `>`, `<=`, `<`, spaces (AND) and `||` (OR); anything else is refused.

## Extension points

Import from `@ambystech/ambykit/plugin`, or take them from the factory's `api` argument.

- `BaseEmitter` — the shared emit logic. Set `toolId`, `displayName`, `commandSurface`, `commandDir`
  and override only what differs: `commandFrontmatter`, `commandFileName`, `commandFilePath`,
  `renderCommand`, `transformBody`, `generatedNotice`, `rulesFiles`, `roleFiles`.
- `SkillsEmitter` — for hosts whose commands are skills: one `<commandDir>/<name>/SKILL.md` per phase
  with `name` and `description`.
- `TomlCommandEmitter` — for hosts whose commands are TOML: `description` and a multi-line `prompt`.
- `skillName`, `skillPath`, `skillFrontmatter` — the skills helpers, for an emitter that cannot extend
  `SkillsEmitter`.
- `tomlBasic`, `tomlPrompt` — TOML string helpers.
- `MCP_SERVER_NAME`, `MCP_COMMAND` — the name AmbyKit's MCP server is registered under and how a host starts it, for an
  emitter that writes a project MCP file through the inherited `mcpFile()` helper (override `mcpFiles()`; return `null`
  from `mcpSkipReason()`).
- `PLUGIN_API_VERSION` — the API version.

Types: `TargetDef`, `CommandSpec`, `CommandSurface`, `EmittedFile`, `RulesContext`, `Role`,
`PluginModule`, `PluginFactory`, `PluginApi`.

## Options and guarantees

- **A target** is `{ id, displayName, emitter }`. `id` is what a person writes in `tools`. It must not
  equal a built-in target's id or another plugin's; if it does, the plugin target is reported and **not
  registered** (nothing is overridden).
- **Shape, not class.** AmbyKit checks an emitter has `toolId`, `displayName`, `commandSurface`
  (`commands`, `skills`, `workflows` or `none`), `commandDir` and an `emit` function. It never uses
  `instanceof`.
- **Files stay in the project.** Every `scope: "project"` file path must be relative and stay inside the
  project root (no absolute path, no drive letter, no `..`); otherwise the whole sync fails and names the
  plugin. A `scope: "user"` file (under the home directory) is written only with
  `ambykit sync --include-user` and is never part of `sync --check`.
- **Deterministic output.** A second `sync` over the same plugins writes nothing. Do not put timestamps
  or random values in emitted files.
- **Output collisions.** Two targets writing one path must write identical bytes, or the sync fails
  naming both owners (and their plugins).
- **Failures are isolated.** A plugin that is missing, mis-pinned, out of range, malformed or throws on
  load is reported with a reason; the other targets still sync, and `sync` exits 1.
- **What AmbyKit prints.** On every `sync`, each loaded plugin as `name@version`, plus a note under a plugin that
  loaded through 1.x compatibility.

## Using a plugin

1. `npm install --save-exact ambykit-emitter-mytool` in the project (it must be in the project's own
   `node_modules`: nothing is searched in parent folders or globally).
2. List it with the **exact** installed version in `.amby/config.json`, and add its target:

   ```json
   { "tools": ["claude", "mytool"], "plugins": { "ambykit-emitter-mytool": "1.0.0" } }
   ```

3. `ambykit sync`.

An unlisted package is never loaded, and a version that differs from the pin is refused.

## Testing a plugin

`@ambystech/ambykit/testkit` checks an emitter against a **matrix row** (the host's documented paths and
frontmatter keys). See [`tool-compatibility.md`](./tool-compatibility.md#matrix-rows-for-plugins).

```js
import { readFileSync } from "node:fs";
import { assertEmitterContract, createPluginApi } from "@ambystech/ambykit/testkit";
import factory from "./index.js";

const rows = JSON.parse(readFileSync(new URL("./matrix-rows.json", import.meta.url), "utf8"));
const { targets } = factory(createPluginApi());
for (const target of targets) assertEmitterContract(target, rows.find((r) => r.target === target.id));
```

`assertEmitterContract(target, row)` (a row is a plain object, see below) throws one error listing every difference, so it works under any
test runner; `checkEmitterContract` returns them as a list. With no row, the check fails: a plugin
without a documented row for its host cannot pass.

## Stability

- 1.x: experimental.
- 2.0: stable. [`stability.md`](./stability.md) lists what is promised and how a stable name is deprecated and removed.
  `[plugin-api]` entries in `CHANGELOG.md` say whether a release affects plugins; a change that would break a listed name is
  held for the next major plugin API version (3.0).
