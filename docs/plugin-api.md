# Plugin API (experimental)

> **Experimental in 1.6.** The API may change in minor releases until it is frozen at 2.0. Plugins say
> which API range they support, and AmbyKit refuses a plugin outside it. Read
> [`plugin-trust.md`](./plugin-trust.md) before you install one: a plugin is code that runs on your
> machine.

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
  "ambykit": { "pluginApi": "^1" },
  "peerDependencies": { "@ambystech/ambykit": ">=1.6.0" } }
```

The current API version is `1.0.0` (`PLUGIN_API_VERSION`). A plugin whose range does not contain it is
refused, and the message names the range it asked for and the version found. Ranges may use an exact
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
- `PLUGIN_API_VERSION`, `PLUGIN_API_EXPERIMENTAL` — the API version and the experimental flag.

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
- **What AmbyKit prints.** On every `sync`, each loaded plugin as `name@version` and a note that the
  API is experimental.

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

const row = JSON.parse(readFileSync(new URL("./matrix-row.json", import.meta.url), "utf8"));
const { targets } = factory(createPluginApi());
assertEmitterContract(targets[0], row);   // throws, listing every difference
```

`assertEmitterContract(target, row)` throws one error listing every difference, so it works under any
test runner; `checkEmitterContract` returns them as a list. With no row, the check fails: a plugin
without a documented row for its host cannot pass.

## Stability

- 1.6: experimental; `[plugin-api]` entries in `CHANGELOG.md` say whether a release affects plugins.
- 2.0: frozen under semver. A breaking change then needs a new major plugin API version.
