import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without type declarations
import { verifyPackage } from "../../../scripts/plugin-release.mjs";
import { PLUGIN_API_VERSION } from "../../../src/plugins/api.js";
import { satisfies } from "../../../src/plugins/semver.js";

/** The package is shaped for the release workflow and uses only the published plugin API (spec 036, FR-007, FR-008). */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

describe("plugins/antigravity package (036:FR-007, FR-008)", () => {
  it("036:FR-008: the release checks pass for it (name, version, API range, repository directory, not private)", () => {
    const r = verifyPackage(dir, null, { apiVersion: PLUGIN_API_VERSION, satisfies });
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.name).toBe("@ambystech/ambykit-emitter-antigravity");
  });

  it("036:FR-008: a release tag for its version passes and one for another version fails", () => {
    const core = { apiVersion: PLUGIN_API_VERSION, satisfies };
    expect(verifyPackage(dir, pkg.version, core).ok).toBe(true);
    expect(verifyPackage(dir, "9.9.9", core).ok).toBe(false);
  });

  it("036:FR-007: it declares the stable plugin API, publishes only dist, README and LICENSE, and has no runtime dependencies", () => {
    expect(pkg.ambykit).toEqual({ pluginApi: "^2" });
    expect(pkg.files).toEqual(["dist", "README.md", "LICENSE"]);
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies).toBeUndefined();
    expect(pkg.workspaces).toBeUndefined();
    expect(pkg.publishConfig).toEqual({ access: "public" });
    expect(pkg.main).toBe("dist/index.js");
    for (const f of ["README.md", "LICENSE", "CHANGELOG.md", "tsconfig.json"]) expect(existsSync(join(dir, f))).toBe(true);
  });

  it("036:FR-007: its source imports nothing at run time: only `import type` from the published plugin API", () => {
    for (const file of readdirSync(join(dir, "src")).filter((f) => f.endsWith(".ts"))) {
      const imports = readFileSync(join(dir, "src", file), "utf8")
        // CRLF-safe: a Windows checkout may end every line with \r.
        .split(/\r?\n/)
        .filter((l) => /^\s*(import|export\s.*\sfrom)\b/.test(l));
      for (const line of imports) {
        expect(line, `${file}: ${line}`).toMatch(/^import type .* from "@ambystech\/ambykit\/plugin";$/);
      }
    }
  });

  it("036:FR-007: it uses only names the stability contract lists (the factory's api argument)", () => {
    const text = readFileSync(join(dir, "src", "index.ts"), "utf8");
    const used = new Set([...text.matchAll(/\bapi\.([A-Za-z_]+)/g)].map((m) => m[1]));
    const listed = new Set(["SkillsEmitter", "MCP_COMMAND", "MCP_SERVER_NAME", "BaseEmitter", "TomlCommandEmitter", "skillName", "skillPath", "skillFrontmatter", "tomlBasic", "tomlPrompt", "apiVersion"]);
    for (const name of used) expect(listed.has(name as string), `api.${name}`).toBe(true);
  });
});
