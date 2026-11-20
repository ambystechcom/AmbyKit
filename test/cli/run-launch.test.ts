import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readEvents, readLaneFile } from "../../src/cli/run-files.js";
import { running } from "../../src/cli/run-launch.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { harness, script, preparedProject } from "../helpers/run-fakes.js";

const F = "028-ambykit-run";

describe.skipIf(!HAS_GIT)("launch queue (feature 028)", () => {
  // Tests 2 (the prompt) and 9 (the audit trail) did the same single step() on the same (4, 2) project with the same hanging
  // fake as this one: one start, all three sets of assertions.
  it(
    "028:FR-004: one process per lane, in that lane's worktree, each on its own assistant; the prompt a lane gets is its task IDs, " +
      "artifacts by reference and its file ownership; the run records each start in its audit trail",
    async () => {
      const p = await preparedProject(F, 4, 2);
      const h = harness(p, { assistants: ["claude", "codex"] });
      script(h, p, { hang: true });
      await h.step();
      expect(h.port.starts).toHaveLength(2);
      expect(h.port.starts.map((x) => x.spec.cwd)).toEqual([
        join(p.root, ".worktrees", `${F}.lane-1-1`),
        join(p.root, ".worktrees", `${F}.lane-1-2`),
      ]);
      expect(h.lane("lane-1-1").assistant).toBe("claude");
      expect(h.lane("lane-1-2").assistant).toBe("codex");
      expect(h.lane("lane-1-1").file.status).toBe("running");
      // the prompt a lane gets
      const prompt = h.port.starts[0]!.spec.stdin!;
      expect(prompt).toContain("T001, T003");
      expect(prompt).toContain(`@specs/${F}/tasks.md`);
      expect(prompt).toContain("src/f1.ts");
      expect(prompt).not.toContain("T002");
      const file = join(p.root, ".amby", "fleet", h.run, "prompts", "lane-1-1.md");
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, "utf8")).toContain("T001, T003");
      // the audit trail
      const started = readEvents(p.root, h.run).filter((e) => e.kind === "started");
      expect(started.map((e) => e.lane)).toEqual(["lane-1-1", "lane-1-2"]);
    },
    60_000,
  );

  it("028:FR-005: lanes beyond the total cap wait and start as slots free", async () => {
    const p = await preparedProject(F, 8, 4);
    const h = harness(p, { assistants: ["claude", "codex"], settings: { concurrency: { total: 2, perType: 2 } } });
    script(h, p, { hang: true });
    await h.step();
    expect(h.port.starts).toHaveLength(2);
    expect(h.s.lanes.filter((l) => l.file.status === "queued")).toHaveLength(2);
    h.port.starts[0]!.finish(0);
    await h.step();
    expect(h.port.starts).toHaveLength(3);
    expect(running(h.s)).toHaveLength(2);
  });

  it("028:FR-005: at most perType lanes of one assistant run at once", async () => {
    const p = await preparedProject(F, 8, 4);
    const h = harness(p, { assistants: ["claude"], settings: { concurrency: { total: 3, perType: 1 } } });
    script(h, p, { hang: true });
    await h.step();
    expect(h.port.starts).toHaveLength(1);
  });

  it("028:FR-005: the default caps are 3 in total and 2 of a type", async () => {
    const p = await preparedProject(F, 8, 4);
    const h = harness(p, { assistants: ["claude"] });
    script(h, p, { hang: true });
    await h.step();
    expect(h.port.starts).toHaveLength(2);
    // the defaults are the settings of the harness just built: no second project is needed to read them
    expect(h.s.settings.concurrency).toEqual({ total: 3, perType: 2 });
  });

  it("028:FR-004: a process that ends with every task checked is finished, merged, and keeps its exit status", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { work: true, exit: 0 });
    await h.step();
    await h.step();
    const file = readLaneFile(p.root, h.run, "lane-1-1")!;
    expect(file.status).toBe("merged");
    expect(file.exit).toEqual({ code: 0, signal: null });
    expect(readEvents(p.root, h.run).some((e) => e.kind === "finished" && e.lane === "lane-1-1")).toBe(true);
  });

  it("028:FR-004: a process that ends with tasks still open is unfinished and never merged", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    script(h, p, { work: false, exit: 0 });
    await h.step();
    h.advance(1); // not an immediate failure: it ran for a minute
    await h.step();
    const file = readLaneFile(p.root, h.run, "lane-1-1")!;
    expect(file.status).toBe("unfinished");
    expect(file.reason).toContain("T001");
  });

  it("028:FR-006: a lane whose runner is not runnable is marked failed with the reason and nothing is spawned for it", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p);
    h.s.registry = [];
    script(h, p, { hang: true });
    await h.step();
    expect(h.port.starts).toHaveLength(0);
    const file = readLaneFile(p.root, h.run, "lane-1-1")!;
    expect(file.status).toBe("failed");
    expect(file.reason).toContain("no headless runner");
  });
});
