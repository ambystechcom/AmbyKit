import { describe, expect, it } from "vitest";
import { runTrace, specWith, traceFixture } from "../helpers/trace-fixture.js";

const root = traceFixture({
  specs: {
    "019-a": specWith("FR-001", "FR-002", "FR-003"),
    "020-b": specWith("FR-001"),
    "021-c": "---\nfeature: c\n---\n# Spec\nno requirements here\n",
  },
  files: {
    "test/a.test.ts": [
      `it("019:FR-001: first", () => {});`,
      `it("019:FR-003: third", () => {});`,
      `it("019:FR-099: gone", () => {});`,
      `it("plain old test (FR-001)", () => {});`,
      `it("020:FR-001: other", () => {});`,
    ].join("\n"),
  },
});

describe("ambykit trace", () => {
  it("024:FR-001: reports each requirement covered with the tests that cite it", async () => {
    const { out, code } = await runTrace(root);
    expect(code).toBe(0);
    expect(out).toContain("019-a: 2/3 covered (1 uncovered)");
    expect(out).toMatch(/covered\s+FR-001\s+test\/a\.test\.ts:1/);
  });

  it("024:FR-003: lists an uncovered requirement with its id and text", async () => {
    const { out } = await runTrace(root);
    expect(out).toMatch(/uncovered\s+FR-002\s+THE SYSTEM SHALL do FR-002\./);
  });

  it("024:FR-004: lists a test citing an unknown id as an orphan", async () => {
    const { out } = await runTrace(root);
    expect(out).toContain("Orphans (1)");
    expect(out).toContain("019:FR-099");
  });

  it("024:FR-005: lists a test citing nothing as uncited, apart from orphans", async () => {
    const { out } = await runTrace(root);
    expect(out).toContain("Uncited tests: 1");
    expect(out).toContain("plain old test (FR-001)");
  });

  it("024:FR-006: one feature argument reports only that feature (by number or directory)", async () => {
    for (const arg of ["019", "019-a"]) {
      const { out } = await runTrace(root, [arg]);
      expect(out).toContain("019-a:");
      expect(out).not.toContain("020-b:");
    }
  });

  it("024:FR-006: an unknown feature argument fails", async () => {
    expect((await runTrace(root, ["777"])).code).toBe(1);
  });

  it("024:FR-003: a feature with no requirements says so and reports nothing uncovered", async () => {
    const { out } = await runTrace(root, ["021"]);
    expect(out).toContain("021-c: no requirements");
    expect(out).not.toContain("uncovered");
  });
});
