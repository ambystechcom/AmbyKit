import { describe, expect, it } from "vitest";
import { MIN_NODE_MAJOR, checkNode } from "../../src/cli/node-guard.js";

describe("Node 22 minimum (030, US-8)", () => {
  it("030:FR-015: the minimum is Node 22", () => {
    expect(MIN_NODE_MAJOR).toBe(22);
  });

  it("030:FR-015: versions below 22 get a message naming the required version and the version found", () => {
    for (const v of ["20.11.1", "18.19.0", "21.7.3", "16.0.0"]) {
      const msg = checkNode(v);
      expect(msg, v).toMatch(/Node\.js 22 or newer/);
      expect(msg, v).toContain(`found ${v}`);
    }
  });

  it("030:FR-015: Node 22 and newer pass", () => {
    for (const v of ["22.0.0", "22.12.0", "23.1.0", "24.0.0", "30.2.1"]) expect(checkNode(v), v).toBeNull();
  });

  it("030:FR-015: an unreadable version is treated as too old, not as fine", () => {
    expect(checkNode("")).toMatch(/Node\.js 22 or newer/);
    expect(checkNode("not-a-version")).toMatch(/Node\.js 22 or newer/);
  });

  it("030:FR-015: the guard module has no imports, so it can run before the CLI loads", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(import.meta.dirname, "..", "..", "src", "cli", "node-guard.ts"), "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
  });
});
