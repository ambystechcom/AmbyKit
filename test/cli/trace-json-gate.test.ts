import { describe, expect, it } from "vitest";
import { runTrace, specWith, traceFixture } from "../helpers/trace-fixture.js";

const mk = (files: Record<string, string>, tests?: string) =>
  traceFixture({
    specs: { "019-a": { "spec.md": specWith("FR-001", "FR-002"), ...(tests ? { "tests.md": tests } : {}) } },
    files,
  });

describe("trace --json and --gate", () => {
  const partial = mk({ "t/a.test.ts": `it("019:FR-001: x", () => {});\nit("plain", () => {});` });

  it("024:FR-008: --json prints the versioned shape", async () => {
    const { out, code } = await runTrace(partial, [], { json: true });
    expect(code).toBe(0);
    const r = JSON.parse(out);
    expect(r.version).toBe(1);
    expect(Object.keys(r).sort()).toEqual(["ambiguous", "features", "orphans", "skipped", "uncited", "version"]);
    expect(r.features[0]).toMatchObject({ feature: "019-a", ref: "019", hasRequirements: true, coverage: { covered: 1, total: 2, uncovered: 1, deliberate: 0 } });
    expect(r.features[0].requirements[0]).toMatchObject({ id: "FR-001", qid: "019:FR-001", status: "covered" });
    expect(r.uncited[0]).toMatchObject({ title: "plain", reason: "no-id" });
  });

  it("024:FR-009: --gate exits 1 when a requirement is uncovered", async () => {
    expect((await runTrace(partial, [], { gate: true })).code).toBe(1);
  });

  it("024:FR-009: --gate exits 0 on full coverage", async () => {
    const full = mk({ "t/a.test.ts": `it("019:FR-001, 019:FR-002: x", () => {});` });
    expect((await runTrace(full, [], { gate: true })).code).toBe(0);
  });

  it("024:FR-009: without --gate an uncovered requirement still exits 0", async () => {
    expect((await runTrace(partial)).code).toBe(0);
  });

  it("024:FR-010: a deliberately uncovered requirement does not trip the gate", async () => {
    const root = mk({ "t/a.test.ts": `it("019:FR-001: x", () => {});` }, "uncovered: FR-002 — needs a human\n");
    const { code, out } = await runTrace(root, [], { gate: true, json: true });
    expect(code).toBe(0);
    expect(JSON.parse(out).features[0].requirements[1]).toMatchObject({ status: "deliberate", reason: "needs a human" });
  });

  it("024:FR-010: a note in spec.md counts when the feature has no tests.md", async () => {
    const root = traceFixture({
      specs: { "019-a": specWith("FR-001") + "\nuncovered: FR-001 — manual only\n" },
    });
    expect((await runTrace(root, [], { gate: true })).code).toBe(0);
  });
});
