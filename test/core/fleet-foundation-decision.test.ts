import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

describe("terminal-foundation decision (feature 029, FR-015)", () => {
  it("029:FR-015: ADR-004 records the decision, accepted, for this feature", () => {
    const adr = read(".amby", "decisions", "ADR-004.md");
    expect(adr).toMatch(/^id: ADR-004$/m);
    expect(adr).toMatch(/^status: accepted$/m);
    expect(adr).toMatch(/^feature: 029-fleet-control-room$/m);
    expect(adr).toMatch(/hand-rolled/i);
  });

  it("029:FR-015: the decisions index lists it", () => {
    expect(read(".amby", "decisions", "README.md")).toMatch(/\| ADR-004 \|.*Ink.*\| accepted \|/);
  });

  it("029:FR-015: the evidence is recorded: spike A measured, spike B stated as not measured, and a recommendation", () => {
    const research = read("specs", "029-fleet-control-room", "research.md");
    expect(research).toMatch(/Spike A/);
    expect(research).toMatch(/Spike B[^\n]*NOT measured/);
    expect(research).toMatch(/## Recommendation/);
    expect(research).toMatch(/ADR-004/);
  });
});
