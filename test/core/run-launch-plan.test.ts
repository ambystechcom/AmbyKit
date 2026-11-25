import { describe, expect, it } from "vitest";
import { assignAssistants, launchPlan, refusals, type LaunchLane } from "../../src/core/run-launch-plan.js";
import { fakeRegistry, unverifiedRegistry } from "../helpers/run-fakes.js";

const lane = (n: number, assistant: string): LaunchLane => ({
  lane: `lane-1-${n}`,
  full: `028-x.lane-1-${n}`,
  cwd: `/w/028-x.lane-1-${n}`,
  assistant,
  prompt: `prompt ${n}`,
});
const opts = { promptFileFor: (l: string) => `/p/${l}.md` };

describe("launch plan (feature 028)", () => {
  it("028:FR-001: one exact command per lane, in its own worktree, prompt from its file", () => {
    const plan = launchPlan([lane(1, "claude"), lane(2, "codex")], { ...opts, registry: fakeRegistry() });
    expect(plan).toHaveLength(2);
    expect(plan[0]!.cwd).toBe("/w/028-x.lane-1-1");
    expect(plan[0]!.display).toContain("cd /w/028-x.lane-1-1 &&");
    expect(plan[0]!.display).toContain("< /p/lane-1-1.md");
    expect(plan[1]!.promptFile).toBe("/p/lane-1-2.md");
    expect(plan[0]!.refused).toBeUndefined();
  });

  it("028:FR-006: a lane whose assistant has no verified runner is refused with the reason, not given a command", () => {
    const plan = launchPlan([lane(1, "claude")], { ...opts, registry: unverifiedRegistry() });
    expect(plan[0]!.command).toBeUndefined();
    expect(plan[0]!.refused).toContain("not verified");
    expect(plan[0]!.display).toContain("REFUSED");
    expect(refusals(plan)).toEqual([{ lane: "lane-1-1", assistant: "claude", reason: plan[0]!.refused }]);
  });

  it("028:FR-006: one refused lane does not hide the runnable ones", () => {
    const plan = launchPlan([lane(1, "claude"), lane(2, "cursor")], { ...opts, registry: fakeRegistry(["claude"]) });
    expect(plan.map((e) => Boolean(e.command))).toEqual([true, false]);
    expect(refusals(plan)).toHaveLength(1);
  });

  it("028:FR-004: the configured model is passed to the runner", () => {
    const plan = launchPlan([lane(1, "claude")], { ...opts, registry: [{ ...unverifiedRegistry()[0]!, verified: true }], model: "opus-x" });
    expect(plan[0]!.command!.args).toContain("opus-x");
  });

  it("028:FR-001: arguments with spaces are quoted in the printed command", () => {
    const plan = launchPlan([{ ...lane(1, "claude"), cwd: "/w/with space" }], { ...opts, registry: fakeRegistry() });
    expect(plan[0]!.display).toContain('"/w/with space"');
  });

  it("028:FR-004: lanes are spread over assistants in order, so two lanes use two assistants", () => {
    const m = assignAssistants(["lane-1-1", "lane-1-2", "lane-1-3"], ["claude", "codex"]);
    expect([...m.values()]).toEqual(["claude", "codex", "claude"]);
  });
});
