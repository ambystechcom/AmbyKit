import { describe, expect, it } from "vitest";
import { buildEmittedFiles } from "../src/core/emit.js";
import { tempProject } from "./helpers/emit-target.js";

const expected = {
  path: ".cursor/mcp.json",
  scope: "project",
  merge: "json",
  contents: JSON.stringify({ mcpServers: { ambykit: { type: "stdio", command: "ambykit", args: ["mcp"] } } }, null, 2) + "\n",
};
const mcpOf = (tools: string[]) =>
  buildEmittedFiles(tempProject(), { version: "0.0.0", tools, mcp: { enabled: true } }).filter((f) => f.merge === "json");

describe("Cursor MCP config (feature 025, T066)", () => {
  it("025:FR-018: writes .cursor/mcp.json with mcpServers.ambykit", () => {
    expect(mcpOf(["cursor"])).toEqual([expected]);
  });

  it("025:FR-018: the Cursor CLI reads the same file, so it emits the same bytes", () => {
    expect(mcpOf(["cursor-cli"])).toEqual([expected]);
  });
});
