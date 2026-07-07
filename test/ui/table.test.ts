import { describe, expect, it } from "vitest";
import { progressCell, renderTable, statusCell } from "../../src/cli/ui/table.js";
import type { Cell, TableColumn } from "../../src/cli/ui/types.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const COLUMNS: TableColumn[] = [
  { header: "Feat", min: 3, priority: 50 },
  { header: "Story", min: 5, priority: 100 },
  { header: "Description", min: 8, priority: 80 },
  { header: "Progress", min: 15, priority: 90 },
  { header: "Status", min: 6, priority: 70 },
  { header: "Prio", min: 4, priority: 40 },
  { header: "Blocked-by", min: 6, priority: 30 },
];

function sampleRows(): Cell[][] {
  return [
    ["006", "US-1", "Cohesive style", progressCell(7, 10), statusCell("in-progress"), "P1", "-"],
    ["006", "US-2", "Dashboard viz", progressCell(10, 10), statusCell("done"), "P1", "-"],
    ["006", "US-6", "Interactive view", progressCell(0, 10), statusCell("draft"), "P3", "US-2"],
  ];
}

function maxVisibleWidth(out: string): number {
  return Math.max(...stripAnsi(out).split("\n").map((l) => l.length));
}

describe("renderTable — fitting (FR-007)", () => {
  for (const width of [120, 80, 40]) {
    it(`never overflows width ${width}`, () => {
      const out = renderTable(fakeCapabilities({ columns: width }), {
        columns: COLUMNS,
        rows: sampleRows(),
        width,
      });
      expect(maxVisibleWidth(out)).toBeLessThanOrEqual(width);
    });
  }

  it("drops lowest-priority columns first when narrow", () => {
    const out = stripAnsi(
      renderTable(fakeCapabilities({ columns: 40 }), { columns: COLUMNS, rows: sampleRows(), width: 40 }),
    );
    const header = out.split("\n")[0]!;
    // Story/Progress/Description are the top-3 priorities → kept; Blocked-by/Prio → dropped first.
    expect(header).toContain("Story");
    expect(header).toContain("Progress");
    expect(header).not.toContain("Blocked-by");
    expect(header).not.toContain("Prio");
  });

  it("keeps all columns when the terminal is wide", () => {
    const header = stripAnsi(
      renderTable(fakeCapabilities({ columns: 120 }), { columns: COLUMNS, rows: sampleRows(), width: 120 }),
    ).split("\n")[0]!;
    for (const c of COLUMNS) expect(header).toContain(c.header);
  });
});

describe("renderTable — progress cell (FR-004)", () => {
  it("reflects the fill ratio and percent", () => {
    const out = stripAnsi(
      renderTable(fakeCapabilities({ unicode: true }), {
        columns: [{ header: "P", min: 15, priority: 1 }],
        rows: [[progressCell(7, 10)]],
        width: 40,
      }),
    );
    expect(out).toContain("███████░░░  70%");
  });

  it("distinguishes 0% / partial / 100% and uses ASCII bars when unicode is off (FR-012)", () => {
    const render = (done: number, unicode: boolean) =>
      stripAnsi(
        renderTable(fakeCapabilities({ unicode }), {
          columns: [{ header: "P", min: 15, priority: 1 }],
          rows: [[progressCell(done, 10)]],
          width: 40,
        }),
      ).split("\n")[2]!;
    expect(render(0, true)).toContain("░░░░░░░░░░   0%");
    expect(render(10, true)).toContain("██████████ 100%");
    expect(render(5, false)).toContain("#####-----  50%");
  });
});

describe("renderTable — alignment with color (FR-004/007)", () => {
  it("stays aligned even though status cells carry ANSI", () => {
    const out = renderTable(fakeCapabilities({ color: true, unicode: true }), {
      columns: COLUMNS,
      rows: sampleRows(),
      width: 120,
    });
    const lines = stripAnsi(out).split("\n");
    // header underline rule width equals header width → columns are aligned
    expect(lines[0]!.length).toBe(lines[1]!.length);
  });
});
