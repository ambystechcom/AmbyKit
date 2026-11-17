import { describe, expect, it } from "vitest";
import { buildEmittedFiles } from "../src/core/emit.js";
import { tempProject } from "./helpers/emit-target.js";

describe("Copilot (VS Code) MCP config (feature 025, T065)", () => {
  it("025:FR-018: writes .vscode/mcp.json with servers.ambykit (a `servers` key, not `mcpServers`)", () => {
    const files = buildEmittedFiles(tempProject(), { version: "0.0.0", tools: ["copilot"], mcp: { enabled: true } }).filter((f) => f.merge === "json");
    expect(files).toEqual([
      {
        path: ".vscode/mcp.json",
        scope: "project",
        merge: "json",
        contents: JSON.stringify({ servers: { ambykit: { type: "stdio", command: "ambykit", args: ["mcp"] } } }, null, 2) + "\n",
      },
    ]);
  });
});
