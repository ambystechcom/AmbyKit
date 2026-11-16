import { describe, expect, it } from "vitest";
import { parseDeliberate, parseRequirements } from "../../src/core/trace-requirements.js";

describe("trace requirements", () => {
  it("024:FR-001: reads FR ids with their text, once each", () => {
    const rs = parseRequirements("- FR-001  THE SYSTEM SHALL a.\nFR-002 WHEN b\n- FR-001 dup\nsee FR-009 inline");
    expect(rs).toEqual([
      { id: "FR-001", text: "THE SYSTEM SHALL a." },
      { id: "FR-002", text: "WHEN b" },
    ]);
  });

  it("024:FR-010: reads deliberately-uncovered notes in both 021 forms", () => {
    const m = parseDeliberate("uncovered: FR-003 — manual only\n- FR-004: deliberately uncovered — visual");
    expect(m.get("FR-003")).toBe("manual only");
    expect(m.get("FR-004")).toBe("visual");
  });
});
