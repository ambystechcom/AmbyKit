import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { describe, expect, it } from "vitest";
import { readEvents, readLaneFile } from "../../src/cli/run-files.js";
import { claimFiles, readClaims, readRun } from "../../src/core/fleet/index.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { configure, harness, preparedProject, script, type Harness } from "../helpers/run-fakes.js";

const F = "028-ambykit-run";

const roundOf = (prompt: string): number => Number(/round (\d+)/.exec(prompt)?.[1] ?? "1");
const roleOf = (prompt: string): "qa" | "architect" => (/Act as the architect reviewer/.test(prompt) ? "architect" : "qa");

async function until(h: Harness, done: (out: unknown) => boolean, max = 20): Promise<unknown> {
  let out: unknown = null;
  for (let i = 0; i < max; i++) {
    out = await h.step();
    if (done(out)) break;
  }
  return out;
}

describe.skipIf(!HAS_GIT)("review loop as processes (feature 028)", () => {
  it("028:FR-018: a finished lane is reviewed by QA then the architect, each launched as a process of the lane's assistant, then merges", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { review: true, assistants: ["claude"] });
    script(h, p, { work: true, verdict: "pass" });
    const out = await until(h, (o) => o !== null);
    expect(out).toMatchObject({ kind: "done" });
    const prompts = h.port.starts.map((x) => x.spec.stdin ?? "");
    const roles = prompts.filter((t) => /reviewer:/.test(t)).map(roleOf);
    expect(roles.filter((r) => r === "qa")).toHaveLength(2);
    expect(roles.filter((r) => r === "architect")).toHaveLength(2);
    const qa = prompts.find((t) => /Act as the qa reviewer/.test(t))!;
    expect(qa).toContain("@.amby/roles/qa.md");
    expect(qa).toContain(`.amby/fleet/${h.run}/verdicts/lane-1-1.qa.1.json`);
    expect(existsSync(join(p.root, ".amby", "fleet", h.run, "verdicts", "lane-1-1.architect.1.json"))).toBe(true);
    expect(readLaneFile(p.root, h.run, "lane-1-1")!.status).toBe("merged");
  });

  it("028:FR-018: QA runs before the architect, never together, in the same lane worktree", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { review: true, assistants: ["claude"], settings: { concurrency: { total: 1, perType: 1 } } });
    script(h, p, { work: true, verdict: "pass" });
    await until(h, (o) => o !== null);
    const lane1 = h.port.starts.filter((x) => x.spec.cwd.endsWith("lane-1-1")).map((x) => (/reviewer:/.test(x.spec.stdin ?? "") ? roleOf(x.spec.stdin ?? "") : "worker"));
    expect(lane1).toEqual(["worker", "qa", "architect"]);
  });

  it("028:SC-009: a failing QA goes back to the same lane's worker with the finding IDs only, then a second round passes", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { review: true, assistants: ["claude"] });
    script(h, p, (cwd, prompt) => ({ work: true, verdict: roundOf(prompt) === 1 && roleOf(prompt) === "qa" && cwd.endsWith("lane-1-1") ? ["QA-1", "QA-2"] : "pass" }));
    const out = await until(h, (o) => o !== null);
    expect(out).toMatchObject({ kind: "done" });
    const fix = h.port.starts.find((x) => /Fix exactly these review findings/.test(x.spec.stdin ?? ""))!;
    expect(fix.spec.cwd.endsWith("lane-1-1")).toBe(true);
    expect(fix.spec.stdin).toContain("QA-1, QA-2");
    expect(fix.spec.stdin).not.toContain("Build only these tasks");
    expect(readLaneFile(p.root, h.run, "lane-1-1")!.failedRounds).toBe(1);
    const round2 = h.port.starts.map((x) => x.spec.stdin ?? "").filter((t) => /lane-1-1/.test(t) && /reviewer:/.test(t) && roundOf(t) === 2);
    expect(round2.length).toBeGreaterThan(0);
    expect(readEvents(p.root, h.run).some((e) => e.kind === "review-failed" && e.lane === "lane-1-1")).toBe(true);
  });

  it("028:SC-009: an architect failure also goes back to the worker and the next round starts again at QA", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { review: true, assistants: ["claude"] });
    script(h, p, (cwd, prompt) => ({ work: true, verdict: roundOf(prompt) === 1 && roleOf(prompt) === "architect" && cwd.endsWith("lane-1-1") ? ["ARCH-1"] : "pass" }));
    await until(h, (o) => o !== null);
    const lane1 = h.port.starts.filter((x) => x.spec.cwd.endsWith("lane-1-1")).map((x) => {
      const t = x.spec.stdin ?? "";
      return /reviewer:/.test(t) ? `${roleOf(t)}${roundOf(t)}` : /Fix exactly/.test(t) ? "fix" : "worker";
    });
    expect(lane1).toEqual(["worker", "qa1", "architect1", "fix", "qa2", "architect2"]);
  });

  it("028:SC-009: a lane that never passes review is bounded: after fleet.roundLimit failed rounds a person is asked and it never merges", async () => {
    const p = await preparedProject(F, 4, 2);
    configure(p.root, { fleet: { roundLimit: 2 } });
    const h = harness(p, { review: true, assistants: ["claude"] });
    script(h, p, (cwd) => ({ work: true, verdict: cwd.endsWith("lane-1-1") ? ["BAD-1"] : "pass" }));
    for (let i = 0; i < 14; i++) await h.step(); // the run keeps waiting for a person; it does not loop
    const lane = readLaneFile(p.root, h.run, "lane-1-1")!;
    expect(lane.status).toBe("escalated");
    expect(lane.failedRounds).toBe(2);
    expect(lane.reason).toContain("limit 2");
    const reviewers = h.port.starts.filter((x) => x.spec.cwd.endsWith("lane-1-1") && /reviewer:/.test(x.spec.stdin ?? ""));
    expect(reviewers.length).toBeLessThanOrEqual(4); // at most one QA per round for two rounds, and QA fails first
    const rec = readRun(p.root, h.run)!;
    expect(rec.status).toBe("waiting-person");
    expect(JSON.stringify(rec.escalations)).toContain("BAD-1");
    expect(readLaneFile(p.root, h.run, "lane-1-2")!.status).toBe("merged");
  });

  it("028:FR-018: a reviewer that ends without writing a verdict is never read as a pass", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { review: true, assistants: ["claude"] });
    script(h, p, { work: true, verdict: "none" });
    for (let i = 0; i < 10; i++) await h.step();
    expect(readLaneFile(p.root, h.run, "lane-1-1")!.status).toBe("escalated");
    expect(readLaneFile(p.root, h.run, "lane-1-1")!.reason).toContain("no verdict");
  });

  it("028:FR-018: a verdict that is not valid JSON escalates with the reason", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { review: true, assistants: ["claude"] });
    script(h, p, { work: true });
    const orig = h.port.onSpawn!;
    h.port.onSpawn = (proc) => {
      orig(proc);
      if (/reviewer:/.test(proc.spec.stdin ?? "")) {
        const file = /Write your verdict to (\S+) as JSON/.exec(proc.spec.stdin ?? "")![1]!; // absolute: the run directory
        require("node:fs").writeFileSync(file, "this is not json");
      }
    };
    await until(h, (o) => o !== null);
    expect(readLaneFile(p.root, h.run, "lane-1-1")!.reason).toContain("invalid");
  });

  it("028:FR-018: a claim on a task's files is released when the task is checked off", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { review: true, assistants: ["claude"] });
    claimFiles(p.root, h.run, { task: "T001", files: ["src/f1.ts"], worker: "lane-1-1" });
    expect(Object.keys(readClaims(p.root, h.run))).toContain("src/f1.ts");
    script(h, p, { work: true, verdict: "pass" });
    await h.step();
    await h.step();
    expect(Object.keys(readClaims(p.root, h.run))).not.toContain("src/f1.ts");
  });

  it("028:FR-018: the phase's Verify line is passed to the reviewers by reference to the lane's tasks.md text", async () => {
    const p = await preparedProject(F, 4, 2);
    const lane = join(p.root, ".worktrees", `${F}.lane-1-1`, "specs", F, "tasks.md");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(lane, readFileSync(lane, "utf8").replace(/\n*$/, "\n") + "**Verify:** `npm test` passes\n");
    const h = harness(p, { review: true, assistants: ["claude"] });
    script(h, p, { work: true, verdict: "pass" });
    await until(h, (o) => o !== null);
    const qa = h.port.starts.find((x) => x.spec.cwd.endsWith("lane-1-1") && /Act as the qa reviewer/.test(x.spec.stdin ?? ""))!;
    expect(qa.spec.stdin).toMatch(/Run this check and judge its result: \*\*Verify:\*\* .*npm test.* passes/);
  });

  it("028:FR-012: a person can resume an escalated lane with a continue directive; it gets a fresh set of review rounds", async () => {
    const p = await preparedProject(F, 4, 2);
    configure(p.root, { fleet: { roundLimit: 1 } });
    const h = harness(p, { review: true, assistants: ["claude"] });
    let failing = true;
    script(h, p, (cwd) => ({ work: true, verdict: cwd.endsWith("lane-1-1") && failing ? ["BAD-1"] : "pass" }));
    for (let i = 0; i < 10; i++) await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("escalated");
    failing = false;
    const { writeDirective } = await import("../../src/core/fleet/index.js");
    writeDirective(p.root, { feature: F, lane: "lane-1-1", action: "continue", run: h.run, now: new Date(h.clock.t + 5000) });
    h.advance(1);
    let out: unknown = null;
    for (let i = 0; i < 12 && !out; i++) out = await h.step();
    expect(out).toMatchObject({ kind: "done" });
    expect(h.lane("lane-1-1").file.status).toBe("merged");
  });

  it("028:FR-018: with review off a finished lane goes straight to merge (used by tests of the other stories)", async () => {
    const p = await preparedProject(F, 4, 2);
    const h = harness(p, { review: false });
    script(h, p, { work: true });
    await h.step();
    await h.step();
    expect(h.port.starts.every((x) => !/reviewer:/.test(x.spec.stdin ?? ""))).toBe(true);
  });
});

