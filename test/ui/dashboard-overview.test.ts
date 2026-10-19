import { describe, expect, it } from "vitest";
import { readFeatures } from "../../src/core/features.js";
import { computeOverview } from "../../src/core/overview.js";
import { completionBar } from "../../src/cli/ui/dashboard/cards.js";
import { visibleWidth } from "../../src/cli/ui/dashboard/panel.js";
import { renderOverview } from "../../src/cli/ui/dashboard/render-overview.js";
import { dashboardFixture, emptyProject } from "../helpers/dashboard-fixture.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

const meta = { crumb: [], cwd: "~/proj", version: "1.2.0" };
const view = (root: string) => {
  const { features, issues } = readFeatures(root);
  return { overview: computeOverview(features, {}, { upNextCap: 5 }, issues), meta };
};
const lines = (s: string) => stripAnsi(s).split("\n");

describe("overview rendering — US-1 (FR-002, FR-013, FR-016)", () => {
  const base = view(dashboardFixture());

  it("wide (100 cols): header, rule, then four cards in one row", () => {
    const out = lines(renderOverview(fakeCapabilities({ color: false, columns: 100 }), base));
    expect(out.slice(0, 9)).toEqual([
      "◆ AmbyKit · dashboard" + " ".repeat(64) + "~/proj · v1.2.0",
      "━".repeat(100),
      "",
      "╭─ FEATURES ───────╮ ╭─ STORIES ────────╮ ╭─ TASKS ──────────╮ ╭─ COMPLETE ────────────────────────╮",
      "│ 3                │ │ 10               │ │ 25 / 40          │ │ 63%                               │",
      "│ 1 done · 2 open  │ │ 5 done · 5 open  │ │ 15 open          │ │ ███████████████████▌░░░░░░░░░░░   │",
      "╰──────────────────╯ ╰──────────────────╯ ╰──────────────────╯ ╰───────────────────────────────────╯",
    ].concat(out.slice(7, 9)));
    for (const l of out) expect(visibleWidth(l)).toBeLessThanOrEqual(100);
  });

  it("narrow (80 cols): cards in a 2×2 grid", () => {
    const out = lines(renderOverview(fakeCapabilities({ color: false, columns: 80 }), base));
    expect(out[3]).toMatch(/^╭─ FEATURES ─+╮ ╭─ STORIES ─+╮$/);
    expect(out[7]).toMatch(/^╭─ TASKS ─+╮ ╭─ COMPLETE ─+╮$/);
    for (const l of out) expect(visibleWidth(l)).toBeLessThanOrEqual(80);
  });

  it("ASCII terminals get ASCII frames, bar and separators", () => {
    const out = lines(renderOverview(fakeCapabilities({ color: false, unicode: false, columns: 80 }), base));
    expect(out[0]).toMatch(/^# AmbyKit - dashboard/);
    expect(out[1]).toBe("=".repeat(80));
    expect(out.join("\n")).toContain("| 1 done - 2 open");
    expect(out.join("\n")).not.toMatch(/[^\x00-\x7f]/);
  });

  it("NO_COLOR keeps the layout and emits no ANSI (SC-006)", () => {
    const out = renderOverview(fakeCapabilities({ color: false, columns: 100 }), base);
    expect(hasAnsi(out)).toBe(false);
    expect(out).toContain("63%");
  });

  it("color output paints values bold and stays aligned", () => {
    const out = renderOverview(fakeCapabilities({ columns: 100 }), base);
    expect(hasAnsi(out)).toBe(true);
    for (const l of out.split("\n")) expect(visibleWidth(l)).toBeLessThanOrEqual(100);
  });

  it("plain layout for non-TTY: static one-line summary, no frames (FR-016)", () => {
    const out = renderOverview(fakeCapabilities({ isTTY: false, color: false, unicode: false }), base);
    expect(out.split("\n").slice(0, 3)).toEqual([
      "AmbyKit dashboard  ~/proj  v1.2.0",
      "",
      "FEATURES 3 (1 done)   STORIES 10 (5 done)   TASKS 25/40   COMPLETE 63%",
    ]);
    expect(out).not.toMatch(/[╭│╰]/);
  });

  it("a TTY narrower than min-columns also gets the plain layout", () => {
    const out = renderOverview(fakeCapabilities({ color: false, columns: 50 }), base);
    expect(out.startsWith("AmbyKit dashboard")).toBe(true);
  });

  it("empty project: zeroed cards, dash for COMPLETE, and the /amby.specify hint (FR-013)", () => {
    const out = lines(renderOverview(fakeCapabilities({ color: false, columns: 100 }), view(emptyProject())));
    expect(out[4]).toContain("│ 0 ");
    expect(out[4]).toContain("│ 0 / 0 ");
    expect(out[4]).toContain("│ —  ");
    expect(out[5]).toContain("│ —  ");
    expect(out.at(-1)).toBe("No features yet. Run /amby.specify in your assistant to create the first spec.");
    const plain = renderOverview(fakeCapabilities({ isTTY: false, color: false, unicode: false }), view(emptyProject()));
    expect(plain).toContain("COMPLETE -");
    expect(plain).toContain("Run /amby.specify");
  });

  it("parse issues show one notice line under the header (FR-014)", () => {
    const out = lines(renderOverview(fakeCapabilities({ color: false, columns: 100 }), view(dashboardFixture({ edges: true }))));
    expect(out[2]).toBe("⚠ skipped specs/009-broken/tasks.md: is a directory, not a file");
  });

  it("the header drops the path, then the version, rather than wrapping", () => {
    const longMeta = { crumb: [], cwd: "~/" + "x".repeat(80), version: "1.2.0" };
    const out = lines(renderOverview(fakeCapabilities({ color: false, columns: 80 }), { ...base, meta: longMeta }));
    expect(out[0]).toMatch(/v1\.2\.0$/);
    expect(out[0]).not.toContain("xxxx");
  });
});

describe("completionBar", () => {
  const caps = fakeCapabilities({ color: false });
  it("is exactly `width` cells and uses eighth blocks", () => {
    expect(completionBar(caps, 0.5, 10)).toBe("█████░░░░░");
    expect(completionBar(caps, 0.55, 10)).toBe("█████▌░░░░");
    expect(completionBar(caps, 1, 4)).toBe("████");
    expect(completionBar(caps, null, 4)).toBe("░░░░");
  });
  it("ASCII rounds to whole cells", () => {
    expect(completionBar(fakeCapabilities({ color: false, unicode: false }), 0.55, 10)).toBe("#####-----");
  });
});
