import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SyncCommand } from "../../src/cli/sync.js";
import { PLUGIN_API_VERSION } from "../../src/plugins/api.js";
import { importHint, loadPlugins } from "../../src/plugins/loader.js";
import { reportPlugins } from "../../src/plugins/report.js";
import { loadPluginSession } from "../../src/plugins/session.js";
import { contractFor, parseContractBlocks } from "../helpers/contract-doc.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

/** Feature 033, US-4: the plugin API is stable from 2.0, and a plugin written for 1.x keeps working or is told what to change. */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("the plugin API is stable (feature 033, US-4)", () => {
  it("033:FR-007: the version is 2.x and the exports carry no experimental marker", async () => {
    expect(PLUGIN_API_VERSION.split(".")[0]).toBe("2");
    const barrel = await import("../../src/plugins/index.js");
    const lib = await import("../../src/index.js");
    expect(Object.keys(barrel)).toContain("PLUGIN_API_VERSION");
    for (const exports of [barrel, lib]) expect(Object.keys(exports)).not.toContain("PLUGIN_API_EXPERIMENTAL");
  });

  it("033:FR-007: sync, check and the docs say nothing is experimental about the plugin API", async () => {
    const root = pluginProject({ tools: ["fake"], plugins: { "ambykit-emitter-fake": "1.2.3" } });
    for (const flags of [{}, { check: true }]) {
      const r = await runCommand(new SyncCommand(), root, [], flags);
      expect(`${r.out}\n${r.err}`, JSON.stringify(flags)).not.toMatch(/experimental/i);
    }
    const doc = readFileSync(join(ROOT, "docs", "plugin-api.md"), "utf8");
    expect(doc).toMatch(/^# Plugin API$/m);
    expect(doc).toMatch(/Stable from 2\.0/);
  });

  it("033:FR-009: a plugin that declares ^1 loads with a one-line note, and the report shows it under the plugin", async () => {
    const root = pluginProject({ plugins: { "ambykit-emitter-fake": "1.2.3" } });
    const r = await loadPlugins(root, { "ambykit-emitter-fake": "1.2.3" });
    expect(r.failures).toEqual([]);
    expect(r.loaded[0]!.notes).toHaveLength(1);
    expect(r.loaded[0]!.notes![0]).toContain("1.x plugin API (^1)");
    expect(r.loaded[0]!.notes![0]).toContain("declare ^2");

    const session = await loadPluginSession(root, { plugins: { "ambykit-emitter-fake": "1.2.3" } });
    const info = reportPlugins(session).info;
    expect(info[0]).toBe("Plugin ambykit-emitter-fake@1.2.3");
    expect(info[1]).toMatch(/^ {2}note: it declares the 1\.x plugin API/);
    expect(info.join("\n")).not.toMatch(/experimental/i);
  });

  it("033:FR-009: a plugin that declares ^2 loads with no note", async () => {
    const root = pluginProject({ plugins: { "ambykit-emitter-skills-target": "1.0.0" } });
    const r = await loadPlugins(root, { "ambykit-emitter-skills-target": "1.0.0" });
    expect(r.failures).toEqual([]);
    expect(r.loaded[0]!.notes).toBeUndefined();
  });

  it("033:FR-009: a range that excludes both 1.x and 2.x is refused naming the range and the version found", async () => {
    const root = pluginProject({ plugins: { "ambykit-emitter-wrongrange": "1.0.0" } });
    const r = await loadPlugins(root, { "ambykit-emitter-wrongrange": "1.0.0" });
    expect(r.loaded).toEqual([]);
    expect(r.failures[0]!.reason).toContain("requires plugin API ^3");
    expect(r.failures[0]!.reason).toContain(`provides ${PLUGIN_API_VERSION}`);
  });

  it("033:FR-009: a plugin that imported an internal name is told which name and that it is not part of the API", () => {
    const hint = importHint(new Error("The requested module '@ambystech/ambykit/plugin' does not provide an export named 'InternalThing'"));
    expect(hint).toContain("'InternalThing'");
    expect(hint).toContain("not part of the plugin API");
    expect(hint).toContain("docs/stability.md");
  });

  it("033:FR-009: a plugin that imported an internal path is told it is internal and where MCP_COMMAND comes from", () => {
    const hint = importHint(new Error(`Package subpath './dist/emitters/base-emitter.js' is not defined by "exports" in /p/node_modules/@ambystech/ambykit/package.json imported from /p/node_modules/ambykit-emitter-x/index.js`));
    expect(hint).toContain("'./dist/emitters/base-emitter.js'");
    expect(hint).toContain("internal and not part of the plugin API");
    expect(hint).toContain("api.MCP_COMMAND");
  });

  it("033:FR-009: MCP_SERVER_NAME and MCP_COMMAND are part of the API, so the hint never calls them internal", () => {
    for (const name of ["MCP_SERVER_NAME", "MCP_COMMAND"]) {
      const hint = importHint(new Error(`The requested module './x.js' does not provide an export named '${name}'`));
      expect(hint, name).toContain("the name is part of the plugin API");
      expect(hint, name).toContain(`api.${name}`);
      expect(hint, name).not.toContain("not part of the plugin API");
    }
  });

  it("033:FR-009: an error that names no import is reported as before, without a hint", () => {
    expect(importHint(new Error("boom"))).toBe("failed to load: boom");
  });

  it("033:FR-007, 033:FR-013: the plugin contract lists the two MCP names and the version constant, and not the removed flag", () => {
    const plugin = contractFor(parseContractBlocks(readFileSync(join(ROOT, "docs", "stability.md"), "utf8")), "plugin");
    expect(plugin["exports"]).toEqual(expect.arrayContaining(["PLUGIN_API_VERSION", "MCP_SERVER_NAME", "MCP_COMMAND"]));
    expect(plugin["exports"]).not.toContain("PLUGIN_API_EXPERIMENTAL");
  });
});
