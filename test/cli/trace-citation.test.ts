import { describe, expect, it } from "vitest";
import { runTrace, specWith, traceFixture } from "../helpers/trace-fixture.js";

describe("trace citation convention", () => {
  const root = traceFixture({
    specs: { "019-a": specWith("FR-001", "FR-002", "FR-004"), "020-b": specWith("FR-004") },
    files: {
      "t/a.test.ts": [
        `it("019:FR-001, 019:FR-002: both in one", () => {});`,
        `it("FR-004: bare and ambiguous", () => {});`,
        `it("legacy style (FR-004)", () => {});`,
        `it.skip("020:FR-004: skipped", () => {});`,
      ].join("\n"),
    },
  });

  it("024:FR-002: a test citing several ids covers each", async () => {
    const { out } = await runTrace(root, ["019"]);
    expect(out).toContain("019-a: 2/3 covered");
  });

  it("024:FR-007: a bare id defined by two features is reported ambiguous and matches none", async () => {
    const { out } = await runTrace(root);
    expect(out).toContain("Ambiguous (1)");
    expect(out).toContain("FR-004 in 019, 020");
    expect(out).toContain("020-b: 0/1 covered (1 uncovered)");
  });

  it("024:FR-005: legacy suffix-style tests are uncited and nothing fails", async () => {
    const { out, code } = await runTrace(root);
    expect(code).toBe(0);
    expect(out).toContain("legacy style (FR-004)");
  });

  it("024:FR-003: a skipped test does not cover and is listed separately", async () => {
    const { out } = await runTrace(root);
    expect(out).toContain("Skipped (1)");
    expect(out).toContain("020-b: 0/1 covered");
  });
});
