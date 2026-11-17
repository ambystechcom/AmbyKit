import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateShape, loadPlugins } from "../../src/plugins/loader.js";
import { pluginProject, installFixture } from "../helpers/plugin-project.js";

const load = (plugins: Record<string, string>, install?: string[]) => {
  const root = pluginProject({ plugins, ...(install ? { install } : {}) });
  return loadPlugins(root, plugins);
};

describe("plugin loader (feature 027)", () => {
  it("027:FR-003: loads a factory-form plugin and a plain-object plugin", async () => {
    const r = await load({ "ambykit-emitter-fake": "1.2.3", "ambykit-emitter-plain": "1.0.0" });
    expect(r.failures).toEqual([]);
    expect(r.loaded.map((p) => `${p.name}@${p.version}`)).toEqual(["ambykit-emitter-fake@1.2.3", "ambykit-emitter-plain@1.0.0"]);
    expect(r.loaded[0]!.targets[0]!.id).toBe("fake");
    expect(r.loaded[1]!.targets[0]!.id).toBe("plain");
  });

  it("027:FR-004: a listed package that is not installed is reported with where it looked", async () => {
    const r = await load({ "ambykit-emitter-missing": "1.0.0" }, []);
    expect(r.loaded).toEqual([]);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]!.name).toBe("ambykit-emitter-missing");
    expect(r.failures[0]!.reason).toMatch(/not installed.*node_modules/);
  });

  it("027:FR-006: an installed version that differs from the pin is refused, naming both", async () => {
    const r = await load({ "ambykit-emitter-fake": "1.2.4" });
    expect(r.loaded).toEqual([]);
    expect(r.failures[0]!.reason).toMatch(/installed version 1\.2\.3 does not match the pin 1\.2\.4/);
  });

  it("027:FR-006: a range or tag instead of an exact pin is refused", async () => {
    for (const pin of ["^1.2.3", "latest", "1.2"]) {
      const r = await load({ "ambykit-emitter-fake": pin });
      expect(r.loaded, pin).toEqual([]);
      expect(r.failures[0]!.reason, pin).toMatch(/pinned to an exact version/);
    }
  });

  it("027:FR-010: a plugin API range that excludes this version is refused with both", async () => {
    const r = await load({ "ambykit-emitter-wrongrange": "1.0.0" });
    expect(r.failures[0]!.reason).toMatch(/requires plugin API \^2.*provides 1\.0\.0/);
  });

  it("027:FR-010: no declared range, and an unsupported range, are refused", async () => {
    const none = await load({ "ambykit-emitter-norange": "1.0.0" });
    expect(none.failures[0]!.reason).toMatch(/declares no plugin API range/);
    const odd = await load({ "ambykit-emitter-oddrange": "1.0.0" });
    expect(odd.failures[0]!.reason).toMatch(/'latest' is unsupported/);
  });

  it("027:FR-004: a bad shape lists every problem", async () => {
    const r = await load({ "ambykit-emitter-badshape": "1.0.0" });
    expect(r.failures[0]!.reason).toMatch(/bad shape:.*emitter\.displayName.*commandSurface.*commandDir.*emit must be a function/);
  });

  it("027:FR-004: a plugin that throws on load is reported, and the others still load", async () => {
    const r = await load({ "ambykit-emitter-throws": "1.0.0", "ambykit-emitter-fake": "1.2.3" });
    expect(r.failures.map((f) => f.name)).toEqual(["ambykit-emitter-throws"]);
    expect(r.failures[0]!.reason).toMatch(/failed to load: boom at import/);
    expect(r.loaded.map((p) => p.name)).toEqual(["ambykit-emitter-fake"]);
  });

  it("027:FR-004: a factory that throws is reported", async () => {
    const root = pluginProject({ plugins: { "ambykit-emitter-fake": "1.2.3" } });
    const r = await loadPlugins(root, { "ambykit-emitter-fake": "1.2.3" }, {
      importModule: async () => ({ default: () => { throw new Error("factory exploded"); } }),
    });
    expect(r.failures[0]!.reason).toMatch(/its factory threw: factory exploded/);
  });

  it("027:FR-006: a name that is not ambykit-emitter-* is never read", async () => {
    const root = pluginProject({});
    mkdirSync(join(root, "node_modules", "left-pad"), { recursive: true });
    writeFileSync(join(root, "node_modules", "left-pad", "package.json"), JSON.stringify({ name: "left-pad", version: "1.0.0" }));
    const r = await loadPlugins(root, { "left-pad": "1.0.0", "../ambykit-emitter-x": "1.0.0" });
    expect(r.loaded).toEqual([]);
    expect(r.failures.map((f) => f.reason)).toEqual([expect.stringMatching(/not a plugin package name/), expect.stringMatching(/not a plugin package name/)]);
  });

  it("027:FR-006: an empty or absent list loads nothing", async () => {
    const root = pluginProject({});
    expect(await loadPlugins(root, undefined)).toEqual({ loaded: [], failures: [] });
    expect(await loadPlugins(root, {})).toEqual({ loaded: [], failures: [] });
  });

  it("027:FR-004: validateShape accepts the minimal valid shape", () => {
    const emitter = { toolId: "t", displayName: "T", commandSurface: "none", commandDir: "x", emit: () => [] };
    expect(validateShape({ targets: [{ id: "t", displayName: "T", emitter }] })).toEqual([]);
    expect(validateShape(null)).toHaveLength(1);
    expect(validateShape({ targets: [] })).toHaveLength(1);
  });

  it("027:FR-006: installFixture places a package under node_modules only", () => {
    const root = pluginProject({});
    installFixture(root, "ambykit-emitter-fake");
    expect(root).toContain("demo");
  });
});
