import { describe, expect, it } from "vitest";
import { TARGETS } from "../../src/emitters/index.js";
import { SUBAGENT_SUPPORT, hasWorkerFormat, loadWorkerAgent, parseWorkerAgent, supportsSubagents } from "../../src/core/subagents.js";

describe("subagent support table", () => {
  it("019:FR-022: covers every selectable target id, and nothing else", () => {
    expect(Object.keys(SUBAGENT_SUPPORT).sort()).toEqual(TARGETS.map((t) => t.id).sort());
  });

  it("019:FR-022: every entry names its source, and only a confirmed target counts as supported", () => {
    for (const [id, s] of Object.entries(SUBAGENT_SUPPORT)) {
      expect(s.source.length, id).toBeGreaterThan(5);
      expect(supportsSubagents(id), id).toBe(s.status === "confirmed");
    }
    expect(supportsSubagents("nonexistent-tool")).toBe(false);
  });

  it("019:FR-022: only the targets with a verified agent-file format get the worker persona", () => {
    const withFormat = Object.keys(SUBAGENT_SUPPORT).filter(hasWorkerFormat).sort();
    expect(withFormat).toEqual(["claude", "claude-vscode", "copilot", "copilot-cli", "opencode"]);
  });

  it("019:FR-021: at launch Claude Code is the only family confirmed; every other target uses the fallback", () => {
    const confirmed = Object.keys(SUBAGENT_SUPPORT).filter(supportsSubagents).sort();
    expect(confirmed).toEqual(["claude", "claude-vscode"]);
  });
});

describe("worker persona", () => {
  it("019:FR-004: the shipped worker has an id, a name, a description and a body", () => {
    const w = loadWorkerAgent();
    expect(w).toMatchObject({ id: "worker", name: "Worker" });
    expect(w.description.length).toBeGreaterThan(10);
    expect(w.body).toContain("one line");
  });

  it("019:FR-004: a persona without an id, name or description is refused", () => {
    expect(() => parseWorkerAgent("---\nid: x\n---\nbody", "x.md")).toThrow(/required/);
  });
});
