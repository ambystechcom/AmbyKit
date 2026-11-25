import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM scripts without type declarations
import { listPlugins } from "../../scripts/build-plugins.mjs";
// @ts-expect-error plain ESM scripts without type declarations
import { parsePluginName, parseTag, pendingPlugins, pluginDir, verifyPackage } from "../../scripts/plugin-release.mjs";
import { PLUGIN_API_VERSION } from "../../src/plugins/api.js";
import { satisfies } from "../../src/plugins/semver.js";

/**
 * Release tooling for the official plugins (feature 036): the tag, the package and the API-range checks that
 * `.github/workflows/publish-plugins.yml` runs before it publishes, and the plugin build script.
 */

const root = resolve(__dirname, "..", "..");
const core = { apiVersion: PLUGIN_API_VERSION, satisfies };

const REPO = { type: "git", url: "git+https://github.com/ambystechcom/AmbyKit.git", directory: "plugins/antigravity" };

function plugin(over: Record<string, unknown> = {}, name = "antigravity"): string {
  const dir = join(mkdtempSync(join(tmpdir(), "ambykit-plugin-")), name);
  mkdirSync(dir, { recursive: true });
  const pkg = {
    name: `@ambystech/ambykit-emitter-${name}`,
    version: "1.2.3",
    type: "module",
    ambykit: { pluginApi: "^2" },
    repository: { ...REPO, directory: `plugins/${name}` },
    ...over,
  };
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2));
  return dir;
}

describe("plugin release tag (036:FR-008)", () => {
  it("036:FR-008: plugin/<name>/v<x.y.z> names one plugin and its version", () => {
    expect(parseTag("plugin/antigravity/v1.2.3")).toEqual({ ok: true, name: "antigravity", version: "1.2.3" });
    expect(parseTag("plugin/long-tail-2/v10.0.1")).toEqual({ ok: true, name: "long-tail-2", version: "10.0.1" });
  });

  it("036:FR-008: anything that is not a plugin tag is refused with a reason", () => {
    for (const bad of ["v1.6.0", "antigravity/v1.0.0", "plugin/antigravity", "plugin/antigravity/1.0.0", "plugin/antigravity/v1.0", "plugin/antigravity/v1.0.0-rc.1", "plugin/antigravity/v1.0.0/extra", "plugin//v1.0.0", "plugin/Antigravity/v1.0.0", ""]) {
      const r = parseTag(bad);
      expect(r.ok, bad).toBe(false);
      expect(r.reason, bad).toMatch(/plugin release tag|valid plugin name/);
    }
  });

  it("036:FR-008: a tag cannot name a path outside plugins/", () => {
    for (const bad of ["plugin/../x/v1.0.0", "plugin/./v1.0.0", "plugin/..%2Fx/v1.0.0", "plugin/a\\b/v1.0.0", "plugin/.hidden/v1.0.0", "plugin/-x/v1.0.0"]) {
      expect(parseTag(bad).ok, bad).toBe(false);
    }
    expect(parsePluginName("../x").ok).toBe(false);
    expect(parsePluginName("a/b").ok).toBe(false);
    expect(parsePluginName("antigravity")).toEqual({ ok: true, name: "antigravity" });
    expect(() => pluginDir(root, "../x")).toThrow(/not a valid plugin name/);
    expect(pluginDir(root, "antigravity")).toBe(join(root, "plugins", "antigravity"));
  });
});

