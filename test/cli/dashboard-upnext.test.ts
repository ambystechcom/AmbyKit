import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { stripAnsi } from "../ui/helpers.js";

async function capture(root: string, flags: Record<string, string | boolean> = {}) {
  const lines: string[] = [];
  const orig = { log: console.log, error: console.error };
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  console.error = (...a: unknown[]) => void lines.push(a.join(" "));
  try {
    const code = await new DashboardCommand().run({ cwd: root, positionals: [], flags });
    return { code, out: stripAnsi(lines.join("\n")) };
  } finally {
    console.log = orig.log;
    console.error = orig.error;
  }
}

describe("dashboard --next (US-4, FR-009, R-4)", () => {
  it("defaults to 5", async () => {
    expect((await capture(dashboardFixture())).out).toContain("UP NEXT (5 of 9)");
  });

  it("--next=N changes the cap", async () => {
    const { code, out } = await capture(dashboardFixture(), { next: "3" });
    expect(code).toBe(0);
    expect(out).toContain("UP NEXT (3 of 9)");
  });

  it("an invalid value is an error, exit 1", async () => {
    for (const next of ["0", "-2", "abc", "1.5", true] as const) {
      const { code, out } = await capture(dashboardFixture(), { next });
      expect(code).toBe(1);
      expect(out).toContain("--next expects a positive whole number");
    }
  });
});
