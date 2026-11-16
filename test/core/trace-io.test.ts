import { describe, expect, it } from "vitest";
import { findTestFiles, readTraceSources } from "../../src/core/trace-io.js";
import { specWith, traceFixture } from "../helpers/trace-fixture.js";

describe("trace io", () => {
  const root = traceFixture({
    specs: {
      "019-a": {
        "spec.md": specWith("FR-001", "FR-002"),
        "tests.md": "- [TC-001] [US-1#1] [FR-001] auto — works → ok\nuncovered: FR-002 — manual only\n",
      },
    },
    files: {
      "test/x.test.ts": `it("019:FR-001: x", () => {});`,
      "node_modules/p/y.test.ts": `it("ignored", () => {});`,
      "specs/019-a/z.test.ts": `it("ignored", () => {});`,
      "src/w.spec.js": `test("019:FR-002: w", () => {});`,
    },
  });

  it("024:FR-001: walks test files, skipping the ignore list", () => {
    expect(findTestFiles(root)).toEqual(["src/w.spec.js", "test/x.test.ts"]);
  });

  it("024:FR-001: reads requirements, deliberate notes, design and tests", () => {
    const s = readTraceSources(root);
    expect(s.features[0]!.requirements.map((r) => r.id)).toEqual(["FR-001", "FR-002"]);
    expect(s.features[0]!.deliberate.get("FR-002")).toBe("manual only");
    expect(s.designs.get("019-a")!.cases).toHaveLength(1);
    expect(s.tests.map((t) => t.title)).toEqual(["019:FR-002: w", "019:FR-001: x"]);
  });

  it("024:FR-001: honors the trace config roots and ignore", () => {
    const r = traceFixture({
      specs: { "019-a": specWith("FR-001") },
      files: { "a/x.test.ts": `it("1", () => {});`, "b/y.test.ts": `it("2", () => {});`, "a/skip/z.test.ts": `it("3", () => {});` },
      config: { trace: { roots: ["a"], ignore: ["skip"] } },
    });
    expect(readTraceSources(r).tests.map((t) => t.title)).toEqual(["1"]);
  });
});
