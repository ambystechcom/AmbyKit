import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { hasAnsi } from "../ui/helpers.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";

async function capture(root: string, flags: Record<string, string | boolean>): Promise<string> {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => void lines.push(args.join(" "));
  try {
    await new DashboardCommand().run({ cwd: root, positionals: [], flags });
  } finally {
    console.log = orig;
  }
  return lines.join("\n");
}

describe("dashboard --json --overview (US-6, FR-012, contracts/dashboard-json.md)", () => {
  it("stories equals the bare --json output; all members present; no ANSI", async () => {
    const root = dashboardFixture();
    const bare = await capture(root, { json: true });
    const out = await capture(root, { json: true, overview: true });
    expect(hasAnsi(out)).toBe(false);
    const doc = JSON.parse(out);
    expect(JSON.stringify(doc.stories, null, 2)).toBe(bare);
    expect(Object.keys(doc)).toEqual([
      "stories",
      "summary",
      "statusCounts",
      "features",
      "attention",
      "upNext",
      "burndown",
      "issues",
      "filters",
    ]);
    expect(doc.summary).toMatchObject({ features: 3, stories: 10, tasksDone: 25, tasksTotal: 40, percent: 63 });
    expect(doc.statusCounts).toEqual({ done: 5, "in-progress": 1, draft: 2, blocked: 1, deferred: 1 });
    expect(doc.attention).toHaveLength(2);
    expect(doc.upNext).toMatchObject({ eligible: 9, allDone: false });
    expect(doc.burndown).toEqual({ status: "no-history", reason: "not-a-repo", points: [] });
    expect(doc.filters).toEqual({ feature: null, status: null, next: 5 });
  });

  it("filters and --next apply to every member", async () => {
    const root = dashboardFixture();
    const doc = JSON.parse(await capture(root, { json: true, overview: true, feature: "003-reports", next: "2" }));
    expect(doc.stories.map((s: { feature: string }) => s.feature)).toEqual(["003-reports", "003-reports"]);
    expect(doc.features.map((f: { name: string }) => f.name)).toEqual(["003-reports"]);
    expect(doc.upNext.items).toHaveLength(2);
    expect(doc.filters).toEqual({ feature: "003-reports", status: null, next: 2 });
  });

  it("bare --json is unchanged by the new flags' existence", async () => {
    const root = dashboardFixture();
    expect(Array.isArray(JSON.parse(await capture(root, { json: true })))).toBe(true);
  });
});
