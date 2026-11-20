import { describe, expect, it } from "vitest";
import { planJson, planLines } from "../../src/core/fleet-plan/format.js";
import { buildFleetPlan } from "../../src/core/fleet-plan/plan.js";
import { model, type FeatureDef } from "../helpers/fleet-plan-fixture.js";

function text(defs: FeatureDef[]): { lines: string; json: ReturnType<typeof planJson> } {
  const r = buildFleetPlan({ args: defs.map((d) => d.dir), models: defs.map(model), deps: [], done: new Set(), caps: { total: 3, perType: 2 }, budgets: { wallClockMinutes: 60, maxTasks: 50 } });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return { lines: planLines(r.value).join("\n"), json: planJson(r.value) };
}

const own = (dir: string, ...files: string[]): FeatureDef => ({ dir, tasks: files.map((p, i) => ({ id: `T00${i + 1}`, paths: [p] })) });

describe("fleet plan preview of serialization (feature 031, US-2)", () => {
  it("031:FR-005: each serialization names every shared file that caused it", () => {
    const { lines } = text([
      { dir: "031-a", tasks: [{ id: "T001", paths: ["src/x.ts"] }, { id: "T002", paths: ["src/y.ts"] }] },
      { dir: "032-b", tasks: [{ id: "T001", paths: ["src/x.ts", "src/y.ts"] }] },
    ]);
    expect(lines).toContain("032-b — 2 lanes — waits for 031-a (shared files: src/x.ts, src/y.ts)");
  });

  it("031:FR-005: a directory owned by one feature serializes the features that edit files under it", () => {
    const { lines } = text([
      { dir: "031-a", tasks: [{ id: "T001", paths: ["src/core"] }] },
      { dir: "032-b", tasks: [{ id: "T001", paths: ["src/core/a.ts"] }] },
    ]);
    expect(lines).toContain("shared files: src/core/a.ts");
  });

  it("031:FR-006: a flagged feature shows `unknown ownership: T###` and its wait says why", () => {
    const { lines } = text([
      { dir: "031-a", tasks: [{ id: "T001", paths: ["src/a.ts"] }] },
      { dir: "032-b", tasks: [{ id: "T007", paths: null }] },
    ]);
    expect(lines).toContain("unknown ownership: T007");
    expect(lines).toContain("waits for 031-a (unknown ownership)");
  });

  it("031:FR-004: independent features list no wait at all", () => {
    const { lines } = text([own("031-a", "src/a.ts"), own("032-b", "src/b.ts")]);
    expect(lines.match(/starts first/g)).toHaveLength(2);
    expect(lines).not.toContain("waits for");
  });

  it("031:FR-005: the JSON preview carries the shared files and the unknown task ids", () => {
    const { json } = text([
      { dir: "031-a", tasks: [{ id: "T001", paths: ["src/x.ts"] }] },
      { dir: "032-b", tasks: [{ id: "T001", paths: ["src/x.ts"] }, { id: "T002", paths: null }] },
    ]);
    const f = (json as { features: { waitsFor: { why: string; files?: string[] }[]; ownership: { unknown: string[] } }[] }).features[1]!;
    expect(f.waitsFor).toHaveLength(1);
    expect(f.waitsFor[0]).toMatchObject({ why: "shared-files" });
    expect(f.ownership.unknown).toEqual(["T002"]);
  });
});
