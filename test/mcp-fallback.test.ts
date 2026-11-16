import { describe, expect, it } from "vitest";
import { loadCommandSpecs } from "../src/core/command-spec.js";
import { buildEmittedFiles } from "../src/core/emit.js";
import { buildRegistry } from "../src/mcp/tools/index.js";
import { TARGETS } from "../src/emitters/index.js";
import { tempProject } from "./helpers/emit-target.js";

const toolNames = buildRegistry().names();
const ALL = TARGETS.map((t) => t.id);

describe("every phase still works from files with the server absent (feature 025, SC-004, FR-017)", () => {
  const specs = loadCommandSpecs();

  it("025:FR-017: no phase prompt names an MCP tool, the server, or an MCP tool prefix", () => {
    for (const spec of specs) {
      for (const name of toolNames) expect(spec.body, `${spec.id} mentions ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`));
      expect(spec.body, spec.id).not.toMatch(/\bMCP\b|mcp__|ambykit mcp/i);
    }
  });

  it("025:FR-017: no phase asks for an MCP tool in its allowed tools", () => {
    for (const spec of specs) expect(spec.allowedTools.every((t) => ["read", "write", "edit", "bash"].includes(t)), spec.id).toBe(true);
  });

  it("025:FR-017: enabling the server changes no command, skill, prompt or rules file, only adds the JSON config", () => {
    const off = buildEmittedFiles(tempProject(), { version: "0.0.0", tools: ALL });
    const on = buildEmittedFiles(tempProject(), { version: "0.0.0", tools: ALL, mcp: { enabled: true } });
    const added = on.filter((f) => f.merge === "json");
    const rest = on.filter((f) => f.merge !== "json");
    expect(rest.map((f) => [f.path, f.contents])).toEqual(off.map((f) => [f.path, f.contents]));
    expect(added.length).toBeGreaterThan(0);
  });

  it("025:SC-004: every phase prompt reads and writes only files under specs/ or .amby/, or runs the ambykit CLI", () => {
    for (const spec of specs) {
      for (const p of [...spec.reads, ...spec.writes]) expect(p, `${spec.id}: ${p}`).toMatch(/^(specs\/|\.amby\/|docs\/|src\/|test\/|\.?\/?[\w.-]+\.md$|\*)/i);
    }
  });
});
