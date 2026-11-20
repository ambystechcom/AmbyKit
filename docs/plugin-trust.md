# Plugin trust

> The plugin API is **stable from 2.0** (see [`plugin-api.md`](./plugin-api.md) and [`stability.md`](./stability.md)), but
> stable is not safe. **There is no sandbox.** A plugin is JavaScript that runs inside `ambykit sync` with your permissions. Install one
> only if you would run its author's code.

## What AmbyKit does to keep this safe

- **Nothing is discovered.** A package loads only when it is named in `.amby/config.json` under
  `plugins`. Installing one does not enable it, and a package that happens to be in `node_modules` is
  never imported.
- **Exact pins.** Each entry is `"package name": "x.y.z"`. A range, a tag, an empty value or anything
  that is not an exact version is refused before any file of the package is read.
- **Installed version = pin.** If `node_modules/<package>/package.json` is not exactly the pinned
  version, the plugin is refused. Upgrading is a deliberate edit to the pin, reviewed like any change.
- **One place to look.** Only `<project>/node_modules/<package>` is searched. A copy in a parent folder,
  a global install or `NODE_PATH` is ignored, so the same config loads the same code on every machine
  or fails loudly.
- **Named.** Every `sync` and `check` prints each loaded plugin as `name@version`.
- **Names are constrained.** Only packages named `ambykit-emitter-*` (optionally scoped) are accepted.
- **Failures are contained.** A plugin that is missing, out of range, malformed or throws on load is
  reported by name; the other targets still sync, and the run exits 1 so CI notices.

## What a plugin can and cannot do

A plugin **can** run any code Node can run (read and write files, use the network, spawn processes) at
the moment it is loaded and while it emits. Nothing prevents that.

AmbyKit **does** limit what it will *write on a plugin's behalf*:

- Files a plugin asks AmbyKit to write must be **inside the project**. A path that is absolute, has a
  drive letter or contains `..` fails the whole sync and names the plugin.
- A file in the **home directory** (`scope: "user"`) is written only when you run
  `ambykit sync --include-user`. That flag is the recorded consent, it is per run, and those files are
  never part of `sync --check`.
- A plugin cannot replace a built-in target or another plugin's target: a clash is reported and the
  later target is not registered.
- Two targets writing the same path must write identical bytes, or the sync fails naming both plugins.

## Before you install a plugin

1. Read its source or trust its maintainers; check the repository and the published tarball.
2. Install with `npm install --save-exact` so the version in `package.json` is the one you pin.
3. Copy that exact version into `plugins` in `.amby/config.json`.
4. Re-read the diff when you change the pin.

## Reporting a problem

A plugin that writes where it should not, or runs code you did not expect, is a bug in the plugin;
report it to its author. If AmbyKit loads something that is not listed and exactly pinned, that is a bug
in AmbyKit; please open an issue.
