import { describe, expect, it } from "vitest";
import { sharedOutputs } from "../src/emitters/index.js";

/** `sharedOutputs` groups owners by command directory (feature 018, FR-008). */
describe("sharedOutputs", () => {
  it("lists codex and pi as owners of .agents/skills", () => {
    expect(sharedOutputs(["codex", "pi"])).toEqual([{ dir: ".agents/skills", owners: ["codex", "pi"] }]);
  });

  it("is empty for targets with distinct directories", () => {
    expect(sharedOutputs(["claude", "codex", "kiro"])).toEqual([]);
  });

  it("does not count rules-only targets as owners of a directory", () => {
    expect(sharedOutputs(["cursor", "cursor-cli"])).toEqual([]);
  });

  it("still groups targets that share one emitter", () => {
    expect(sharedOutputs(["claude", "claude-vscode"])).toEqual([
      { dir: ".claude/commands", owners: ["claude", "claude-vscode"] },
    ]);
  });
});
