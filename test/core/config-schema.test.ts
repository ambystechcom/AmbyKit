import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/core/config.js";
import { CONFIG_SCHEMA_VERSION, planConfigUpgrade, readSchemaVersion, upgradeConfig } from "../../src/core/config-schema.js";

describe("config schema version (030, US-7)", () => {
  it("030:FR-014: a config without schemaVersion reads as version 1", () => {
    expect(readSchemaVersion({ version: "1.5.0", tools: [] })).toBe(1);
    expect(readSchemaVersion({ schemaVersion: "two" })).toBe(1);
    expect(readSchemaVersion({ schemaVersion: 2 })).toBe(2);
    expect(readSchemaVersion(null)).toBe(1);
  });

  it("030:FR-014: upgrade adds schemaVersion 2 after version and preserves every other key, unknown ones included", () => {
    const raw = { version: "1.5.0", tools: ["claude"], futureThing: { a: [1, 2] }, mcp: { enabled: true } };
    const up = upgradeConfig(raw);
    expect(up).toMatchObject({ changed: true, from: 1, to: CONFIG_SCHEMA_VERSION });
    expect(Object.keys(up.config)).toEqual(["version", "schemaVersion", "tools", "futureThing", "mcp"]);
    expect(up.config["futureThing"]).toEqual({ a: [1, 2] });
    expect(raw).toEqual({ version: "1.5.0", tools: ["claude"], futureThing: { a: [1, 2] }, mcp: { enabled: true } });
  });

  it("030:FR-014: upgrading a current config changes nothing, and a second upgrade is a no-op", () => {
    const once = upgradeConfig({ version: "1.5.0", tools: [] });
    const twice = upgradeConfig(once.config);
    expect(twice.changed).toBe(false);
    expect(twice.config).toEqual(once.config);
  });

  it("030:FR-014: planConfigUpgrade writes 2-space JSON with a trailing newline for a v1 config", () => {
    const plan = planConfigUpgrade(JSON.stringify({ version: "1.5.0", tools: ["claude"] }));
    expect(plan.action).toBe("write");
    if (plan.action === "write") {
      expect(plan.text).toBe(`{\n  "version": "1.5.0",\n  "schemaVersion": 2,\n  "tools": [\n    "claude"\n  ]\n}\n`);
      expect(planConfigUpgrade(plan.text).action).toBe("current");
    }
  });

  it("030:FR-014: a newer config is refused (never written) with a message to upgrade the tool", () => {
    const plan = planConfigUpgrade(JSON.stringify({ version: "9.0.0", schemaVersion: 3 }));
    expect(plan).toMatchObject({ action: "refuse", kind: "newer" });
    expect(plan.action === "refuse" && plan.reason).toMatch(/newer AmbyKit.*upgrade the tool/);
  });

  it("030:FR-014: an unparseable config is refused with the file named, never written", () => {
    const plan = planConfigUpgrade("{ not json", ".amby/config.json");
    expect(plan).toMatchObject({ action: "refuse", kind: "unparseable" });
    expect(plan.action === "refuse" && plan.reason).toMatch(/\.amby\/config\.json is not valid JSON/);
    expect(planConfigUpgrade("[1,2]")).toMatchObject({ action: "refuse", kind: "unparseable" });
  });

  it("030:FR-014: no config file means nothing to upgrade", () => {
    expect(planConfigUpgrade(null).action).toBe("none");
  });

  it("030:FR-014: loadConfig reads a config without schemaVersion unchanged and never writes it", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-030-cfg-"));
    mkdirSync(join(dir, ".amby"));
    const file = join(dir, ".amby", "config.json");
    const text = JSON.stringify({ version: "1.5.0", tools: ["claude"] });
    writeFileSync(file, text);
    const cfg = loadConfig(dir);
    expect(cfg.schemaVersion).toBeUndefined();
    expect(readFileSync(file, "utf8")).toBe(text);
  });

  it("030:FR-014: loadConfig exposes a written schemaVersion", () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-030-cfg-"));
    mkdirSync(join(dir, ".amby"));
    writeFileSync(join(dir, ".amby", "config.json"), JSON.stringify({ version: "2.0.0", schemaVersion: 2, tools: [] }));
    expect(loadConfig(dir).schemaVersion).toBe(2);
  });
});
