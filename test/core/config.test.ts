import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fleetSettings, loadConfig } from "../../src/core/config.js";

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

describe("config: mcp and fleet (feature 025)", () => {
  it("025:FR-019: mcp.enabled is opt-in and absent by default", () => {
    expect(loadConfig(project({ tools: ["claude"] })).mcp).toBeUndefined();
    expect(loadConfig(project({ tools: ["claude"], mcp: { enabled: true } })).mcp).toEqual({ enabled: true });
  });

  it("025:FR-014: fleetSettings fills the defaults (stall 15, restart 2, concurrency 3/2, rounds 3)", () => {
    const s = fleetSettings(loadConfig(project({ tools: [] })));
    expect(s).toMatchObject({ stallMinutes: 15, restartLimit: 2, concurrency: { total: 3, perType: 2 }, roundLimit: 3 });
    expect(s.tickSeconds).toBeGreaterThan(0);
  });

  it("025:FR-014: a configured fleet object overrides only the keys it names", () => {
    const s = fleetSettings(loadConfig(project({ tools: [], fleet: { stallMinutes: 5, concurrency: { total: 6 } } })));
    expect(s.stallMinutes).toBe(5);
    expect(s.concurrency).toEqual({ total: 6, perType: 2 });
    expect(s.restartLimit).toBe(2);
  });

  it("025:FR-014: rejects a non-positive stall limit", () => {
    expect(() => loadConfig(project({ tools: [], fleet: { stallMinutes: 0 } }))).toThrow();
  });
});
