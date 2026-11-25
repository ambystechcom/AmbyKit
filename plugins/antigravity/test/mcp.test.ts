import { describe, expect, it } from "vitest";
import { buildEmittedFiles, mcpUnwritten } from "../../../src/core/emit.js";
import { tempProject } from "../../../test/helpers/emit-target.js";
import { pluginRegistry } from "./helpers.js";

const mcpOf = (tools: string[]) =>
  buildEmittedFiles(tempProject(), { version: "0.0.0", tools, mcp: { enabled: true } }, pluginRegistry).filter((f) => f.merge === "json");

describe("Antigravity MCP config (feature 025, T068; moved here in feature 036)", () => {
  it("025:FR-018: the CLI's verified workspace file .agents/mcp_config.json gets mcpServers.ambykit without a type", () => {
    expect(mcpOf(["antigravity-cli"])).toEqual([
      {
        path: ".agents/mcp_config.json",
        scope: "project",
        merge: "json",
        contents: JSON.stringify({ mcpServers: { ambykit: { command: "ambykit", args: ["mcp"] } } }, null, 2) + "\n",
      },
    ]);
  });

  it("025:FR-018: the IDE is not written (location unconfirmed), and sync is told why", () => {
    expect(mcpOf(["antigravity"])).toEqual([]);
    const [gap] = mcpUnwritten({ version: "0.0.0", tools: ["antigravity"], mcp: { enabled: true } }, pluginRegistry);
    expect(gap).toMatchObject({ tool: "antigravity" });
    expect(gap!.reason).toMatch(/unconfirmed/);
  });

  it("025:FR-018: with both enabled only the CLI writes, so the shared .agents/ file has one owner", () => {
    expect(mcpOf(["antigravity", "antigravity-cli"]).map((f) => f.path)).toEqual([".agents/mcp_config.json"]);
  });
});
