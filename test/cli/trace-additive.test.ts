import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";

async function capture(fn: () => Promise<unknown>): Promise<string> {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  try {
    await fn();
  } finally {
    console.log = orig;
  }
  return lines.join("\n");
}

describe("trace is additive", () => {
  it("024:FR-019: running trace changes no existing command's output", async () => {
    const root = dashboardFixture();
    const run = (): Promise<string> =>
      capture(async () => {
        await new DashboardCommand().run({ cwd: root, positionals: [], flags: { json: true } });
        await new AnalyzeCommand().run({ cwd: root, positionals: [], flags: { json: true } });
      });
    const before = await run();
    const { runTrace } = await import("../helpers/trace-fixture.js");
    await runTrace(root);
    expect(await run()).toBe(before);
  });

  it("024:FR-019: bare --json dashboard output carries no coverage field", async () => {
    const root = dashboardFixture();
    const out = await capture(() => new DashboardCommand().run({ cwd: root, positionals: [], flags: { json: true } }));
    expect(out).not.toContain("coverage");
  });
});
