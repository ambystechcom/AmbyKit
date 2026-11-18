import { describe, expect, it } from "vitest";
import * as fleet from "../../src/core/fleet/index.js";
import { REPORT_CADENCE, DIRECTIVE_PROTOCOL } from "../../src/mcp/tools/fleet.js";

// The exports 028 imports from spec 025 and 019. If one goes missing this fails first, naming it.
const USED = [
  "createRun",
  "updateRun",
  "readRun",
  "listRuns",
  "resolveRun",
  "restoreRun",
  "runDir",
  "ensureFleetRoot",
  "writeDirective",
  "readDirective",
  "directiveStatus",
  "laneStatus",
  "claimFiles",
  "releaseClaims",
  "releaseTaskClaims",
  "readClaims",
  "postNote",
  "withLock",
  "writeFileAtomic",
  "freeSlots",
  "nextRoundAction",
  "parseVerdict",
  "verdictPath",
  "rebuildFromTasks",
  "recordOverlap",
  "determinePhase",
] as const;

describe("028 depends on spec 025's fleet state", () => {
  it.each(USED)("028:FR-017: %s is exported", (name) => {
    expect(typeof (fleet as Record<string, unknown>)[name]).toBe("function");
  });

  it("028:FR-016: the worker wording 028's prompts reuse is exported by 025", () => {
    expect(REPORT_CADENCE.length).toBeGreaterThan(20);
    expect(DIRECTIVE_PROTOCOL).toContain("pause or stop");
  });
});
