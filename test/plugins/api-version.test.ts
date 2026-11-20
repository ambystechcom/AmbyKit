import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SyncCommand } from "../../src/cli/sync.js";
import { PLUGIN_API_VERSION } from "../../src/plugins/api.js";
import * as pluginBarrel from "../../src/plugins/index.js";
import { loadPlugins } from "../../src/plugins/loader.js";
import { satisfies } from "../../src/plugins/semver.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("plugin API versioning (feature 027)", () => {
  it("027:FR-010: the refusal names the range the plugin asked for and the version found", async () => {
    const root = pluginProject({ plugins: { "ambykit-emitter-wrongrange": "1.0.0" } });
    const r = await loadPlugins(root, { "ambykit-emitter-wrongrange": "1.0.0" });
    expect(r.loaded).toEqual([]);
    expect(r.failures[0]!.reason).toBe(`requires plugin API ^3, but this AmbyKit provides ${PLUGIN_API_VERSION} (it accepts plugins declaring ^1 or ^2)`);
  });

  it("027:FR-010: through sync, the refusal is printed with the plugin name and exits 1", async () => {
    const root = pluginProject({ tools: ["claude"], plugins: { "ambykit-emitter-wrongrange": "1.0.0" } });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(1);
    expect(`${r.out}\n${r.err}`).toMatch(/Plugin ambykit-emitter-wrongrange was not loaded: requires plugin API \^3, but this AmbyKit provides 2\.0\.0/);
  });

  it("033:FR-007: the current API version is 2.0.0 and satisfies the documented ^2 example", () => {
    expect(PLUGIN_API_VERSION).toBe("2.0.0");
    expect(satisfies(PLUGIN_API_VERSION, "^2")).toEqual({ supported: true, satisfied: true });
  });

  it("033:FR-007: no experimental marker is exported, printed by sync or written in the plugin docs or the changelog convention", async () => {
    expect(Object.keys(pluginBarrel)).not.toContain("PLUGIN_API_EXPERIMENTAL");
    const lib = await import("../../src/index.js");
    expect(Object.keys(lib)).not.toContain("PLUGIN_API_EXPERIMENTAL");
    const root = pluginProject({ tools: ["fake"], plugins: { "ambykit-emitter-fake": "1.2.3" } });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(`${r.out}\n${r.err}`).not.toMatch(/experimental/i);
    for (const doc of ["plugin-api.md", "plugin-trust.md"]) {
      expect(readFileSync(join(ROOT, "docs", doc), "utf8"), doc).not.toMatch(/experimental in 1\.6|\(experimental\)|is \*\*experimental\*\*/i);
    }
    const log = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
    expect(log.slice(0, log.indexOf("## ["))).not.toMatch(/experimental/i);
  });

  it("027:FR-012: the changelog carries the [plugin-api] convention and a [plugin-api] entry", () => {
    const log = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
    expect(log).toMatch(/^- `\[plugin-api\]`/m);
    expect(log.slice(0, log.indexOf("## ["))).toMatch(/\[plugin-api\]/);
  });

  it("027:FR-012: the release checklist asks whether plugins are affected", () => {
    expect(readFileSync(join(ROOT, "docs", "contributing.md"), "utf8")).toMatch(/state in the changelog whether plugins are affected/);
  });
});
