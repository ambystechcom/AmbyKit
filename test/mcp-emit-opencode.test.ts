import { describe, expect, it } from "vitest";
import { buildEmittedFiles, mcpUnwritten } from "../src/core/emit.js";
import { tempProject } from "./helpers/emit-target.js";

describe("OpenCode MCP config (feature 025, T064)", () => {
  it("025:FR-018: nothing is written for OpenCode: two incompatible schemas are documented and none is confirmed", () => {
    const files = buildEmittedFiles(tempProject(), { version: "0.0.0", tools: ["opencode"], mcp: { enabled: true } });
    expect(files.filter((f) => f.merge === "json")).toEqual([]);
    expect(files.map((f) => f.path)).not.toContain("opencode.json");
  });

  it("025:FR-018: sync is told why, so the gap is never silent", () => {
    const [gap] = mcpUnwritten({ version: "0.0.0", tools: ["opencode"], mcp: { enabled: true } });
    expect(gap).toMatchObject({ tool: "opencode" });
    expect(gap!.reason).toMatch(/two incompatible/);
  });
});
