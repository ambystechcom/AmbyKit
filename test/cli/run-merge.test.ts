import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { readLaneFile } from "../../src/cli/run-files.js";
import { readRun } from "../../src/core/fleet/index.js";
import { gitRun, HAS_GIT } from "../helpers/git-repo.js";
import { commitFile } from "../helpers/lane-fixture.js";
import { runCommand } from "../helpers/run-command.js";
import { FakePort, fakeRegistry, preparedProject, script } from "../helpers/run-fakes.js";

const F = "028-ambykit-run";

describe.skipIf(!HAS_GIT)("merges inside ambykit run (feature 028)", () => {
  it("028:FR-012: a conflict pauses the merge, the run waits, and it carries on once a person resolves it", async () => {
    const p = await preparedProject(F, 4, 2);
    commitFile(p.featureRoot, "shared.txt", "from feature\n", "feature edit");
    const port = new FakePort();
    script({ port }, p, (cwd, prompt) => {
      if (cwd.endsWith("lane-1-2") && prompt.includes("check each off")) commitFile(cwd, "shared.txt", "from lane\n", "lane edit of the shared file");
      return { work: true };
    });
    let sleeps = 0;
    let resolved = false;
    const sleep = async (): Promise<void> => {
      sleeps += 1;
      // the person acts only once the run has reported the conflict
      if (resolved || readLaneFile(p.root, `${F}.1`, "lane-1-2")?.status !== "conflict") return;
      resolved = true;
      // the person's action: merge the feature into the lane, resolve, commit
      const lane = join(p.root, ".worktrees", `${F}.lane-1-2`);
      try {
        gitRun(lane, ["merge", F]);
      } catch {
        writeFileSync(join(lane, "shared.txt"), "resolved\n");
        gitRun(lane, ["add", "-A"]);
        gitRun(lane, ["commit", "-q", "-m", "resolve"]);
      }
    };
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep }), p.root, [F], { yes: true });
    expect(r.out).toContain("merge paused");
    expect(r.code).toBe(0);
    expect(resolved).toBe(true);
    expect(readRun(p.root, `${F}.1`)!.status).toBe("done");
    expect(readLaneFile(p.root, `${F}.1`, "lane-1-2")!.status).toBe("merged");
    expect(readFileSync(join(p.featureRoot, "shared.txt"), "utf8")).toBe("resolved\n");
    expect(JSON.stringify(readRun(p.root, `${F}.1`)!.escalations)).toContain("merge-conflict");
  });

  it("028:FR-011: a lane that ends with tasks open is reported unfinished, is never merged, and the run says a person must act", async () => {
    const p = await preparedProject(F, 4, 2);
    const port = new FakePort();
    script({ port }, p, (cwd) => ({ work: !cwd.endsWith("lane-1-2") }));
    const r = await runCommand(new RunCommand({ registry: fakeRegistry(), port, sleep: async () => undefined }), p.root, [F], { yes: true });
    expect(r.code).toBe(1);
    expect(r.err + r.out).toContain("lane-1-2");
    expect(r.err + r.out).toContain("unfinished");
    const rec = readRun(p.root, `${F}.1`)!;
    expect(rec.status).toBe("waiting-person");
    expect(rec.needsDecision).toBe(true);
    expect(readLaneFile(p.root, rec.run, "lane-1-1")!.status).toBe("merged");
    expect(readLaneFile(p.root, rec.run, "lane-1-2")!.status).toBe("unfinished");
  });
});
