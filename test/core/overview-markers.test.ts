import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readFeatures } from "../../src/core/features.js";
import { computeOverview } from "../../src/core/overview.js";

function project(markers: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-020-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  const dir = join(root, "specs", "001-demo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "spec.md"),
    "---\nfeature: 001-demo\n---\n# Demo\n\n### US-1 — One  (priority: P1)\n\n- **status:** draft\n\n### US-2 — Two  (priority: P1)\n\n- **status:** draft\n",
  );
  const m = (s: string) => (markers ? s : "");
  writeFileSync(
    join(dir, "tasks.md"),
    [
      "---",
      "feature: 001-demo",
      "---",
      "",
      "# Tasks",
      "",
      "## Phase 1",
      "",
      `- [ ] [T001] [US1] Alpha (src/a.ts)${m(" ⚠ BLOCKED: waiting on API (v2)")}`,
      `- [ ] [T002] [US1] Beta (src/b.ts)${m(" ↪ DEVIATION: used a map")}`,
      "- [ ] [T003] [US2] Gamma (src/c.ts)",
      `- [x] [T004] [US2] Delta (src/d.ts)${m(" ⚠ BLOCKED: stale")}`,
      `- [ ] [T005] [US2] Epsilon (src/e.ts)${m(" BLOCKED:")}`,
      "",
    ].join("\n"),
  );
  return root;
}

const overview = (markers: boolean, filters = {}) => computeOverview(readFeatures(project(markers)).features, filters);

describe("overview: BLOCKED markers (spec 020, FR-010, FR-011)", () => {
  it("FR-010: an open blocked task becomes a task-blocked attention item keyed feature:task", () => {
    expect(overview(true).attention).toEqual([
      { key: "001:T001", kind: "task-blocked", refs: ["T001"], reason: "BLOCKED: waiting on API (v2)" },
      { key: "001:T005", kind: "task-blocked", refs: ["T005"], reason: "BLOCKED (no reason given)" },
    ]);
  });

  it("FR-004: a checked task that still carries a marker is not an attention item", () => {
    expect(overview(true).attention.map((a) => a.key)).not.toContain("001:T004");
  });

  it("FR-010: blocked tasks are not offered in Up next", () => {
    const next = overview(true).upNext;
    expect(next.items.map((i) => i.taskId)).toEqual(["T002", "T003"]);
    expect(next.eligible).toBe(2);
  });

  it("FR-010: FeatureRow.blocked counts open blocked tasks, and is omitted when zero", () => {
    expect(overview(true).features[0]!.blocked).toBe(2);
    const row = overview(false).features[0]!;
    expect("blocked" in row).toBe(false);
  });

  it("FR-011: with no markers the attention list and Up next are what they were", () => {
    const o = overview(false);
    expect(o.attention).toEqual([]);
    expect(o.upNext.items.map((i) => i.taskId)).toEqual(["T001", "T002", "T003", "T005"]);
  });

  it("FR-010: feature and status filters scope the blocked items", () => {
    expect(overview(true, { feature: "001" }).attention).toHaveLength(2);
    expect(overview(true, { feature: "999" }).attention).toEqual([]);
    expect(overview(true, { status: "draft" }).attention).toHaveLength(2);
    expect(overview(true, { status: "done" }).attention).toEqual([]);
  });
});
