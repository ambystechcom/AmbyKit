import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE_FEATURE, modelOfSpecs } from "../helpers/spec-model.js";

/**
 * 030 baseline: the model the SHIPPED 1.x parsers produce for every spec of this repo (features 001-029; 030 itself
 * changes while it is built). Regenerate with UPDATE_BASELINE_030=1 only when a spec outside 030 legitimately changes.
 * Phase 2+ readers (the dispatcher) must keep reproducing this exactly (030:FR-012, FR-018).
 */
const root = join(import.meta.dirname, "..", "..");
const file = join(root, "test", "fixtures", "spec-model-v1.json");

describe("spec model baseline (030, phase 1)", () => {
  it("030:FR-012: the shipped parsers still produce the committed model of every own spec", () => {
    const now = modelOfSpecs(join(root, "specs"), undefined, BASELINE_FEATURE);
    if (process.env["UPDATE_BASELINE_030"]) writeFileSync(file, JSON.stringify(now, null, 1) + "\n");
    const recorded = JSON.parse(readFileSync(file, "utf8")) as typeof now;
    expect(Object.keys(now).length).toBeGreaterThan(20);
    expect(now).toEqual(recorded);
  });
});
