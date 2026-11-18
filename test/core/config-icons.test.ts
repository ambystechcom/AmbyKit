import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/core/config.js";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { runCommand } from "../helpers/run-command.js";
import { fleetProject } from "../helpers/fleet-fixture.js";

function project(dashboard: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-icons-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [], ...(dashboard === undefined ? {} : { dashboard }) }));
  return root;
}

describe("config: dashboard.icons (feature 029, FR-011)", () => {
  const saved = process.env["AMBYKIT_ICONS"];
  beforeEach(() => void delete process.env["AMBYKIT_ICONS"]);
  afterEach(() => void (saved === undefined ? delete process.env["AMBYKIT_ICONS"] : (process.env["AMBYKIT_ICONS"] = saved)));

  it("029:FR-011: nerd, unicode, ascii and auto are accepted", () => {
    for (const icons of ["nerd", "unicode", "ascii", "auto"]) expect(loadConfig(project({ icons })).dashboard?.icons).toBe(icons);
  });

  it("029:FR-011: an invalid value is rejected like other config fields, and the key is optional", () => {
    expect(() => loadConfig(project({ icons: "emoji" }))).toThrow();
    expect(loadConfig(project({ activeMinutes: 5 })).dashboard?.icons).toBeUndefined();
  });

  it("029:FR-011: the dashboard only reads the setting and never writes the config file", async () => {
    const root = project({ icons: "ascii" });
    const path = join(root, ".amby", "config.json");
    const before = readFileSync(path, "utf8");
    await runCommand(new DashboardCommand(), root, [], { json: true });
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("029:FR-011: an invalid config value does not stop the dashboard", async () => {
    const f = fleetProject([{ k: 1 }], { noRun: true, config: { dashboard: { icons: "emoji" } } });
    const r = await runCommand(new DashboardCommand(), f.root, [], { json: true });
    expect(r.code).toBe(0);
  });
});
