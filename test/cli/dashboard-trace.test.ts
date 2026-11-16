import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { renderQualityView } from "../../src/cli/ui/dashboard/quality-view.js";
import { initOverviewTui, reduceOverviewTui, renderOverviewTui, type OverviewTuiData } from "../../src/cli/ui/interactive/overview.js";
import { readProjectFeatures } from "../../src/core/checkouts.js";
import { specWith, traceFixture } from "../helpers/trace-fixture.js";

const TASKS = "---\nfeature: x\n---\n\n## Phase 1\n\n- [x] [T001] [US1] a (src/a.ts)\n- [ ] [T002] [US1] b (src/b.ts)\n";

const root = traceFixture({
  specs: {
    "001-covered": { "spec.md": specWith("FR-001", "FR-002"), "tasks.md": TASKS },
    "002-bare": { "spec.md": specWith("FR-001"), "tasks.md": TASKS },
    "003-none": { "spec.md": "---\nfeature: n\n---\n# Spec\n\n### US-1 — a  (priority: P1)\n", "tasks.md": TASKS },
  },
  files: { "t/a.test.ts": `it("001:FR-001: a", () => {});` },
});

async function dash(flags: Record<string, string | boolean>): Promise<string> {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  try {
    await new DashboardCommand().run({ cwd: root, positionals: [], flags });
  } finally {
    console.log = orig;
  }
  return lines.join("\n");
}

describe("dashboard coverage (feature 024)", () => {
  it("024:FR-012: --json --overview carries covered/total per feature, absent without requirements", async () => {
    const o = JSON.parse(await dash({ json: true, overview: true }));
    const by = Object.fromEntries(o.features.map((f: { name: string }) => [f.name, f]));
    expect(by["001-covered"].coverage).toEqual({ covered: 1, total: 2 });
    expect(by["002-bare"].coverage).toEqual({ covered: 0, total: 1 });
    expect(by["003-none"].coverage).toBeUndefined();
  });

  it("024:FR-012: the one-shot output shows cov n/m next to task progress", async () => {
    const out = await dash({});
    expect(out).toMatch(/001.*cov 1\/2/);
    expect(out).toMatch(/002.*cov 0\/1/);
  });

  it("024:FR-014: coverage reads as plain text on a plain terminal", async () => {
    const out = await dash({});
    // eslint-disable-next-line no-control-regex
    expect(out).not.toMatch(/\x1b\[/);
    expect(out).toContain("cov 0/1");
  });

  it("024:FR-013: the quality view lists uncovered requirements and findings", async () => {
    const { features } = await readProjectFeatures(root);
    const { detectCapabilities } = await import("../../src/cli/ui/capabilities.js");
    const caps = { ...detectCapabilities(), color: false, unicode: false, columns: 80 };
    const text = renderQualityView(caps, features, [{ key: "002", kind: "blocked", refs: [], reason: "blocked by US-9" }]);
    expect(text).toContain("FR-002");
    expect(text).toContain("THE SYSTEM SHALL do FR-002.");
    expect(text).toContain("blocked by US-9");
    expect(text).not.toContain("FR-001  THE SYSTEM SHALL do FR-001.\n  FR-001");
  });

  it("024:FR-013: key c opens the quality view and any key returns", async () => {
    const { features, issues } = await readProjectFeatures(root);
    const data = { features, issues, meta: {}, upNextCap: 5, burndownFor: () => "computing" } as unknown as OverviewTuiData;
    const { detectCapabilities } = await import("../../src/cli/ui/capabilities.js");
    const caps = { ...detectCapabilities(), color: false, unicode: false, columns: 100 };
    let s = reduceOverviewTui(data, initOverviewTui(), { name: "c", sequence: "c" } as never);
    expect(s.quality).toBe(true);
    expect(renderOverviewTui(caps, data, s)).toContain("UNCOVERED REQUIREMENTS");
    s = reduceOverviewTui(data, s, { name: "x", sequence: "x" } as never);
    expect(s.quality).toBe(false);
  });

  it("024:FR-012: a feature with no tests at all reads coverage zero, not an error", async () => {
    const o = JSON.parse(await dash({ json: true, overview: true }));
    expect(o.features.find((f: { name: string }) => f.name === "002-bare").coverage.covered).toBe(0);
  });
});
