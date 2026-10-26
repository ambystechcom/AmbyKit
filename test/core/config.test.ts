import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/core/config.js";

function project(config: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-cfg-"));
  mkdirSync(join(root, ".amby"));
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify(config));
  return root;
}

describe("config: dashboard thresholds (feature 017, C-1)", () => {
  it("accepts optional activeMinutes / idleMinutes", () => {
    const cfg = loadConfig(project({ tools: [], dashboard: { activeMinutes: 5, idleMinutes: 60 } }));
    expect(cfg.dashboard).toEqual({ activeMinutes: 5, idleMinutes: 60 });
  });

  it("is absent when not configured", () => {
    expect(loadConfig(project({ tools: ["claude"] })).dashboard).toBeUndefined();
  });

  it("rejects non-positive thresholds", () => {
    expect(() => loadConfig(project({ tools: [], dashboard: { activeMinutes: 0 } }))).toThrow();
  });
});
