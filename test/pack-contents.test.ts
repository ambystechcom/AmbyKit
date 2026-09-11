import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { relative } from "node:path";
import { packageRoot, promptsDir, referenceDir, rolesDir, templatesDir } from "../src/core/paths.js";

const root = packageRoot();

// Every runtime asset dir the CLI reads from the installed package. If you add a new `*Dir()` to
// src/core/paths.ts, add it here too — and to package.json "files", or `npx` installs break.
const assetDirs = { promptsDir, templatesDir, rolesDir, referenceDir };

// Paths the published tarball would contain. Tests run against the checkout, so without this a dir
// missing from "files" passes every other test and only fails for real users (ENOENT on init).
function packedPaths(): Set<string> {
  const out = execSync("npm pack --dry-run --json --ignore-scripts", { cwd: root, encoding: "utf8" });
  const [pack] = JSON.parse(out) as { files: { path: string }[] }[];
  return new Set(pack.files.map((f) => f.path.replace(/\\/g, "/")));
}

describe("npm package contents", () => {
  const packed = packedPaths();

  for (const [name, dirFn] of Object.entries(assetDirs)) {
    it(`ships every file under ${name}()`, () => {
      const dir = dirFn();
      const rel = relative(root, dir).replace(/\\/g, "/");
      const files = readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => relative(root, `${e.parentPath}/${e.name}`).replace(/\\/g, "/"));
      expect(files.length, `${rel} is empty`).toBeGreaterThan(0);
      expect(files.filter((f) => !packed.has(f)), `missing from the npm tarball`).toEqual([]);
    });
  }
});
