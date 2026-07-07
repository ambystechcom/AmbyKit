import { describe, expect, it } from "vitest";
import * as render from "../../src/cli/ui/render.js";
import { progressCell, renderTable, statusCell } from "../../src/cli/ui/table.js";
import { summarize } from "../../src/cli/ui/progress.js";
import type { Cell, ChangeSummary, TableColumn } from "../../src/cli/ui/types.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

const COLUMNS: TableColumn[] = [
  { header: "Story", min: 5, priority: 100 },
  { header: "Description", min: 8, priority: 80 },
  { header: "Progress", min: 15, priority: 90 },
  { header: "Status", min: 6, priority: 70 },
];
const ROWS: Cell[][] = [
  ["US-1", "Cohesive style", progressCell(7, 10), statusCell("in-progress")],
  ["US-2", "Dashboard viz", progressCell(10, 10), statusCell("done")],
];
const SUMMARY: ChangeSummary = {
  created: ["a"],
  updated: ["b", "c"],
  unchanged: ["d"],
  skipped: ["~/x"],
  wouldChange: [],
  dryRun: false,
};

describe("US-4 — non-TTY / NO_COLOR ⇒ zero ANSI (SC-002, FR-002/003)", () => {
  // Detection forces color:false when non-TTY or NO_COLOR; here we assert every component obeys it.
  const caps = fakeCapabilities({ isTTY: false, color: false, unicode: true, columns: 80 });

  it("message renderers emit no ANSI", () => {
    expect(hasAnsi(render.success(caps, "x"))).toBe(false);
    expect(hasAnsi(render.warn(caps, "x"))).toBe(false);
    expect(hasAnsi(render.error(caps, "x", "do y"))).toBe(false);
    expect(hasAnsi(render.heading(caps, "x"))).toBe(false);
  });

  it("table emits no ANSI", () => {
    expect(hasAnsi(renderTable(caps, { columns: COLUMNS, rows: ROWS, width: 80 }))).toBe(false);
  });

  it("summary emits no ANSI", () => {
    expect(hasAnsi(summarize(caps, SUMMARY))).toBe(false);
  });
});

describe("US-4 — unicode=false ⇒ ASCII everywhere (FR-012)", () => {
  const caps = fakeCapabilities({ color: false, unicode: false, columns: 80 });

  it("messages use ASCII glyphs", () => {
    expect(render.success(caps, "ok")).toBe("[ok] ok");
    expect(render.error(caps, "bad")).toBe("x bad");
  });

  it("progress bars use ASCII fill/empty", () => {
    const out = renderTable(caps, {
      columns: [{ header: "P", min: 15, priority: 1 }],
      rows: [[progressCell(5, 10)]],
      width: 40,
    });
    expect(out).toContain("#####-----");
    expect(out).not.toContain("█");
    expect(out).not.toContain("░");
  });
});

describe("US-4 — narrow width stays aligned (FR-007)", () => {
  for (const width of [80, 50, 30, 20]) {
    it(`width ${width}: nothing overflows and color doesn't shift layout`, () => {
      const model = { columns: COLUMNS, rows: ROWS, width };
      const colored = renderTable(fakeCapabilities({ color: true, unicode: true, columns: width }), model);
      const plain = renderTable(fakeCapabilities({ color: false, unicode: true, columns: width }), model);
      // No line exceeds the terminal width...
      for (const l of stripAnsi(colored).split("\n")) expect(l.length).toBeLessThanOrEqual(width);
      // ...and color is purely additive: stripping ANSI reproduces the plain layout exactly.
      expect(stripAnsi(colored)).toBe(plain);
    });
  }
});
