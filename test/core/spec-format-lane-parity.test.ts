import { describe, expect, it } from "vitest";
import { declarations, laneConflicts, manifestDrift, mergeCheckoffs, planLanes, type LaneManifest } from "../../src/core/lanes.js";
import { readTasks } from "../../src/core/spec-format/dispatch.js";

/** A 1.x tasks.md and its v2 twin: the same two phases, parallel tasks, one cross-task overlap in phase 2. */
const V1 = [
  "---",
  "feature: 900-lanes",
  "---",
  "",
  "## Phase 1 — Setup",
  "",
  "- [x] [T001] Scaffold (src/a.ts)",
  "- [ ] [T002] [P] Left (src/left.ts)",
  "- [ ] [T003] [P] Right (src/right.ts, test/right.test.ts)",
  "- [ ] [T004] Glue (src/glue.ts)",
  "",
  "## Phase 2 — Overlap",
  "",
  "- [ ] [T010] [P] One (src/shared.ts)",
  "- [ ] [T011] [P] Two (src/shared.ts)",
  "- [ ] [T012] [P] Three (docs/x.md)",
  "",
].join("\n");

const V2 = [
  "---",
  "format: 2",
  "feature: 900-lanes",
  "---",
  "",
  "## Phase 1 — Setup",
  "",
  "- [x] [T001] Scaffold",
  "- [ ] [T002] [P] Left",
  "- [ ] [T003] [P] Right",
  "- [ ] [T004] Glue",
  "```yaml",
  "files:",
  "  T001: [src/a.ts]",
  "  T002: [src/left.ts]",
  "  T003: [src/right.ts, test/right.test.ts]",
  "  T004: [src/glue.ts]",
  "```",
  "",
  "## Phase 2 — Overlap",
  "",
  "- [ ] [T010] [P] One",
  "- [ ] [T011] [P] Two",
  "- [ ] [T012] [P] Three",
  "```yaml",
  "files:",
  "  T010: [src/shared.ts]",
  "  T011: [src/shared.ts]",
  "  T012: [docs/x.md]",
  "```",
  "",
].join("\n");

const t1 = readTasks(V1).tasks;
const t2 = readTasks(V2).tasks;

describe("lane planning reads v2 ownership exactly as 1.x (030, US-2)", () => {
  it("030:FR-002: declarations and conflicts are the same on the twins", () => {
    expect(readTasks(V2).format).toBe(2);
    expect(declarations("900-lanes", t2)).toEqual(declarations("900-lanes", t1));
    const c1 = laneConflicts("900-lanes", t1);
    expect(c1.length).toBeGreaterThan(0);
    expect(laneConflicts("900-lanes", t2)).toEqual(c1);
  });

  it("030:FR-018: the lane plan for a conflict-free phase is identical, and a conflicting phase is refused identically", () => {
    expect(planLanes("900-lanes", t2, { phase: 1, lanes: 2 })).toEqual(planLanes("900-lanes", t1, { phase: 1, lanes: 2 }));
    const refused = planLanes("900-lanes", t2, { phase: 2 });
    expect(refused.status).toBe("conflict");
    expect(refused).toEqual(planLanes("900-lanes", t1, { phase: 2 }));
  });

  it("030:FR-018: a manifest written from the 1.x form shows no drift against the v2 form of the same feature", () => {
    const plan = planLanes("900-lanes", t1, { phase: 1, lanes: 2 });
    const manifest: LaneManifest = {
      feature: "900-lanes",
      phase: 1,
      lane: plan.lanes[0]!.name,
      index: 1,
      tasks: plan.lanes.flatMap((l) => l.tasks),
    } as unknown as LaneManifest;
    expect(manifestDrift(manifest, t1)).toEqual([]);
    expect(manifestDrift(manifest, t2)).toEqual([]);
  });

  it("030:FR-018: manifest drift is reported when a v2 block changes a task's ownership", () => {
    const plan = planLanes("900-lanes", t2, { phase: 1, lanes: 2 });
    const manifest = { feature: "900-lanes", phase: 1, lane: plan.lanes[0]!.name, index: 1, tasks: plan.lanes.flatMap((l) => l.tasks) } as unknown as LaneManifest;
    const changed = readTasks(V2.replace("T002: [src/left.ts]", "T002: [src/elsewhere.ts]")).tasks;
    expect(manifestDrift(manifest, changed)).toEqual(["T002"]);
  });

  it("030:FR-018: the check-off merge unions the ticks of two v2 lanes", () => {
    const ours = V2.replace("- [ ] [T002] [P] Left", "- [x] [T002] [P] Left");
    const theirs = V2.replace("- [ ] [T003] [P] Right", "- [x] [T003] [P] Right");
    const merged = mergeCheckoffs(V2, ours, theirs);
    expect(merged).not.toBeNull();
    const done = readTasks(merged ?? "").tasks.filter((t) => t.done).map((t) => t.id);
    expect(done).toEqual(["T001", "T002", "T003"]);
  });

  it("030:FR-018: the check-off merge refuses (null) when one lane also changed ownership in a block", () => {
    const ours = V2.replace("- [ ] [T002] [P] Left", "- [x] [T002] [P] Left");
    const theirs = V2.replace("T003: [src/right.ts, test/right.test.ts]", "T003: [src/right.ts]");
    expect(mergeCheckoffs(V2, ours, theirs)).toBeNull();
  });
});
