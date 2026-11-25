# Releasing an official plugin

> For maintainers. Official plugins (the targets that moved out of the core, spec 036) live **in this repository**, one
> directory each under `plugins/`, and are published to npm by **one** workflow, `.github/workflows/publish-plugins.yml`.
> It runs only when something under `plugins/` changes on `main`. The core package has its own workflow (`publish.yml`).

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

## How a release happens

A release is a **version bump merged to `main`**. The workflow runs only when a push to `main` changes something under `plugins/`,
so a core change or a core release never starts it, and a plugin change never starts the core's `publish.yml`.

1. In a pull request, bump `version` in `plugins/<name>/package.json` and add the entry to `plugins/<name>/CHANGELOG.md`.
2. Merge it. The workflow publishes every plugin whose version is not on npm yet. A change under `plugins/` without a bump
   (a test, a README) publishes nothing.
3. After a publish it tags the merge commit `plugin/<name>/v<x.y.z>` and creates a GitHub Release for it. You don't create that
   Release yourself. The workflow creates it with its own `GITHUB_TOKEN`, and GitHub starts no workflow from that, so
   no skipped run of either workflow appears.

The plugin name is the directory under `plugins/` (lowercase letters, digits and dashes; anything else, including a path, is refused).

## What the workflow does

`.github/workflows/publish-plugins.yml`, on a push to `main` that touches `plugins/**`, or by hand (**Actions, Publish plugin to
npm, Run workflow**, with the plugin name). Two jobs:

- **plan**: `node scripts/plugin-release.mjs pending` lists the plugins whose `package.json` version is not on npm (a manual run
  takes the plugin named). With none, the publish job is skipped.
- **publish**, once per listed plugin, one at a time, on Linux with Node 22 in the `Prod` environment, stopping at the first failing step:
  1. `npm ci`, `npm run typecheck`, `npm run build` (the core of this commit).
  2. `node scripts/plugin-release.mjs verify <name>`: the package name is `@ambystech/ambykit-emitter-<name>`, the version is
     `x.y.z`, the `pluginApi` range includes the current plugin API (`PLUGIN_API_VERSION`), the package is not private and has no
     `workspaces`, and `repository` points at this repository and the plugin's directory.
  3. `npm run build:plugins`, then the plugin's tests (`npx vitest run plugins/<name>/`, so a plugin needs at least one test).
  4. `npm pack --dry-run`, so the file list is in the log.
  5. If that exact version is already on npm, it stops here (a manual run of a published version changes nothing).
  6. `npm publish --access public` from `plugins/<name>/`, using Trusted Publishing (OIDC). Provenance is automatic.
  7. The `plugin/<name>/v<x.y.z>` tag and GitHub Release (skipped if the Release exists).

## The first publish of a new plugin is manual

npm only lets you configure a trusted publisher for a package that **already exists**; there is no "pending publisher".
So for each new plugin, once:

1. From your machine, in `plugins/<name>/`: `npm run build:plugins` at the root, then `npm publish --access public` (you sign in with
   your own npm account and 2FA). Publish `1.0.0`, or the version in `package.json`.
2. On npmjs.com, open the package, then **Settings, Trusted Publisher, GitHub Actions**, and enter: this repository,
   workflow filename `publish-plugins.yml` (the file name with its extension, **case-sensitive**), environment `Prod`, and under
   **Allowed actions** tick **npm publish**: new entries can default to staged publishing only, and a direct publish then fails with
   `403 OIDC permission denied for this action`. npm does not validate the entry when you save it, so a typo shows up only when a
   publish fails.
3. Prove it: merge the next version bump to `main` **within 2 days** (npm's limit for a new
   configuration to complete its first publish).

## Adding a plugin

1. Create `plugins/<name>/` as above; write a factory that extends `api.BaseEmitter` (or `SkillsEmitter`), declare `ambykit.pluginApi`.
2. Add tests that run the contract kit against the target's row in [`tool-compatibility.md`](./tool-compatibility.md).
3. `npm run build:plugins` and `npx vitest run plugins/<name>/` pass locally.
4. Do the manual first publish and set the trusted publisher (above).
5. Mention it in the core `CHANGELOG.md` and in `docs/plugin-split.md`.

## When something goes wrong

- **A bad version is out.** Merge a fixed version (a new version bump). `npm unpublish` is only possible in the first 72 hours and for
  versions nothing depends on; prefer `npm deprecate "@ambystech/ambykit-emitter-<name>@<version>" "reason, use <fixed version>"`.
- **A plugin must stop being used.** `npm deprecate "@ambystech/ambykit-emitter-<name>" "reason"` (all versions), and say what
  replaces it in the plugin's `CHANGELOG.md`.
- **The workflow fails at "Verify".** The `::error::` lines say what to fix in `package.json`. A failure there publishes nothing;
  merge the fix and the next push publishes the version.
- **A publish failed after the merge.** Fix the cause (for example the trusted publisher on npm), then re-run the failed job, or run
  the workflow by hand with the plugin name.
- **The publish worked but the tag or Release is missing.** Run the workflow by hand with the plugin name: it skips the publish
  and creates them if they are missing.
