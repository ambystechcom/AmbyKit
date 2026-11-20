# Releasing an official plugin

> For maintainers. Official plugins (the targets that moved out of the core, spec 036) live **in this repository**, one
> directory each under `plugins/`, and are published to npm by **one** workflow, `.github/workflows/publish-plugins.yml`.
> The core package has its own workflow (`publish.yml`), which ignores plugin tags.

## Layout

```
plugins/<name>/
  package.json     name @ambystech/ambykit-emitter-<name>, its own version, "ambykit": { "pluginApi": "^2" }
  tsconfig.json    builds src/ to dist/
  src/index.ts     default-export factory(api); only `import type` from "@ambystech/ambykit/plugin"
  test/*.test.ts   run by the root vitest, with the contract kit from "@ambystech/ambykit/testkit"
  CHANGELOG.md
```

- **No npm workspaces.** A plugin gets everything through the `api` its factory receives (see [`plugin-api.md`](./plugin-api.md)),
  so it has no runtime dependency. TypeScript and vitest come from the repository root.
- **Independent versions.** Releasing one plugin never releases another, or the core.
- The core package ships an allowlist (`files` in the root `package.json`), so `plugins/` is never part of it.
- Tests import `@ambystech/ambykit/plugin` and `@ambystech/ambykit/testkit`; `vitest.config.ts` resolves those names to this
  checkout's `src/`, so a plugin's tests always run against the core of the same commit and need no build.

`package.json` must also carry what npm provenance checks:

```json
{
  "name": "@ambystech/ambykit-emitter-antigravity",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "files": ["dist", "README.md", "LICENSE"],
  "ambykit": { "pluginApi": "^2" },
  "repository": { "type": "git", "url": "git+https://github.com/ambystechcom/AmbyKit.git", "directory": "plugins/antigravity" }
}
```

## Release tag

A release is a **GitHub Release** whose tag is

```
plugin/<name>/v<x.y.z>        for example  plugin/antigravity/v1.0.1
```

The tag names one directory under `plugins/` (lowercase letters, digits and dashes; anything else, including a path, is refused)
and its version must equal that package's `version`. The core's tags (`v1.6.0`) are not plugin tags.

## What the workflow does

Triggered by the Release being published, or by hand (**Actions, Publish plugin to npm, Run workflow**, with the plugin name).
It runs on Linux with Node 22, in the `Prod` environment, and stops at the first failing step:

1. `npm ci`, `npm run typecheck`, `npm run build` (the core of this commit).
2. `node scripts/plugin-release.mjs verify <tag or name>`: the tag parses, the version matches, the package name is
   `@ambystech/ambykit-emitter-<name>`, the `pluginApi` range includes the current plugin API (`PLUGIN_API_VERSION`), the package is
   not private and has no `workspaces`, and `repository` points at this repository and the plugin's directory.
3. `npm run build:plugins`, then the plugin's tests (`npx vitest run plugins/<name>/`, so a plugin needs at least one test).
4. `npm pack --dry-run`, so the file list is in the log.
5. If that exact version is already on npm, it skips the publish (a manual run followed by the Release publishes once).
6. `npm publish --access public` from `plugins/<name>/`, using Trusted Publishing (OIDC). Provenance is automatic.

## The first publish of a new plugin is manual

npm only lets you configure a trusted publisher for a package that **already exists**; there is no "pending publisher".
So for each new plugin, once:

1. From your machine, in `plugins/<name>/`: `npm run build:plugins` at the root, then `npm publish --access public` (you sign in with
   your own npm account and 2FA). Publish `1.0.0`, or the version in `package.json`.
2. On npmjs.com, open the package, then **Settings, Trusted Publisher, GitHub Actions**, and enter: this repository,
   workflow filename `publish-plugins.yml` (the file name with its extension, **case-sensitive**), environment `Prod`.
   npm does not validate the entry when you save it, so a typo shows up only when a publish fails.
3. Prove it: release the next version with a `plugin/<name>/v<x.y.z>` tag **within 2 days** (npm's limit for a new
   configuration to complete its first publish).

## Adding a plugin

1. Create `plugins/<name>/` as above; write a factory that extends `api.BaseEmitter` (or `SkillsEmitter`), declare `ambykit.pluginApi`.
2. Add tests that run the contract kit against the target's row in [`tool-compatibility.md`](./tool-compatibility.md).
3. `npm run build:plugins` and `npx vitest run plugins/<name>/` pass locally.
4. Do the manual first publish and set the trusted publisher (above).
5. Mention it in the core `CHANGELOG.md` and in `docs/plugin-split.md`.

## When something goes wrong

- **A bad version is out.** Publish a fixed version with a new tag. `npm unpublish` is only possible in the first 72 hours and for
  versions nothing depends on; prefer `npm deprecate "@ambystech/ambykit-emitter-<name>@<version>" "reason, use <fixed version>"`.
- **A plugin must stop being used.** `npm deprecate "@ambystech/ambykit-emitter-<name>" "reason"` (all versions), and say what
  replaces it in the plugin's `CHANGELOG.md`.
- **The workflow fails at "Verify".** The `::error::` lines say what to fix in `package.json` or the tag. A failure there publishes
  nothing.
- **A tag was pushed by mistake.** Delete the Release and the tag; nothing is published before the verify, test and pack steps pass.
