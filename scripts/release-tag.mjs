#!/usr/bin/env node
/**
 * The npm dist-tag for a core release (spec 034, FR-009): a version with a prerelease suffix (`2.0.0-rc.1`) publishes under `next`,
 * so `npm install @ambystech/ambykit` without a tag keeps getting the current `latest`; a plain version publishes under `latest`.
 * npm refuses to publish a prerelease without an explicit `--tag`, which is why `.github/workflows/publish.yml` always passes one.
 *
 *   node scripts/release-tag.mjs [version]     (default: the version in package.json)
 *
 * Prints the tag, or one `::error::` line and exits 1 for a malformed version. `test/release/release-tag.test.ts` tests `distTag`.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** The dist-tag a release candidate goes to (034 decision D-3). */
export const PRERELEASE_TAG = "next";

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/** `{ major, minor, patch, prerelease }` for a semantic version (build metadata is refused: npm drops it), or null. */
export function parseVersion(version) {
  if (typeof version !== "string") return null;
  const m = SEMVER.exec(version);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), prerelease: m[4] ?? null };
}

/** `{ ok: true, tag }` (`next` for a prerelease, `latest` for a plain version), or `{ ok: false, reason }`. */
export function distTag(version) {
  const v = parseVersion(version);
  if (!v) return { ok: false, reason: `'${version}' is not a version like 2.0.0 or 2.0.0-rc.1` };
  return { ok: true, tag: v.prerelease ? PRERELEASE_TAG : "latest" };
}

function main(argv) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const version = argv[0] ?? JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  const r = distTag(version);
  if (!r.ok) {
    console.log(`::error::${r.reason}`);
    return 1;
  }
  console.log(r.tag);
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exit(main(process.argv.slice(2)));
}
