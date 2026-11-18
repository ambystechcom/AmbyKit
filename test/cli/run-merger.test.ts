import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readEvents, readLaneFile } from "../../src/cli/run-files.js";
import { parseTasks } from "../../src/core/dashboard.js";
import { readRun } from "../../src/core/fleet/index.js";
import { gitRun, HAS_GIT } from "../helpers/git-repo.js";
import { commitFile } from "../helpers/lane-fixture.js";
import { harness, preparedProject, script, tickIn } from "../helpers/run-fakes.js";

const F = "028-ambykit-run";

describe.skipIf(!HAS_GIT)("merger (feature 028)", () => {
  it("028:FR-011: a finished lane is merged with the check-off-aware merge and its check-offs reach the feature", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { work: true });
    await h.step();
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("merged");
    const tasks = parseTasks(readFileSync(join(p.featureRoot, "specs", F, "tasks.md"), "utf8"));
    expect(tasks.filter((t) => t.done).map((t) => t.id).sort()).toEqual(["T001", "T002", "T003", "T004"]);
    expect(gitRun(p.featureRoot, ["status", "--porcelain"])).toBe("");
  });

  it("028:FR-011: lanes merge one at a time in name order", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { work: true });
    await h.step();
    await h.step();
    const merged = readEvents(p.root, h.run).filter((e) => e.kind === "merged").map((e) => e.lane);
    expect(merged).toEqual(["lane-1-1", "lane-1-2"]);
    const log = gitRun(p.featureRoot, ["log", "--format=%s", "-6"]);
    expect(log.indexOf("Merge lane 028-ambykit-run.lane-1-2")).toBeLessThan(log.indexOf("Merge lane 028-ambykit-run.lane-1-1"));
  });

  it("028:FR-012: conflict: the first lane merges, the second pauses with the lane intact and the feature clean", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    const lane1 = h.lane("lane-1-1");
    const lane2 = h.lane("lane-1-2");
    // each lane has done its work and committed; lane 1-2 also edits shared.txt, which the feature changed too
    tickIn(lane1.ref.root, F, ["T001", "T003"]);
    commitFile(lane1.ref.root, "src/one.ts", "one\n", "lane 1 work");
    tickIn(lane2.ref.root, F, ["T002", "T004"]);
    commitFile(lane2.ref.root, "shared.txt", "from lane\n", "lane 2 work");
    commitFile(p.featureRoot, "shared.txt", "from feature\n", "feature edit");
    for (const rt of [lane1, lane2]) {
      rt.file.status = "ready";
    }
    await h.step();
    expect(lane1.file.status).toBe("merged");
    expect(lane2.file.status).toBe("conflict");
    expect(lane2.file.reason).toContain("shared.txt");
    expect(existsSync(lane2.ref.root)).toBe(true);
    expect(gitRun(p.root, ["branch", "--list", lane2.ref.name])).toContain(lane2.ref.name);
    expect(gitRun(p.featureRoot, ["status", "--porcelain"])).toBe("");
    const rec = readRun(p.root, h.run)!;
    expect(rec.status).toBe("waiting-person");
    expect(JSON.stringify(rec.escalations)).toContain("merge-conflict");
  });

  it("028:FR-012: a person resolves the conflict and the run carries on without a restart", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    const lane1 = h.lane("lane-1-1");
    const lane2 = h.lane("lane-1-2");
    tickIn(lane1.ref.root, F, ["T001", "T003"]);
    commitFile(lane1.ref.root, "src/one.ts", "one\n", "lane 1 work");
    tickIn(lane2.ref.root, F, ["T002", "T004"]);
    commitFile(lane2.ref.root, "shared.txt", "from lane\n", "lane 2 work");
    commitFile(p.featureRoot, "shared.txt", "from feature\n", "feature edit");
    lane1.file.status = "ready";
    lane2.file.status = "ready";
    await h.step();
    expect(lane2.file.status).toBe("conflict");
    // the person merges the feature into the lane, resolves the file, commits
    try {
      gitRun(lane2.ref.root, ["merge", F]);
    } catch {
      writeFileSync(join(lane2.ref.root, "shared.txt"), "resolved\n");
      gitRun(lane2.ref.root, ["add", "-A"]);
      gitRun(lane2.ref.root, ["commit", "-q", "-m", "resolve"]);
    }
    const startsBefore = h.port.starts.length;
    const out = await h.step();
    expect(lane2.file.status).toBe("merged");
    expect(h.port.starts.length).toBe(startsBefore);
    expect(out).toMatchObject({ kind: "done" });
    expect(readFileSync(join(p.featureRoot, "shared.txt"), "utf8")).toBe("resolved\n");
  });

  it("028:FR-011: a lane with tasks still open is never merged and the run reports it", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, (cwd) => ({ work: !cwd.endsWith("lane-1-2") }));
    await h.step();
    h.advance(1);
    const out = await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("merged");
    expect(h.lane("lane-1-2").file.status).toBe("unfinished");
    expect(out?.kind).toBe("attention");
    expect(out?.message).toContain("lane-1-2");
    expect(out?.message).toContain("unfinished");
  });

  it("028:SC-009: a lane whose phase Verify line failed is not merged even though its tasks are checked", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    const lane1 = h.lane("lane-1-1");
    const file = join(lane1.ref.root, "specs", F, "tasks.md");
    tickIn(lane1.ref.root, F, ["T001", "T003"]);
    writeFileSync(file, readFileSync(file, "utf8").replace(/\n*$/, "\n") + "**Verify:** `npm test` passes ✗ failed: 2 tests fail\n");
    gitRun(lane1.ref.root, ["add", "-A"]);
    gitRun(lane1.ref.root, ["commit", "-q", "-m", "work with failed verify"]);
    lane1.file.status = "ready";
    await h.step();
    expect(lane1.file.status).toBe("unfinished");
    expect(lane1.file.reason).toContain("Verify");
    expect(lane1.file.reason).toContain("2 tests fail");
    expect(readEvents(p.root, h.run).some((e) => e.kind === "not-merged")).toBe(true);
    const merged = parseTasks(readFileSync(join(p.featureRoot, "specs", F, "tasks.md"), "utf8")).filter((t) => t.done);
    expect(merged).toHaveLength(0);
  });

  it("028:FR-011: a lane already merged by hand is recorded merged without merging twice", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    const lane1 = h.lane("lane-1-1");
    tickIn(lane1.ref.root, F, ["T001", "T003"]);
    commitFile(lane1.ref.root, "src/one.ts", "one\n", "lane 1 work");
    gitRun(p.featureRoot, ["merge", "--no-ff", "-m", "by hand", lane1.ref.name]);
    lane1.file.status = "ready";
    await h.step();
    expect(readLaneFile(p.root, h.run, "lane-1-1")!.status).toBe("merged");
  });
});
