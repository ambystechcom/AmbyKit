import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SyncCommand } from "../../src/cli/sync.js";
import { loadPlugins } from "../../src/plugins/loader.js";
import { installFixture, pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

const text = (r: { out: string; err: string }) => `${r.out}\n${r.err}`;

/** A package with an observable side effect on import, so "was it loaded" is a fact, not an inference. */
function installSideEffectPlugin(root: string, name = "ambykit-emitter-sidefx"): string {
  const dir = join(root, "node_modules", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "1.0.0", type: "module", main: "index.js", ambykit: { pluginApi: "^1" } }));
  writeFileSync(join(dir, "index.js"), `globalThis.__ambykit_sidefx = (globalThis.__ambykit_sidefx ?? 0) + 1;\nexport default { targets: [] };\n`);
  return name;
}

describe("plugin trust rules (feature 027, US-7)", () => {
  it("027:FR-006: an installed package that is not listed in config is never loaded", async () => {
    const root = pluginProject({ tools: ["claude"], plugins: undefined as never });
    const name = installSideEffectPlugin(root);
    installFixture(root, "ambykit-emitter-fake");
    delete (globalThis as Record<string, unknown>)["__ambykit_sidefx"];
    const importModule = vi.fn(async () => ({}));
    expect(await loadPlugins(root, undefined, { importModule })).toEqual({ loaded: [], failures: [] });
    expect(importModule).not.toHaveBeenCalled();
    // And through the CLI: listing nothing runs nothing, even with both packages sitting in node_modules.
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect((globalThis as Record<string, unknown>)["__ambykit_sidefx"]).toBeUndefined();
    expect(text(r)).not.toMatch(new RegExp(name));
  });

  it("027:FR-006: only the listed package is loaded when several are installed", async () => {
    const root = pluginProject({ tools: ["fake"], plugins: { "ambykit-emitter-fake": "1.2.3" } });
    installSideEffectPlugin(root);
    delete (globalThis as Record<string, unknown>)["__ambykit_sidefx"];
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect((globalThis as Record<string, unknown>)["__ambykit_sidefx"]).toBeUndefined();
  });

  it("027:FR-006: a listing without an exact version is refused before anything is read or run", async () => {
    const root = pluginProject({ plugins: { "ambykit-emitter-fake": "1.2.3" } });
    for (const pin of ["", "*", "^1.2.3", "~1.2.3", ">=1", "1.2", "latest", "v1.2.3"]) {
      const importModule = vi.fn(async () => ({}));
      const r = await loadPlugins(root, { "ambykit-emitter-fake": pin }, { importModule });
      expect(r.loaded, pin).toEqual([]);
      expect(r.failures[0]!.reason, pin).toMatch(/exact version/);
      expect(importModule, pin).not.toHaveBeenCalled();
    }
  });

  it("027:FR-006: an installed version that differs from the pin is refused without running the plugin", async () => {
    const root = pluginProject({ plugins: { "ambykit-emitter-fake": "1.2.3" } });
    const importModule = vi.fn(async () => ({}));
    const r = await loadPlugins(root, { "ambykit-emitter-fake": "1.2.2" }, { importModule });
    expect(r.failures[0]!.reason).toMatch(/installed version 1\.2\.3 does not match the pin 1\.2\.2/);
    expect(importModule).not.toHaveBeenCalled();
  });

  it("027:FR-006: a plugin installed in a parent folder is ignored; only <project>/node_modules counts", async () => {
    const root = pluginProject({ plugins: { "ambykit-emitter-fake": "1.2.3" }, install: [] });
    installFixture(dirname(root), "ambykit-emitter-fake"); // <tmp>/node_modules, one level above the project
    const importModule = vi.fn(async () => ({}));
    const r = await loadPlugins(root, { "ambykit-emitter-fake": "1.2.3" }, { importModule });
    expect(r.loaded).toEqual([]);
    expect(r.failures[0]!.reason).toMatch(/not installed/);
    expect(importModule).not.toHaveBeenCalled();
  });

  it("027:FR-006: a globally configured lookup path does not make a plugin loadable", async () => {
    const globalDir = mkdtempSync(join(tmpdir(), "ambykit-global-"));
    installFixture(globalDir, "ambykit-emitter-fake");
    const saved = process.env["NODE_PATH"];
    process.env["NODE_PATH"] = join(globalDir, "node_modules");
    try {
      const root = pluginProject({ plugins: { "ambykit-emitter-fake": "1.2.3" }, install: [] });
      const r = await loadPlugins(root, { "ambykit-emitter-fake": "1.2.3" });
      expect(r.loaded).toEqual([]);
      expect(r.failures[0]!.reason).toMatch(/not installed/);
    } finally {
      if (saved === undefined) delete process.env["NODE_PATH"];
      else process.env["NODE_PATH"] = saved;
    }
  });

  it("027:FR-006: a listed name that is not ambykit-emitter-* is refused even when it is installed", async () => {
    const root = pluginProject({});
    installSideEffectPlugin(root, "some-other-package");
    delete (globalThis as Record<string, unknown>)["__ambykit_sidefx"];
    const r = await loadPlugins(root, { "some-other-package": "1.0.0" });
    expect(r.failures[0]!.reason).toMatch(/not a plugin package name/);
    expect((globalThis as Record<string, unknown>)["__ambykit_sidefx"]).toBeUndefined();
  });
});
