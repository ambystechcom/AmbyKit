import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readBudget, readEvents } from "../../src/cli/run-files.js";
import { RUNNERS } from "../../src/core/runners.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { harness, preparedProject, tickIn, type Harness } from "../helpers/run-fakes.js";

/**
 * The supervisor reads the claude runner's JSON result (033, live check on Windows): plain `claude -p` exited 0 having
 * done nothing, so exit 0 alone no longer decides. The result also carries usage, which the token budget now counts.
 */
const F = "028-ambykit-run";
const recorded = readFileSync(join(__dirname, "..", "fixtures", "runners", "claude-result-success.json"), "utf8");
const result = (over: Record<string, unknown> = {}): string => JSON.stringify({ ...JSON.parse(recorded), ...over });

/** The lane finished (the same tick then goes on to merge, so the final status moves past "finished"). */
const finished = (h: Harness): boolean => readEvents(h.s.root, h.run).some((e) => e.kind === "finished" && e.lane === "lane-1-1");

async function oneLane(): Promise<{ h: Harness; laneRoot: string }> {
  const p = await preparedProject(F, 2, 1);
  const h = harness(p, { assistants: ["claude"], usage: true });
  await h.step(); // launches the lane
  expect(h.port.starts).toHaveLength(1);
  return { h, laneRoot: h.lane("lane-1-1").ref.root };
}

describe.skipIf(!HAS_GIT)("claude result read by the supervisor (033, live check)", () => {
  it("033:FR-004: the claude spawn captures stdout, and a successful result finishes the lane and counts its tokens", async () => {
    const { h, laneRoot } = await oneLane();
    expect(h.port.starts[0]!.spec.captureStdout).toBe(true);
    tickIn(laneRoot, F, ["T001", "T002"]);
    h.port.starts[0]!.finish(0, null, result({ permission_denials: [] }));
    await h.step();
    expect(finished(h)).toBe(true);
    expect(readBudget(h.s.root, h.run).tokensUsed).toBe(1547);
    expect(readEvents(h.s.root, h.run).some((e) => e.kind === "usage" && /1547 tokens/.test(e.detail ?? ""))).toBe(true);
  }, 60_000);

  it("033:FR-004: exit 0 with tasks open after refused tools is a failure that names the tools, not 'unfinished'", async () => {
    const { h } = await oneLane();
    h.port.starts[0]!.finish(0, null, result()); // the recorded result: PowerShell refused
    await h.step();
    const lane = h.lane("lane-1-1").file;
    expect(lane.status).toBe("failed");
    expect(lane.reason).toContain("refused: PowerShell");
    expect(finished(h)).toBe(false);
  }, 60_000);

  it("033:FR-004: an error result fails the lane even with exit 0 and every task checked off", async () => {
    const { h, laneRoot } = await oneLane();
    tickIn(laneRoot, F, ["T001", "T002"]);
    h.port.starts[0]!.finish(0, null, result({ is_error: true, subtype: "error_during_execution", permission_denials: [] }));
    await h.step();
    expect(h.lane("lane-1-1").file.status).toBe("failed");
    expect(h.lane("lane-1-1").file.reason).toContain("error_during_execution");
  }, 60_000);

  it("033:FR-004: output without a result object falls back to the exit code and the task list, as before", async () => {
    const { h, laneRoot } = await oneLane();
    tickIn(laneRoot, F, ["T001", "T002"]);
    h.port.starts[0]!.finish(0, null, "Lane done.");
    await h.step();
    expect(finished(h)).toBe(true);
    expect(readBudget(h.s.root, h.run).tokensUsed).toBeUndefined();
  }, 60_000);

  it("033:FR-004: codex is unchanged: its output is not read and it reports no usage", () => {
    const codex = RUNNERS.find((r) => r.id === "codex")!;
    expect(codex.readResult).toBeUndefined();
    expect(codex.reportsUsage).toBe(false);
    expect(RUNNERS.find((r) => r.id === "claude")!.reportsUsage).toBe(true);
  });
});
