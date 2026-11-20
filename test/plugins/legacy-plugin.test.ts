import { cpSync, mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPlugins } from "../../src/plugins/loader.js";

/**
 * Feature 033 (FR-009, US-6): plugins written for the 1.0 API (test/fixtures/plugins/api-1.0/) against the 2.x core: the object
 * and factory forms load with a note, and one that reached into an internal module is refused naming what it relied on.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const FIXTURES = join(ROOT, "test", "fixtures", "plugins", "api-1.0");

function project(names: string[], withPackage = false): string {
  const root = join(mkdtempSync(join(tmpdir(), "ambykit-legacy-")), "demo");
  mkdirSync(join(root, "node_modules"), { recursive: true });
  for (const name of names) cpSync(join(FIXTURES, name), join(root, "node_modules", name), { recursive: true });
  if (withPackage) {
    // The real package, so Node resolves '@ambystech/ambykit/...' through its `exports` map like an installed copy would.
    mkdirSync(join(root, "node_modules", "@ambystech"), { recursive: true });
    symlinkSync(ROOT, join(root, "node_modules", "@ambystech", "ambykit"), "junction");
  }
  return root;
}

describe("plugins written for the 1.0 API (feature 033, US-6)", () => {
  it("033:FR-009: the object form and the factory form load, each with the 1.x note", async () => {
    const names = ["ambykit-emitter-legacy-object", "ambykit-emitter-legacy-factory"];
    const root = project(names);
    const r = await loadPlugins(root, { [names[0]!]: "1.0.0", [names[1]!]: "1.0.0" });
    expect(r.failures).toEqual([]);
    expect(r.loaded.map((p) => p.name)).toEqual(names);
    for (const p of r.loaded) expect(p.notes?.[0], p.name).toContain("1.x plugin API (^1)");
    expect(r.loaded.flatMap((p) => p.targets.map((t) => t.id))).toEqual(["legacy-object", "legacy-factory"]);
  });

  it("033:FR-009: their targets still emit the files they always did", async () => {
    const names = ["ambykit-emitter-legacy-object", "ambykit-emitter-legacy-factory"];
    const root = project(names);
    const r = await loadPlugins(root, { [names[0]!]: "1.0.0", [names[1]!]: "1.0.0" });
    const { loadCommandSpecs } = await import("../../src/core/command-spec.js");
    const specs = loadCommandSpecs();
    for (const target of r.loaded.flatMap((p) => p.targets)) {
      const files = target.emitter.emit(specs, { projectName: "demo", specs, manageRules: false });
      expect(files.length, target.id).toBeGreaterThan(0);
      expect(files.some((f) => f.path.startsWith(target.emitter.commandDir)), target.id).toBe(true);
    }
  });

  it("033:FR-009: one that imported an internal module is refused naming what it relied on, and the others still load", async () => {
    const names = ["ambykit-emitter-legacy-factory", "ambykit-emitter-legacy-internal"];
    let root: string;
    try {
      root = project(names, true);
    } catch {
      return; // a platform that cannot create the directory link: the hint itself is covered in stable-api.test.ts
    }
    const r = await loadPlugins(root, { [names[0]!]: "1.0.0", [names[1]!]: "1.0.0" });
    expect(r.loaded.map((p) => p.name)).toEqual([names[0]]);
    const reason = r.failures.find((f) => f.name === names[1])?.reason ?? "";
    expect(reason).toContain("base-emitter");
    expect(reason).toContain("not part of the plugin API");
    expect(reason).toContain("api.MCP_COMMAND");
  });

  it("033:FR-009: a plugin listed with a pin that does not match is still refused, whatever API it declares", async () => {
    const root = project(["ambykit-emitter-legacy-factory"]);
    const r = await loadPlugins(root, { "ambykit-emitter-legacy-factory": "9.9.9" });
    expect(r.loaded).toEqual([]);
    expect(r.failures[0]!.reason).toContain("does not match the pin");
  });
});