describe("reviewer verdicts and the lane checkout (the 2.0 dogfood)", () => {
  it("028:FR-018: the reviewer prompt names the verdict file by its absolute path in the project's run directory", async () => {
    const p = await preparedProject(F, 2, 1);
    const h = harness(p, { review: true, assistants: ["claude"] });
    const prompts: string[] = [];
    script(h, p, (_cwd, prompt) => (prompts.push(prompt), { work: true, verdict: "pass" }));
    await until(h, (o) => o !== null);
    const review = prompts.find((x) => /reviewer:/.test(x))!;
    const path = /Write your verdict to (\S+) as JSON/.exec(review)![1]!;
    expect(isAbsolute(path)).toBe(true);
    expect(path.replace(/\\/g, "/")).toContain(`${p.root.replace(/\\/g, "/")}/.amby/fleet/`);
  });

  it("028:FR-018: a verdict a reviewer wrote inside the lane checkout (a relative path) is still read", async () => {
    const p = await preparedProject(F, 2, 1);
    const h = harness(p, { review: true, assistants: ["claude"] });
    script(h, p, { work: true, verdict: "none" });
    const orig = h.port.onSpawn!;
    h.port.onSpawn = (proc) => {
      const prompt = proc.spec.stdin ?? "";
      if (/reviewer:/.test(prompt)) {
        // what the dogfood's reviewer did: the run-relative path, written under the lane's own checkout
        const abs = /Write your verdict to (\S+) as JSON/.exec(prompt)![1]!.replace(/\\/g, "/");
        const rel = abs.slice(abs.indexOf(".amby/fleet/"));
        const file = join(proc.spec.cwd, rel);
        require("node:fs").mkdirSync(join(file, ".."), { recursive: true });
        require("node:fs").writeFileSync(file, JSON.stringify({ verdict: "pass", findings: [] }));
        proc.finish(0);
        return;
      }
      orig(proc);
    };
    const out = await until(h, (o) => o !== null);
    expect(out).toMatchObject({ kind: "done" });
  });
});
