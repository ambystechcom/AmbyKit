#!/usr/bin/env node
/**
 * Release checks for the official plugins in `plugins/<name>/` (spec 036, FR-007, FR-008).
 *
 * The pure functions (`parseTag`, `pluginDir`, `verifyPackage`) are what `.github/workflows/publish-plugins.yml` relies on and what
 * `test/scripts/plugin-release.test.ts` tests. The core pieces they need (the current plugin API version and the range check) are
 * passed in, so tests need no build; the command line loads them from the built core (`dist/`).
 *
 *   node scripts/plugin-release.mjs verify <refName | pluginName>
 *
 * `refName` is a release tag `plugin/<name>/v<x.y.z>` (the tag version must equal the package version); a bare `<name>` is a manual
 * run, which checks the package only. On success it prints the plugin's directory, name and version and, under GitHub Actions,
 * writes them to $GITHUB_OUTPUT. On failure it prints one `::error::` line per problem and exits 1.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PLUGIN_SCOPE = "@ambystech";
export const PLUGIN_PREFIX = "ambykit-emitter-";
export const REPOSITORY_URL = "git+https://github.com/ambystechcom/AmbyKit.git";

/** A plugin directory name: lowercase letters, digits and dashes only, so a tag or an input can never name a path. */
const NAME = /^[a-z0-9][a-z0-9-]*$/;
const TAG = /^plugin\/([^/]+)\/v(\d+\.\d+\.\d+)$/;

/** `plugin/antigravity/v1.2.3` -> `{ ok: true, name: "antigravity", version: "1.2.3" }`; anything else is refused with a reason. */
export function parseTag(refName) {
  if (typeof refName !== "string" || !refName.startsWith("plugin/")) {
    return { ok: false, reason: `'${refName}' is not a plugin release tag (expected plugin/<name>/v<x.y.z>)` };
  }
  const m = TAG.exec(refName);
  if (!m) return { ok: false, reason: `'${refName}' is not a plugin release tag (expected plugin/<name>/v<x.y.z>)` };
  const [, name, version] = m;
  if (!NAME.test(name)) return { ok: false, reason: `'${name}' is not a valid plugin name (lowercase letters, digits and dashes)` };
  return { ok: true, name, version };
}

/** A manual run names the plugin directly; it gets the same name check as a tag. */
export function parsePluginName(input) {
  if (typeof input !== "string" || !NAME.test(input)) {
    return { ok: false, reason: `'${input}' is not a valid plugin name (lowercase letters, digits and dashes)` };
  }
  return { ok: true, name: input };
}

/** `plugins/<name>` under `root`. Refuses a name that is not a plain directory name. */
export function pluginDir(root, name) {
  if (!NAME.test(name)) throw new Error(`'${name}' is not a valid plugin name`);
  return join(root, "plugins", name);
}

/**
 * Check one plugin package before it is published. Returns `{ ok, name, version, errors }`; every problem is listed, not just the first.
 * `core` = `{ apiVersion, satisfies }` from the built core (`PLUGIN_API_VERSION` and the plugin loader's range check).
 * `tagVersion` is the version in the release tag, or null for a manual run.
 */
export function verifyPackage(dir, tagVersion, core, fs = { existsSync, readFileSync }) {
  const errors = [];
  const file = join(dir, "package.json");
  if (!fs.existsSync(file)) return { ok: false, name: null, version: null, errors: [`${file} does not exist`] };
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { ok: false, name: null, version: null, errors: [`${file} is not valid JSON`] };
  }
  const dirName = basename(resolve(dir));
  const expectedName = `${PLUGIN_SCOPE}/${PLUGIN_PREFIX}${dirName}`;
  if (pkg.name !== expectedName) errors.push(`package name is '${pkg.name}', expected '${expectedName}' for plugins/${dirName}`);
  if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
    errors.push(`package version '${pkg.version}' is not x.y.z`);
  } else if (tagVersion !== null && pkg.version !== tagVersion) {
    errors.push(`release tag version '${tagVersion}' does not match package version '${pkg.version}'`);
  }
  const range = pkg.ambykit && typeof pkg.ambykit === "object" ? pkg.ambykit.pluginApi : undefined;
  if (typeof range !== "string") {
    errors.push(`package.json has no "ambykit": { "pluginApi": "<range>" }`);
  } else {
    const r = core.satisfies(core.apiVersion, range);
    if (!r.supported) errors.push(`pluginApi range '${range}' is not supported: ${r.reason}`);
    else if (!r.satisfied) errors.push(`pluginApi range '${range}' does not include the current plugin API ${core.apiVersion}`);
  }
  if (pkg.private === true) errors.push(`package.json is private, npm would refuse to publish it`);
  if (pkg.workspaces !== undefined) errors.push(`plugins do not use npm workspaces (remove "workspaces")`);
  // Provenance needs the package to point at this repository and its own directory.
  const repo = pkg.repository;
  if (!repo || typeof repo !== "object" || repo.url !== REPOSITORY_URL || repo.directory !== `plugins/${dirName}`) {
    errors.push(`repository must be { "type": "git", "url": "${REPOSITORY_URL}", "directory": "plugins/${dirName}" } (npm provenance checks it)`);
  }
  return { ok: errors.length === 0, name: pkg.name ?? null, version: pkg.version ?? null, errors };
}

async function loadCore(root) {
  const api = await import(pathToFileURL(join(root, "dist", "plugins", "api.js")).href);
  const semver = await import(pathToFileURL(join(root, "dist", "plugins", "semver.js")).href);
  return { apiVersion: api.PLUGIN_API_VERSION, satisfies: semver.satisfies };
}

async function main(argv) {
  const [command, input] = argv;
  if (command !== "verify" || !input) {
    console.error("usage: node scripts/plugin-release.mjs verify <plugin/<name>/v<x.y.z> | <name>>");
    return 2;
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const parsed = input.startsWith("plugin/") ? parseTag(input) : parsePluginName(input);
  if (!parsed.ok) {
    console.log(`::error::${parsed.reason}`);
    return 1;
  }
  const dir = pluginDir(root, parsed.name);
  const result = verifyPackage(dir, parsed.version ?? null, await loadCore(root));
  if (!result.ok) {
    for (const e of result.errors) console.log(`::error::${e}`);
    return 1;
  }
  console.log(`plugin ${result.name}@${result.version} in plugins/${parsed.name} is ready to publish`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `name=${parsed.name}\ndir=plugins/${parsed.name}\npackage=${result.name}\nversion=${result.version}\n`);
  }
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
