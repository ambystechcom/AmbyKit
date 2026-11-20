import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeDependencies, syncLanesWithFeature } from "../../src/cli/run-fleet-merge.js";
import { LaneCommand } from "../../src/cli/lane.js";
import { git } from "../../src/core/git.js";
import { laneRefs } from "../../src/core/query.js";
import { commitIn, gitFleetProject } from "../helpers/fleet-run-fixture.js";
import { runCommand } from "../helpers/run-command.js";

const A = { dir: "031-a", tasks: [{ id: "T001", paths: ["src/a.ts"] }] };
const B = { dir: "032-b", tasks: [{ id: "T001", paths: ["src/b.ts"] }] };

describe("dependency merge before a dependent starts (feature 031)", () => {
  it("031:FR-007: the finished feature's branch is merged into the dependent's checkout, which then has its work", () => {
    const p = gitFleetProject([A, B]);
    commitIn(p, "031-a", "src/a.ts", "export const a = 1;\n");
    const out = mergeDependencies(p.root, "032-b", ["031-a"]);
    expect(out).toEqual({ ok: true, merged: ["031-a"] });
    expect(readFileSync(join(p.roots["032-b"]!, "src/a.ts"), "utf8")).toContain("a = 1");
  });

  it("031:FR-004: a second merge of the same feature is a no-op", () => {
    const p = gitFleetProject([A, B]);
    commitIn(p, "031-a", "src/a.ts", "x\n");
    mergeDependencies(p.root, "032-b", ["031-a"]);
    expect(mergeDependencies(p.root, "032-b", ["031-a"])).toEqual({ ok: true, merged: [] });
  });

  it("031:FR-013: a real conflict aborts the merge, names the files and leaves the dependent's checkout clean", () => {
    const p = gitFleetProject([A, B]);
    commitIn(p, "031-a", "src/shared.ts", "from a\n");
    commitIn(p, "032-b", "src/shared.ts", "from b\n");
    const out = mergeDependencies(p.root, "032-b", ["031-a"]);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.on).toBe("031-a");
      expect(out.files).toEqual(["src/shared.ts"]);
      expect(out.reason).toContain("conflicts in src/shared.ts");
    }
    expect(git(p.roots["032-b"]!, ["status", "--porcelain"])).toBe("");
    expect(existsSync(join(p.roots["032-b"]!, ".git"))).toBe(true);
    expect(readFileSync(join(p.roots["032-b"]!, "src/shared.ts"), "utf8")).toBe("from b\n");
  });

  it("031:FR-013: a dependent with uncommitted changes is refused, not merged over", () => {
    const p = gitFleetProject([A, B]);
    commitIn(p, "031-a", "src/a.ts", "x\n");
    writeFileSync(join(p.roots["032-b"]!, "scratch.txt"), "wip\n");
    const out = mergeDependencies(p.root, "032-b", ["031-a"]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("uncommitted changes");
  });

  it("031:FR-007: a feature with no branch to merge is reported by name", () => {
    const p = gitFleetProject([B]);
    const out = mergeDependencies(p.root, "032-b", ["031-a"]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("031-a has no branch");
  });

  it("031:FR-007: prepared lanes are brought up to the feature branch so a worker sees the dependency's work", async () => {
    const p = gitFleetProject([A, { ...B, tasks: [{ id: "T001", paths: ["src/b1.ts"] }, { id: "T002", paths: ["src/b2.ts"] }] }]);
    await runCommand(new LaneCommand(), p.root, ["032-b"], { lanes: "2" });
    commitIn(p, "031-a", "src/a.ts", "dep\n");
    mergeDependencies(p.root, "032-b", ["031-a"]);
    const sync = syncLanesWithFeature(p.root, "032-b");
    expect(sync.ok && sync.merged.length).toBe(2);
    for (const lane of laneRefs(p.root, "032-b")) expect(readFileSync(join(lane.root, "src/a.ts"), "utf8")).toBe("dep\n");
  });
});
