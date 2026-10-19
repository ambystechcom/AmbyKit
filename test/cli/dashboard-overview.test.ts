import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { dashboardFixture, emptyProject } from "../helpers/dashboard-fixture.js";
import { stripAnsi } from "../ui/helpers.js";

/** Run the dashboard capturing stdout; tests run without a TTY, so output is the plain layout. */
async function capture(root: string, flags: Record<string, string | boolean> = {}, positionals: string[] = []) {
  const lines: string[] = [];
  const orig = { log: console.log, error: console.error };
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  console.error = (...a: unknown[]) => void lines.push(a.join(" "));
  let code: number;
  try {
    code = await new DashboardCommand().run({ cwd: root, positionals, flags });
  } finally {
    console.log = orig.log;
    console.error = orig.error;
  }
  return { code, out: stripAnsi(lines.join("\n")) };
}

describe("dashboard command — overview default (US-1, FR-013, FR-015, FR-016)", () => {
  it("default one-shot output is the overview, in plain text off a TTY", async () => {
    const { code, out } = await capture(dashboardFixture());
    expect(code).toBe(0);
    expect(out).toContain("AmbyKit dashboard");
    expect(out).toContain("FEATURES 3 (1 done)   STORIES 10 (5 done)   TASKS 25/40   COMPLETE 63%");
    expect(out).not.toContain("Description");
  });

  it("--stories keeps the existing story table", async () => {
    const { out } = await capture(dashboardFixture(), { stories: true });
    expect(out).toContain("Description");
    expect(out).toContain("Overall: 10 stories · 25/40 tasks · 63%");
  });

  it("--status filters the overview", async () => {
    expect((await capture(dashboardFixture(), { status: "draft" })).out).toContain("STORIES 2 (0 done)   TASKS 0/7");
  });

  it("--feature renders the feature view; an unknown feature is an error", async () => {
    const { code, out } = await capture(dashboardFixture(), { feature: "002" });
    expect(code).toBe(0);
    expect(out.split("\n")[0]).toBe("AmbyKit dashboard > 002 widgets  implementing  65%");
    expect(out).toContain("OPEN CLARIFICATIONS 0");
    const missing = await capture(dashboardFixture(), { feature: "999" });
    expect(missing.code).toBe(1);
    expect(missing.out).toContain("Feature 999 not found.");
  });

  it("story detail is unchanged", async () => {
    const { code, out } = await capture(dashboardFixture(), {}, ["002:US-2"]);
    expect(code).toBe(0);
    expect(out).toContain("002:US-2 — Story 2");
    expect(out).toContain("progress:   5/6 tasks (83%)");
  });

  it("an empty project renders zeros and the hint, exit 0", async () => {
    const { code, out } = await capture(emptyProject());
    expect(code).toBe(0);
    expect(out).toContain("FEATURES 0   STORIES 0   TASKS 0/0   COMPLETE -");
    expect(out).toContain("No features yet. Run /amby.specify");
  });

  it("an unreadable tasks.md is named and the rest renders", async () => {
    const { code, out } = await capture(dashboardFixture({ edges: true }));
    expect(code).toBe(0);
    expect(out).toContain("skipped specs/009-broken/tasks.md");
    expect(out).toContain("FEATURES 7");
  });
});

describe("legacy paths skip unreadable files too (T108, FR-014)", () => {
  async function run(root: string, flags: Record<string, string | boolean>, positionals: string[] = []) {
    const out: string[] = [];
    const err: string[] = [];
    const orig = { log: console.log, warn: console.warn, error: console.error };
    console.log = (...a: unknown[]) => void out.push(a.join(" "));
    console.warn = (...a: unknown[]) => void err.push(a.join(" "));
    console.error = (...a: unknown[]) => void err.push(a.join(" "));
    try {
      const code = await new DashboardCommand().run({ cwd: root, positionals, flags });
      return { code, out: stripAnsi(out.join("\n")), err: stripAnsi(err.join("\n")) };
    } finally {
      Object.assign(console, orig);
    }
  }

  it("--json and --json --overview stay valid JSON; the skipped file is named on stderr", async () => {
    const root = dashboardFixture({ edges: true });
    for (const flags of [{ json: true }, { json: true, overview: true }]) {
      const { code, out, err } = await run(root, flags);
      expect(code).toBe(0);
      expect(() => JSON.parse(out)).not.toThrow();
      expect(err).toContain("skipped specs/009-broken/tasks.md: is a directory, not a file");
    }
  });

  it("--stories and story detail render instead of failing", async () => {
    const root = dashboardFixture({ edges: true });
    const table = await run(root, { stories: true });
    expect(table.code).toBe(0);
    expect(table.out).toContain("Description");
    expect(table.err).toContain("skipped specs/009-broken/tasks.md");
    const detail = await run(root, {}, ["009:US-1"]);
    expect(detail.code).toBe(0);
    expect(detail.out).toContain("009:US-1 — Story 1");
    expect(detail.out).toContain("progress:   0/0 tasks");
  });
});
