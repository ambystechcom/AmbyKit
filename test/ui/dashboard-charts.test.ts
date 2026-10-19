import { describe, expect, it } from "vitest";
import type { FeatureRow } from "../../src/core/overview-types.js";
import { featureChart, featureLabel, plainFeatureChart } from "../../src/cli/ui/dashboard/feature-chart.js";
import { visibleWidth } from "../../src/cli/ui/dashboard/panel.js";
import { segmentWidths, statusBar, statusChart, statusLegend } from "../../src/cli/ui/dashboard/status-chart.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

const caps = fakeCapabilities({ color: false });
const counts = { done: 60, "in-progress": 2, draft: 5, blocked: 1, deferred: 1 } as const;

describe("status chart (US-2, FR-004, FR-006)", () => {
  it("largest-remainder widths fill the bar exactly; non-zero statuses get ≥ 1 cell", () => {
    const w = segmentWidths([60, 2, 5, 1, 1], 100);
    expect(w.reduce((a, b) => a + b, 0)).toBe(100);
    expect(w.every((x) => x >= 1)).toBe(true);
    expect(segmentWidths([1000, 1], 10)).toEqual([9, 1]);
    expect(segmentWidths([0, 0], 10)).toEqual([0, 0]);
  });

  it("each status has its own fill pattern, so the bar reads without color", () => {
    const bar = statusBar(caps, { done: 1, "in-progress": 1, draft: 1, blocked: 1, deferred: 1 }, 5);
    expect(bar).toBe("█▓░▚·");
    expect(statusBar(fakeCapabilities({ color: false, unicode: false }), { done: 1, blocked: 1 }, 2)).toBe("#!");
  });

  it("legend pairs glyph + word + count + share, omitting zero statuses (SC-006)", () => {
    expect(statusLegend(caps, counts, 200)).toEqual([
      "✓ done 60 (87%)   ◐ in-progress 2 (3%)   ○ draft 5 (7%)   ✗ blocked 1 (1%)   – deferred 1 (1%)",
    ]);
    expect(statusLegend(caps, { done: 3 }, 200, false)).toEqual(["✓ done 3"]);
  });

  it("legend wraps to the width; the chart is hidden with no stories", () => {
    const lines = statusLegend(caps, counts, 40);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(visibleWidth(l)).toBeLessThanOrEqual(40);
    expect(statusChart(caps, {}, 80)).toEqual([]);
  });

  it("color mode paints segments; NO_COLOR emits no ANSI", () => {
    expect(hasAnsi(statusChart(fakeCapabilities(), counts, 80).join("\n"))).toBe(true);
    expect(hasAnsi(statusChart(caps, counts, 80).join("\n"))).toBe(false);
  });
});

describe("feature completion chart (US-2, FR-005)", () => {
  const rows: FeatureRow[] = [
    { ref: "001", name: "001-core-and-claude-emitter", tasks: { done: 10, total: 10 }, percent: 100, phase: "done", clarifications: 0 },
    { ref: "014", name: "014-enhanced-dashboard", tasks: { done: 9, total: 26 }, percent: 35, phase: "implementing", clarifications: 0 },
    { ref: "015", name: "015-mcp-server", tasks: null, percent: null, phase: "planned", clarifications: 1 },
    { ref: "008-alpha", name: "008-alpha", tasks: { done: 0, total: 1 }, percent: 0, phase: "tasked", clarifications: 0 },
  ];

  it("matches the wide wireframe rows", () => {
    const out = featureChart(caps, rows, "wide").map(stripAnsi);
    expect(out[0]).toBe("FEATURE COMPLETION" + " ".repeat(55) + "phase         clarif.");
    expect(out[1]).toBe("001 core-and-claude-emitter        ██████████████████████████████ 100%   done          ·");
    expect(out[2]).toBe("014 enhanced-dashboard             ██████████▌░░░░░░░░░░░░░░░░░░░  35%   implementing  ·");
    expect(out[3]).toBe("015 mcp-server                     ╌╌╌ not planned ╌╌╌╌╌╌╌╌╌╌╌╌╌╌        planned       1");
  });

  it("a colliding number shows the directory name; long names truncate", () => {
    expect(featureLabel(rows[3]!)).toBe("008-alpha");
    const long = { ...rows[0]!, name: "001-" + "x".repeat(60) };
    expect(stripAnsi(featureChart(caps, [long], "narrow")[1]!)).toContain("…");
  });

  it("interactive cursor prefixes the selected row", () => {
    const out = featureChart(caps, rows, "wide", { index: 1, glyph: "▸" }).map(stripAnsi);
    expect(out[1]!.startsWith("  001")).toBe(true);
    expect(out[2]!.startsWith("▸ 014")).toBe(true);
  });

  it("plain rows use ASCII bars and the not-planned label", () => {
    const out = plainFeatureChart(fakeCapabilities({ color: false, unicode: false }), rows);
    expect(out[2]).toContain("###-------   35%");
    expect(out[3]).toContain("-- not planned --");
    expect(out.join("\n")).not.toMatch(/[^\x00-\x7f]/);
  });
});
