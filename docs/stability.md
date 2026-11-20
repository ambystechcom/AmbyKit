# Stability

What AmbyKit promises not to break, and how it changes what it promises. This page is the **contract** for two surfaces: the
`ambykit run` command and the plugin API (with its contract test kit). It is read by a test
(`test/stability-contract.test.ts`): every item in a `contract` block below is checked against the code, so this page and the
code cannot drift apart. A promise without a check is not a promise.

## What "stable" promises

Stable means a person can build on a surface and expect it to keep working across the minor releases of a major version.
A breaking change to anything listed on this page is held for the next major release (see
[Changing what is stable](#changing-what-is-stable)).

Two surfaces are covered, each listed in its own section below:

- **`run`:** the `ambykit run` command: its flags, its exit codes, the structure of the lines it prints, the layout of the
  fleet state files and the directive protocol.
- **The plugin API:** the names a plugin imports from `@ambystech/ambykit/plugin`, the shape of a plugin's descriptor, the rules
  the loader applies, and the contract test kit published as `@ambystech/ambykit/testkit`.

Anything **not listed** on this page is not covered, and changing it is not a breaking change. That includes every internal
module, the wording of messages other than the lines listed, the contents of a state file beyond the fields listed, and the
loader, registry and range-check internals. If you depend on something that is not listed, open an issue so it can be listed
(and tested) or so you can be pointed at what is.

## Additions

Additions are allowed in a minor release. A new flag, a new exported name, a new field in a state file, a new line, a new
subcommand or a new target for plugins does not break what is listed, so it can ship in any minor release, and it becomes
covered only when it is added to this page (with its check). A tool that reads these surfaces must ignore what it does not know.

## Changing what is stable

Nothing listed on this page is removed or changed incompatibly without notice. The policy, in order:

1. **Deprecate in a minor release.** A stable flag, subcommand, exported name, state-file field or printed line is first
   *deprecated* in a minor release. The old name keeps working exactly as before. The replacement exists from that release on.
2. **One notice, once per run, on stderr.** Using a deprecated name prints one line that names the replacement
   (`ambykit: '<name>' is deprecated and will be removed in the next major release; use '<replacement>' instead.`), once per
   process, to the error stream. It never goes to the output stream, so `--json` output and pipes are not disturbed.
3. **Remove only in the next major release.** A deprecated name is removed no earlier than the next major version, and the
   changelog says so when it is deprecated and again when it is removed.
4. **Security exception.** A fix for a security problem may break a stable behaviour in a minor or patch release when keeping it
   would leave people exposed. The changelog must say that a stable behaviour changed, what changed and why.

Nothing is deprecated at 2.0. A name deprecated in a later 2.x release keeps working for plugins and scripts written for 2.0 until
3.0. The notice is produced by one helper (`src/core/deprecation.ts`), so every deprecation reads the same.

## The `run` surface

`ambykit run` launches a feature's prepared lanes with headless assistants, supervises them and merges the result; `ambykit run
<feature> <feature>…` does the same for several features as one fleet. Stable means these stay as listed:

- **Flags and subcommands:** each name below is accepted, with the meaning in `docs/cli-reference.md`. Nothing launches without
  `--yes`; `--emit-script` writes the commands and launches nothing.
- **Exit codes:** `0` when the command did what was asked, `1` when it could not (a missing feature, a refused runner, a failed
  or paused run). No other code is promised.
- **Printed lines:** the structure of the plan lines and the finish line, with `<…>` standing for the value. Other wording is not
  covered.
- **State files:** `.amby/fleet/<run>/` holds one run (`<feature>.<n>`): its record, its event log, its budget counters, one file
  per lane, the prompt each lane was given and one directive per lane. A fleet of several features has its own directory
  `.amby/fleet/<fleet>/` (`fleet-<n>`) with a `fleet.json` and the runs of its features. The files are readable without a model; only
  the fields listed are promised.
- **Directive protocol:** a directive is `{ "action": …, "at": … }` at `.amby/fleet/<run>/directives/<lane>.json`; `action` is one
  of `continue`, `pause` or `stop`. The last write wins and a missing file means continue; a worker obeys at its next report.

```contract
{
  "surface": "run",
  "subcommands": ["approve", "reject", "pause", "stop", "resume"],
  "flags": [
    "--all-ready", "--yes", "--emit-script", "--assistant", "--unattended", "--max-minutes", "--max-tasks", "--max-tokens",
    "--continue-run", "--continue-fleet", "--json", "--runners", "--gate", "--reason", "--reassign"
  ],
  "exitCodes": [0, 1]
}
```

```contract
{
  "surface": "run",
  "printed": [
    "Run plan for <feature> — run <run>",
    "Lanes: <n>",
    "Budgets: <n> minutes wall-clock",
    "Run <run> is done: every lane merged."
  ],
  "stateFiles": [
    ".amby/fleet/<run>/run.json",
    ".amby/fleet/<run>/events.jsonl",
    ".amby/fleet/<run>/budget.json",
    ".amby/fleet/<run>/lanes/<lane>.json",
    ".amby/fleet/<run>/prompts/<lane>.md",
    ".amby/fleet/<run>/directives/<lane>.json",
    ".amby/fleet/<fleet>/fleet.json"
  ],
  "directiveActions": ["continue", "pause", "stop"],
  "directiveFields": ["action", "at"]
}
```

`run` is **experimental** until one fleet has built two dependent features of this repository with a verified runner (see
`specs/033-stable-run-and-plugin-api/`); this list is what the stable label will promise, and a runner is runnable only where it
was verified (`ambykit run --runners`).

## The plugin API surface

A plugin is an npm package named `ambykit-emitter-<name>` that adds emitter targets. Stable means a plugin written against this API
keeps loading and passing the contract kit across the minor releases of its major version. A plugin declares the API range it
supports in its `package.json` (`"ambykit": { "pluginApi": "^2" }`), and the API version is `apiVersion` on the object a factory
receives.

- **Exported names:** what a plugin may import from `@ambystech/ambykit/plugin`, values and types. Everything else in the package
  (the loader, the registry, the range check, the emitter internals) is internal.
- **Descriptor shape:** the default export is an object, or a factory that receives the API and returns one, of the form
  `{ targets: [ { id, displayName, emitter: { toolId, displayName, commandSurface, commandDir, emit } } ] }`. The loader checks
  the shape, never `instanceof`.
- **Loading rules:** only packages listed in `.amby/config.json` are looked at; the listed version is an exact `x.y.z`; the package
  is found only under the project's own `node_modules`; its name starts with `ambykit-emitter-`; and its declared API range must
  contain the running API version. There is no sandbox: a plugin runs with your permissions (`docs/plugin-trust.md`).

```contract
{
  "surface": "plugin",
  "exports": [
    "PLUGIN_API_VERSION", "BaseEmitter", "SkillsEmitter", "TomlCommandEmitter", "skillName", "skillPath", "skillFrontmatter",
    "tomlBasic", "tomlPrompt", "MCP_SERVER_NAME", "MCP_COMMAND"
  ],
  "exportTypes": [
    "TargetDef", "CommandSpec", "CommandSurface", "EmittedFile", "RulesContext", "Role", "PluginModule", "PluginFactory", "PluginApi"
  ],
  "descriptor": [
    "targets", "targets[].id", "targets[].displayName", "targets[].emitter", "targets[].emitter.toolId",
    "targets[].emitter.displayName", "targets[].emitter.commandSurface", "targets[].emitter.commandDir", "targets[].emitter.emit"
  ],
  "loadingRules": ["exact-pin", "project-node-modules", "package-name", "api-range"]
}
```

## The contract test kit

`@ambystech/ambykit/testkit` checks that an emitter writes what its host's documentation says: the command paths and the leading
frontmatter keys, against a matrix row the plugin author records from the host's own docs. With no row the check fails. Stable
means these names and their behaviour; the kit checks only the surface listed here and nothing outside it.

```contract
{
  "surface": "kit",
  "exports": ["assertEmitterContract", "checkEmitterContract", "frontmatterKeys", "createPluginApi"],
  "exportTypes": ["ContractFailure", "MatrixRow", "PluginApi"]
}
```
