import { describe, expect, it } from "vitest";
import { buildEmittedFiles, mcpUnwritten } from "../src/core/emit.js";
import { TARGETS } from "../src/emitters/index.js";
import { tempProject } from "./helpers/emit-target.js";

const ALL = TARGETS.map((t) => t.id);
const config = (tools: string[], mcp?: { enabled: boolean }) => ({ version: "0.0.0", tools, ...(mcp ? { mcp } : {}) });
const jsonFiles = (tools: string[], mcp?: { enabled: boolean }) =>
  buildEmittedFiles(tempProject(), config(tools, mcp)).filter((f) => f.merge === "json");

describe("MCP emission is opt-in and per tool (feature 025)", () => {
  it("025:FR-017: without mcp.enabled no target emits anything MCP, and the output is the same as before", () => {
    expect(jsonFiles(ALL)).toEqual([]);
    expect(jsonFiles(ALL, { enabled: false })).toEqual([]);
    const off = buildEmittedFiles(tempProject(), config(ALL));
    const explicitOff = buildEmittedFiles(tempProject(), config(ALL, { enabled: false }));
    expect(explicitOff.map((f) => [f.path, f.contents])).toEqual(off.map((f) => [f.path, f.contents]));
  });

  it("025:FR-018: with mcp.enabled only the verified targets emit a project or user MCP file", () => {
    const files = jsonFiles(ALL, { enabled: true });
    expect(files.map((f) => f.path).sort()).toEqual([".agents/mcp_config.json", ".copilot/mcp-config.json", ".cursor/mcp.json", ".mcp.json", ".vscode/mcp.json"]);
  });

  it("025:FR-018: user-level files are scoped user; everything else is project-scoped", () => {
    const files = jsonFiles(ALL, { enabled: true });
    expect(files.filter((f) => f.scope === "user").map((f) => f.path)).toEqual([".copilot/mcp-config.json"]);
    expect(files.filter((f) => f.scope === "project").every((f) => !/^([/~]|[A-Za-z]:|\.\.)/.test(f.path))).toBe(true);
  });

  it("025:FR-019: Cursor and Cursor CLI share one file and it is emitted once", () => {
    expect(jsonFiles(["cursor", "cursor-cli"], { enabled: true }).filter((f) => f.path === ".cursor/mcp.json")).toHaveLength(1);
    expect(jsonFiles(["cursor-cli"], { enabled: true }).map((f) => f.path)).toEqual([".cursor/mcp.json"]);
  });

  it("025:FR-018: the Copilot CLI gets its user-level file only, not the VS Code workspace file", () => {
    expect(jsonFiles(["copilot-cli"], { enabled: true }).map((f) => f.path)).toEqual([".copilot/mcp-config.json"]);
    expect(jsonFiles(["copilot"], { enabled: true }).map((f) => f.path)).toEqual([".vscode/mcp.json"]);
  });

  it("025:FR-018: mcpUnwritten names each enabled target with no verified format, and the reason", () => {
    const gaps = mcpUnwritten(config(["claude", "opencode", "codex", "antigravity", "antigravity-cli"], { enabled: true }));
    expect(gaps.map((g) => g.tool).sort()).toEqual(["antigravity", "codex", "opencode"]);
    expect(gaps.every((g) => g.reason.length > 10)).toBe(true);
    expect(mcpUnwritten(config(["claude", "opencode"]))).toEqual([]); // disabled: nothing to say
  });

  it("025:FR-018: every target is either verified (a file) or has a stated reason, never both, never neither", () => {
    for (const id of ALL) {
      const files = jsonFiles([id], { enabled: true });
      const gaps = mcpUnwritten(config([id], { enabled: true }));
      expect(files.length > 0 !== gaps.length > 0, id).toBe(true);
    }
  });
});
