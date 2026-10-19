import { describe, expect, it } from "vitest";
import { readFeatures } from "../../src/core/features.js";
import { applyFilters, computeOverview } from "../../src/core/overview.js";
import { artifactLines } from "../../src/cli/ui/dashboard/feature-view.js";
import { visibleWidth } from "../../src/cli/ui/dashboard/panel.js";
import { renderFeatureView } from "../../src/cli/ui/dashboard/render-overview.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const meta = { crumb: [], cwd: "~/proj", version: "1.2.0" };

function view(dir: string, filters = {}, edges = false) {
  const { features, issues } = readFeatures(dashboardFixture({ edges }));
  const f = { ...filters, feature: dir };
  return {
    overview: computeOverview(features, f, { upNextCap: 5 }, issues),
    feature: applyFilters(features, f)[0]!,
    meta,
  };
}

describe("feature view (US-5, FR-010, FR-011, FR-015)", () => {
  it("header crumb and phase · percent; artifact, clarification and status panels", () => {
    const out = stripAnsi(renderFeatureView(fakeCapabilities({ color: false, columns: 100 }), view("002"))).split("\n");
    expect(out[0]).toMatch(/^◆ AmbyKit · dashboard › 002 widgets +implementing · 65%$/);
    expect(out[3]).toMatch(/^╭─ ARTIFACTS ─+╮ ╭─ OPEN CLARIFICATIONS · 0 ─+╮ ╭─ STATUS ─+╮$/);
    const text = out.join("\n");
    expect(text).toContain("✓ spec.md    4 stories");
    expect(text).toContain("○ ui.md      pending");
    expect(text).toContain("◐ tasks.md   13 / 20");
    expect(text).toContain("None — spec fully clarified.");
    expect(text).toContain("✓ 1  ◐ 1  ○ 1  ✗ 1  – 0");
    for (const l of out) expect(visibleWidth(l)).toBeLessThanOrEqual(100);
  });

  it("the story table adds a Waiting on column from Attention", () => {
    const text = stripAnsi(renderFeatureView(fakeCapabilities({ color: false, columns: 100 }), view("002")));
    expect(text).toMatch(/ID +Title +Progress +Status +Prio +Waiting on/);
    expect(text).toMatch(/US-3 .*✗ blocked .*US-2/);
    expect(text).toMatch(/US-4 .*○ draft .*US-2/);
  });

  it("Attention and Up next are scoped to the feature", () => {
    const text = stripAnsi(renderFeatureView(fakeCapabilities({ color: false, columns: 100 }), view("003")));
    expect(text).toContain("ATTENTION · 0");
    expect(text).toContain("UP NEXT · 5 of 8");
    expect(text).not.toContain("002:US-2");
  });

  it("clarifications list line and question", () => {
    const text = stripAnsi(renderFeatureView(fakeCapabilities({ color: false, columns: 100 }), view("004", {}, true)));
    expect(text).toContain("OPEN CLARIFICATIONS · 1");
    expect(text).toMatch(/⚠ L\d+ +which transport\?/);
  });

  it("artifact states follow ui sign-off and task completion", () => {
    const core = view("001").feature;
    expect(artifactLines(core).map((a) => `${a.file}:${a.state}:${a.detail}`)).toEqual([
      "spec.md:present:4 stories",
      "ui.md:present:signed off",
      "plan.md:present:",
      "tasks.md:present:12 / 12",
    ]);
  });

  it("narrow stacks the panels; plain is frameless text", () => {
    const narrow = stripAnsi(renderFeatureView(fakeCapabilities({ color: false, columns: 80 }), view("002"))).split("\n");
    expect(narrow[3]).toMatch(/^╭─ ARTIFACTS ─+╮$/);
    const plain = renderFeatureView(fakeCapabilities({ isTTY: false, color: false, unicode: false }), view("002"));
    expect(plain.split("\n")[0]).toBe("AmbyKit dashboard > 002 widgets  implementing  65%");
    expect(plain).toContain("OPEN CLARIFICATIONS 0");
    expect(plain).not.toMatch(/[╭│╰]/);
  });

  it("--status narrows the feature view too (FR-011)", () => {
    const text = stripAnsi(renderFeatureView(fakeCapabilities({ color: false, columns: 100 }), view("002", { status: "blocked" })));
    expect(text).toContain("US-3");
    expect(text).not.toMatch(/US-1 +Story 1/);
  });
});
