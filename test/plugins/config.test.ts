import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/core/config.js";

function project(config: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-pcfg-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify(config));
  return root;
}

describe("plugins config key (feature 027)", () => {
  it("027:FR-016: an existing config with no plugins key parses and has no plugins", () => {
    const c = loadConfig(project({ version: "1.3.1", tools: ["claude"] }));
    expect(c.tools).toEqual(["claude"]);
    expect(c.plugins).toBeUndefined();
  });

  it("027:FR-003: the plugins map (package name to pin) is read", () => {
    const c = loadConfig(project({ version: "1.4.0", tools: [], plugins: { "ambykit-emitter-foo": "1.2.3" } }));
    expect(c.plugins).toEqual({ "ambykit-emitter-foo": "1.2.3" });
  });

  it("027:FR-006: a non-string pin is a config error, not a silent skip", () => {
    expect(() => loadConfig(project({ plugins: { "ambykit-emitter-foo": 1 } }))).toThrow();
  });
});
