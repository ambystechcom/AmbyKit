import { describe, expect, it } from "vitest";
import { buildEmittedFiles } from "../src/core/emit.js";
import { tempProject } from "./helpers/emit-target.js";

describe("Copilot CLI MCP config (feature 025, T067)", () => {
  const files = () => buildEmittedFiles(tempProject(), { version: "0.0.0", tools: ["copilot-cli"], mcp: { enabled: true } }).filter((f) => f.merge === "json");

  it("025:FR-018: is a user-level file with type local, the command and the required tools list", () => {
    expect(files()).toEqual([
      {
        path: ".copilot/mcp-config.json",
        scope: "user",
        merge: "json",
        contents: JSON.stringify({ mcpServers: { ambykit: { type: "local", command: "ambykit", args: ["mcp"], tools: ["*"] } } }, null, 2) + "\n",
      },
    ]);
  });

  it("025:FR-018: scope user means it is written only with explicit consent (--include-user)", () => {
    expect(files()[0]!.scope).toBe("user");
  });
});
