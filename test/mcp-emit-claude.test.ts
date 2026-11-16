import { describe, expect, it } from "vitest";
import { buildEmittedFiles } from "../src/core/emit.js";
import { tempProject } from "./helpers/emit-target.js";

const mcpOf = (tools: string[]) =>
  buildEmittedFiles(tempProject(), { version: "0.0.0", tools, mcp: { enabled: true } }).filter((f) => f.merge === "json");

describe("Claude Code MCP config (feature 025, T063)", () => {
  it("025:FR-018: writes .mcp.json with mcpServers.ambykit as a stdio server (verified in research.md)", () => {
    const [file, ...rest] = mcpOf(["claude"]);
    expect(rest).toEqual([]);
    expect(file).toEqual({
      path: ".mcp.json",
      scope: "project",
      merge: "json",
      contents: JSON.stringify({ mcpServers: { ambykit: { type: "stdio", command: "ambykit", args: ["mcp"] } } }, null, 2) + "\n",
    });
  });

  it("025:FR-018: the command is `ambykit mcp`, never a network `npx` fetch", () => {
    const text = mcpOf(["claude"])[0]!.contents;
    expect(text).not.toMatch(/npx|http/);
  });

  it("025:FR-017: the same target without mcp.enabled emits no .mcp.json", () => {
    const files = buildEmittedFiles(tempProject(), { version: "0.0.0", tools: ["claude"] });
    expect(files.map((f) => f.path)).not.toContain(".mcp.json");
  });
});