describe("plugin package check (036:FR-007)", () => {
  it("036:FR-007: a well-formed package passes, and a manual run (no tag) checks the package only", () => {
    const dir = plugin();
    expect(verifyPackage(dir, "1.2.3", core)).toEqual({ ok: true, name: "@ambystech/ambykit-emitter-antigravity", version: "1.2.3", errors: [] });
    expect(verifyPackage(dir, null, core).ok).toBe(true);
  });

  it("036:FR-008: a tag version that differs from the package version is refused naming both", () => {
    const r = verifyPackage(plugin(), "1.2.4", core);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/'1\.2\.4' does not match package version '1\.2\.3'/);
  });

  it("036:FR-007: the package name must be the scoped ambykit-emitter-<directory>", () => {
    expect(verifyPackage(plugin({ name: "ambykit-emitter-antigravity" }), null, core).errors.join("\n")).toMatch(/expected '@ambystech\/ambykit-emitter-antigravity'/);
    expect(verifyPackage(plugin({ name: "@ambystech/ambykit-emitter-other" }), null, core).ok).toBe(false);
    expect(verifyPackage(plugin({ name: "@ambystech/not-a-plugin" }), null, core).ok).toBe(false);
  });

  it("036:FR-007: the declared pluginApi range must include the current plugin API", () => {
    const old = verifyPackage(plugin({ ambykit: { pluginApi: "^1" } }), null, core);
    expect(old.ok).toBe(false);
    expect(old.errors.join("\n")).toContain(`does not include the current plugin API ${PLUGIN_API_VERSION}`);
    expect(verifyPackage(plugin({ ambykit: { pluginApi: ">=2.0.0 <3.0.0" } }), null, core).ok).toBe(true);
    expect(verifyPackage(plugin({ ambykit: { pluginApi: "^3" } }), null, core).ok).toBe(false);
  });

  it("036:FR-007: a missing or unsupported pluginApi range is refused", () => {
    expect(verifyPackage(plugin({ ambykit: {} }), null, core).errors.join("\n")).toMatch(/no "ambykit": \{ "pluginApi"/);
    expect(verifyPackage(plugin({ ambykit: undefined }), null, core).ok).toBe(false);
    expect(verifyPackage(plugin({ ambykit: { pluginApi: "latest" } }), null, core).errors.join("\n")).toMatch(/not supported/);
  });

  it("036:FR-007: every problem is reported, not just the first", () => {
    const r = verifyPackage(plugin({ name: "x", version: "1.0", ambykit: { pluginApi: "^1" }, private: true }), "9.9.9", core);
    expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("036:FR-007: provenance needs the repository and directory to point at this plugin; no workspaces, not private", () => {
    expect(verifyPackage(plugin({ repository: undefined }), null, core).ok).toBe(false);
    expect(verifyPackage(plugin({ repository: { ...REPO, directory: "plugins/other" } }), null, core).errors.join("\n")).toMatch(/repository must be/);
    expect(verifyPackage(plugin({ repository: { ...REPO, url: "git+https://github.com/someone/else.git" } }), null, core).ok).toBe(false);
    expect(verifyPackage(plugin({ workspaces: ["x"] }), null, core).errors.join("\n")).toMatch(/workspaces/);
    expect(verifyPackage(plugin({ private: true }), null, core).errors.join("\n")).toMatch(/private/);
  });

  it("036:FR-007: a missing or unreadable package.json is an error, not an exception", () => {
    const dir = join(mkdtempSync(join(tmpdir(), "ambykit-plugin-")), "antigravity");
    mkdirSync(dir);
    expect(verifyPackage(dir, null, core).errors.join("\n")).toMatch(/does not exist/);
    writeFileSync(join(dir, "package.json"), "{ nope");
    expect(verifyPackage(dir, null, core).errors.join("\n")).toMatch(/not valid JSON/);
  });
});

describe("release scripts on the command line", () => {
  const run = (script: string, args: string[]) => spawnSync(process.execPath, [join(root, "scripts", script), ...args], { encoding: "utf8" });

  it("036:FR-008: verify refuses a traversal tag with an ::error:: line and exits 1; no arguments exits 2", () => {
    const bad = run("plugin-release.mjs", ["verify", "plugin/../x/v1.0.0"]);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toMatch(/^::error::/m);
    expect(run("plugin-release.mjs", []).status).toBe(2);
    expect(run("plugin-release.mjs", ["verify", "../x"]).status).toBe(1);
  });

  it("036:FR-007: build:plugins with no plugins prints 'no plugins' and exits 0", () => {
    const empty = mkdtempSync(join(tmpdir(), "ambykit-noplugins-"));
    const r = run("build-plugins.mjs", [empty]);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("no plugins");
    mkdirSync(join(empty, "plugins"));
    expect(run("build-plugins.mjs", [empty]).stdout.trim()).toBe("no plugins");
  });

  it("036:FR-007: build:plugins compiles a plugin to its dist/ and fails the run when one does not compile", () => {
    const base = mkdtempSync(join(tmpdir(), "ambykit-plugins-"));
    const dir = join(base, "plugins", "demo");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", outDir: "dist", rootDir: "src", strict: true, skipLibCheck: true }, include: ["src"] }));
    writeFileSync(join(dir, "src", "index.ts"), "export default function (api: unknown) { return { targets: [], api }; }\n");
    const ok = run("build-plugins.mjs", [base]);
    expect(ok.status).toBe(0);
    expect(existsSync(join(dir, "dist", "index.js"))).toBe(true);
    writeFileSync(join(dir, "src", "bad.ts"), 'export const n: number = "x";\n');
    expect(run("build-plugins.mjs", [base]).status).not.toBe(0);
  }, 60_000);

  it("036:FR-007: only directories with a tsconfig.json are plugins to build, in name order", () => {
    const base = mkdtempSync(join(tmpdir(), "ambykit-plugins-"));
    for (const n of ["zeta", "alpha", "notes"]) mkdirSync(join(base, "plugins", n), { recursive: true });
    writeFileSync(join(base, "plugins", "zeta", "tsconfig.json"), "{}");
    writeFileSync(join(base, "plugins", "alpha", "tsconfig.json"), "{}");
    writeFileSync(join(base, "plugins", "README.md"), "x");
    expect(listPlugins(base)).toEqual(["alpha", "zeta"]);
  });
});

describe("which plugins a push publishes (036:FR-008)", () => {
  function tree(pkgs: Record<string, unknown>): string {
    const base = mkdtempSync(join(tmpdir(), "ambykit-pending-"));
    for (const [n, pkg] of Object.entries(pkgs)) {
      mkdirSync(join(base, "plugins", n), { recursive: true });
      writeFileSync(join(base, "plugins", n, "tsconfig.json"), "{}");
      writeFileSync(join(base, "plugins", n, "package.json"), typeof pkg === "string" ? pkg : JSON.stringify(pkg));
    }
    return base;
  }

  it("036:FR-008: only plugins whose version is not on npm yet, in name order; a change without a bump publishes nothing", () => {
    const base = tree({
      zeta: { name: "@ambystech/ambykit-emitter-zeta", version: "1.0.1" },
      alpha: { name: "@ambystech/ambykit-emitter-alpha", version: "2.0.0" },
      beta: { name: "@ambystech/ambykit-emitter-beta", version: "1.0.0" },
    });
    const onNpm = new Set(["@ambystech/ambykit-emitter-beta@1.0.0", "@ambystech/ambykit-emitter-zeta@1.0.0"]);
    const asked: string[] = [];
    const isPublished = (pkg: string, v: string): boolean => (asked.push(`${pkg}@${v}`), onNpm.has(`${pkg}@${v}`));
    expect(pendingPlugins(base, isPublished)).toEqual(["alpha", "zeta"]);
    expect(asked).toHaveLength(3);
    expect(pendingPlugins(tree({ beta: { name: "@ambystech/ambykit-emitter-beta", version: "1.0.0" } }), isPublished)).toEqual([]);
  });

  it("036:FR-008: a package.json it cannot read is listed, so verify reports it instead of the plugin being skipped", () => {
    const base = tree({ broken: "{ not json", noversion: { name: "@ambystech/ambykit-emitter-noversion" } });
    expect(pendingPlugins(base, () => true)).toEqual(["broken", "noversion"]);
  });
});

describe("workflow wiring (036:FR-008)", () => {
  const read = (f: string): string => readFileSync(join(root, ".github", "workflows", f), "utf8").replace(/\r\n/g, "\n");

  it("036:FR-008: the plugin workflow runs only for changes under plugins/ on main or by hand, in the Prod environment, with OIDC and no token", () => {
    const w = read("publish-plugins.yml");
    const on = w.slice(w.indexOf("\non:"), w.indexOf("\npermissions:"));
    expect(on).toMatch(/push:\n\s+branches: \[main\]\n\s+paths:\n\s+- "plugins\/\*\*"/);
    expect(on).toContain("workflow_dispatch:");
    expect(on).not.toContain("release:"); // a core release must not start (and skip) this workflow
    expect(w).toContain("scripts/plugin-release.mjs pending");
    expect(w).toContain("environment: Prod");
    expect(w).toContain("id-token: write");
    expect(w).toContain("npm publish --access public");
    const code = w
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n"); // comments may mention the token
    expect(code).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN/);
    // the verify step comes before anything is published
    expect(w.indexOf("scripts/plugin-release.mjs verify")).toBeGreaterThan(0);
    expect(w.indexOf("scripts/plugin-release.mjs verify")).toBeLessThan(w.indexOf("run: npm publish"));
    // the tag and release come after the publish, from GITHUB_TOKEN (which starts no other workflow run)
    expect(w.indexOf("gh release create")).toBeGreaterThan(w.indexOf("run: npm publish"));
    expect(w).toContain("GH_TOKEN: ${{ github.token }}");
    expect(w).toContain("contents: write");
  });

  it("036:FR-008: the core workflow ignores plugin tags, and CI builds the plugins", () => {
    expect(read("publish.yml")).toContain("!startsWith(github.event.release.tag_name, 'plugin/')");
    expect(read("ci.yml")).toContain("npm run build:plugins");
  });
});
