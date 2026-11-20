#!/usr/bin/env node
/**
 * Build every official plugin (spec 036): runs `tsc -p plugins/<name>/tsconfig.json` for each plugin directory that has one.
 * With no plugins it prints "no plugins" and exits 0, so CI can call it before any plugin exists.
 *
 *   node scripts/build-plugins.mjs [rootDir]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The plugin directories under `root/plugins` that have a tsconfig.json, sorted by name. */
export function listPlugins(root) {
  const base = join(root, "plugins");
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(base, e.name, "tsconfig.json")))
    .map((e) => e.name)
    .sort();
}

function main(argv) {
  const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const root = argv[0] ? resolve(argv[0]) : here;
  const plugins = listPlugins(root);
  if (plugins.length === 0) {
    console.log("no plugins");
    return 0;
  }
  // `typescript/bin/tsc` is not in the package exports map, so find the compiler next to the package entry (lib/typescript.js).
  const tsc = join(dirname(createRequire(join(here, "package.json")).resolve("typescript")), "..", "bin", "tsc");
  for (const name of plugins) {
    console.log(`building plugins/${name}`);
    const r = spawnSync(process.execPath, [tsc, "-p", join(root, "plugins", name, "tsconfig.json")], { stdio: "inherit" });
    if (r.status !== 0) {
      console.error(`plugins/${name} failed to build`);
      return r.status ?? 1;
    }
  }
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exit(main(process.argv.slice(2)));
}
