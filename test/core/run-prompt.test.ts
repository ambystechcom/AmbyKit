import { describe, expect, it } from "vitest";
import { buildLanePrompt, buildRolePrompt, type PromptLane } from "../../src/core/run-prompt.js";

const lane: PromptLane = {
  feature: "028-ambykit-run",
  lane: "028-ambykit-run.lane-3-1",
  phase: 3,
  tasks: [
    { id: "T030", paths: ["src/a.ts", "test/a.test.ts"] },
    { id: "T031", paths: ["src/b.ts"] },
  ],
};
const artifacts = ["specs/028-ambykit-run/spec.md", "specs/028-ambykit-run/plan.md", "specs/028-ambykit-run/tasks.md"];

describe("lane prompt (feature 028)", () => {
  it("028:FR-004: carries task IDs, artifacts by reference and file ownership only", () => {
    const p = buildLanePrompt(lane, { run: "028-ambykit-run.1", artifacts });
    expect(p).toContain("T030, T031");
    expect(p).toContain("@specs/028-ambykit-run/spec.md");
    expect(p).toContain("src/a.ts, test/a.test.ts, src/b.ts");
    expect(p).toContain("lane-3-1");
    expect(p).not.toMatch(/^#/m);
  });

  it("028:FR-004: the report line names the lane's assistant as --agent, which ambykit activity requires (live check, Windows)", () => {
    const p = buildLanePrompt(lane, { run: "r.1", artifacts, assistant: "claude" });
    const report = p.split("\n").find((l) => l.startsWith("Report: "))!;
    expect(report).toContain("ambykit activity 028-ambykit-run --agent=claude --phase=implement");
    // every flag `ambykit activity` requires is present: <feature> --agent --phase
    expect(report).toMatch(/ambykit activity \S+ --agent=\S+ --phase=\S+/);
    expect(buildLanePrompt(lane, { run: "r.1", artifacts, assistant: "codex" })).toContain("--agent=codex");
  });

  it("028:FR-004: stays small: a lane prompt is a few hundred characters, not the spec", () => {
    expect(buildLanePrompt(lane, { run: "r.1", artifacts }).length).toBeLessThan(1200);
  });

  it("028:FR-008: a restart lists only the unchecked tasks and their paths", () => {
    const p = buildLanePrompt(lane, { run: "r.1", artifacts, open: ["T031"] });
    expect(p).toContain("T031");
    expect(p).not.toContain("T030");
    expect(p).toContain("src/b.ts");
    expect(p).not.toContain("src/a.ts");
  });

  it("028:FR-018: a fix round names exactly the finding IDs", () => {
    const p = buildLanePrompt(lane, { run: "r.1", artifacts, findings: ["QA-1", "ARCH-2"] });
    expect(p).toContain("QA-1, ARCH-2");
    expect(p).toContain("verdicts/");
    expect(p).not.toContain("Build only these tasks");
  });

  it("028:FR-016: tells the worker how to report and read its directive, plus the shared protocol text", () => {
    const p = buildLanePrompt(lane, { run: "r.1", artifacts, protocol: "PROTOCOL TEXT" });
    expect(p).toContain("ambykit activity 028-ambykit-run");
    expect(p).toContain("ambykit fleet directive 028-ambykit-run lane-3-1 --run=r.1");
    expect(p.trim().endsWith("PROTOCOL TEXT")).toBe(true);
  });

  it("028:FR-018: a role prompt references the role file and the Verify line and names the verdict file", () => {
    const p = buildRolePrompt({
      role: "qa",
      feature: "028-ambykit-run",
      lane: "028-ambykit-run.lane-3-1",
      phase: 3,
      round: 1,
      run: "r.1",
      roleFile: ".amby/roles/qa.md",
      verify: "**Verify:** `npm test` passes",
      artifacts,
      verdictFile: "verdicts/lane-3-1.qa.1.json",
    });
    expect(p).toContain("@.amby/roles/qa.md");
    expect(p).toContain("npm test");
    expect(p).toContain("verdicts/lane-3-1.qa.1.json");
  });

  it("028:FR-018: a role prompt without a Verify line says to review the diff", () => {
    const p = buildRolePrompt({ role: "architect", feature: "f", lane: "f.lane-1-1", phase: 1, round: 2, run: "r.1", roleFile: "x", artifacts: [], verdictFile: "v.json" });
    expect(p).toContain("no Verify line");
  });
});
