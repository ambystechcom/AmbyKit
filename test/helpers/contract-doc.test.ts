import { describe, expect, it } from "vitest";
import { contractFor, parseContractBlocks } from "./contract-doc.js";

describe("contract document reader (feature 033)", () => {
  const doc = [
    "# Stability",
    "",
    "```contract",
    '{ "surface": "run", "flags": ["--yes", "--json"], "exitCodes": [0, 1] }',
    "```",
    "",
    "Prose between blocks.",
    "",
    "```json",
    '{ "not": "a contract block" }',
    "```",
    "",
    "```contract",
    '{ "surface": "run", "flags": ["--json", "--emit-script"], "stateFiles": [".amby/fleet/"] }',
    "```",
    "```contract",
    '{ "surface": "plugin", "exports": ["PLUGIN_API_VERSION"] }',
    "```",
  ].join("\n");

  it("033:FR-001: reads every contract block and ignores other fences", () => {
    const blocks = parseContractBlocks(doc);
    expect(blocks.map((b) => b.surface)).toEqual(["run", "run", "plugin"]);
  });

  it("033:FR-001: merges the blocks of one surface without duplicates, keeping order", () => {
    const run = contractFor(parseContractBlocks(doc), "run");
    expect(run.flags).toEqual(["--yes", "--json", "--emit-script"]);
    expect(run.exitCodes).toEqual([0, 1]);
    expect(run.stateFiles).toEqual([".amby/fleet/"]);
  });

  it("033:FR-001: a surface with no block is empty, not an error", () => {
    expect(contractFor(parseContractBlocks(doc), "kit")).toEqual({ surface: "kit" });
  });

  it("033:FR-001: invalid JSON or a missing surface fails with the line of the block", () => {
    expect(() => parseContractBlocks("a\n\n```contract\n{ nope\n```")).toThrow(/line 3.*not valid JSON/);
    expect(() => parseContractBlocks('```contract\n{ "flags": [] }\n```')).toThrow(/needs a string `surface`/);
  });
});
