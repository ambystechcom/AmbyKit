import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { tempProject } from "../helpers/spec-project.js";

/**
 * 030:FR-024, SC-010 — the read-back check catches a converter bug. The converters are replaced by deliberately wrong ones;
 * migrate must skip every file they touch, leave the originals byte-identical and say why.
 */
vi.mock("../../src/core/migrate/convert-spec.js", async (orig) => {
  const real = await orig<typeof import("../../src/core/migrate/convert-spec.js")>();
  return {
    ...real,
    // bug: moves the metadata but records the wrong status
    convertSpec: (text: string, feature: string, o?: { dualWrite?: boolean }) => {
      const r = real.convertSpec(text, feature, o);
      return r.status === "converted" ? { ...r, text: r.text.replace(/status: done/, "status: draft") } : r;
    },
  };
});
vi.mock("../../src/core/migrate/convert-tasks.js", async (orig) => {
  const real = await orig<typeof import("../../src/core/migrate/convert-tasks.js")>();
  return {
    ...real,
    // bug: loses a task's ownership
    convertTasks: (text: string, o?: { dualWrite?: boolean }) => {
      const r = real.convertTasks(text, o);
      return r.status === "converted" ? { ...r, text: r.text.replace(/T001: \["src\/a\.ts"\]/, 'T001: ["src/elsewhere.ts"]') } : r;
    },
  };
});

const { migrateProject } = await import("../../src/core/migrate/run.js");

describe("migrate read-back (030, FR-024, SC-010)", () => {
  it("030:FR-024: a converter that changes the meaning is caught, the file is skipped and left untouched", () => {
    const files = {
      "spec.md": "---\nfeature: 901-ok\n---\n\n### US-1 — One\n\n- **status:** done\n",
      "tasks.md": "## Phase 1 — Go\n\n- [x] [T001] [US1] do it (src/a.ts)\n",
    };
    const dir = tempProject({ "901-ok": files });
    const res = migrateProject(dir, {});
    expect(res.counts).toEqual({ converted: 0, unchanged: 0, skipped: 2 });
    for (const r of res.records) {
      expect(r.reason).toMatch(/read-back check failed/);
      expect(r.fix).toMatch(/left untouched/);
    }
    expect(readFileSync(join(dir, "specs", "901-ok", "spec.md"), "utf8")).toBe(files["spec.md"]);
    expect(readFileSync(join(dir, "specs", "901-ok", "tasks.md"), "utf8")).toBe(files["tasks.md"]);
    expect(res.records.find((r) => r.file === "spec.md")?.reason).toMatch(/stories differs/);
    expect(res.records.find((r) => r.file === "tasks.md")?.reason).toMatch(/tasks differs/);
  });
});
