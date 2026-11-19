import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MigrateCommand } from "../../src/cli/migrate.js";
import { migrateProject } from "../../src/core/migrate/run.js";
import { readSpec } from "../../src/core/spec-format/dispatch.js";
import { runCommand } from "../helpers/run-command.js";
import { NO_FRONTMATTER, UNSAFE, tempProject } from "../helpers/spec-project.js";
import { hashTree, listFiles } from "../helpers/tree-hash.js";

const GOOD = {
  "spec.md": "---\nfeature: 901-ok\n---\n\n### US-1 — One  (priority: P1)\n\n- **status:** done\n",
  "tasks.md": "## Phase 1 — Go\n\n- [x] [T001] [US1] do it (src/a.ts)\n- **Verify:** `npm test` ✓ passed\n",
};
const read = (dir: string, f: string, file: string): string => readFileSync(join(dir, "specs", f, file), "utf8");
/** The eight files of the unsafe set that migrate must not touch (915 and 916 have a clean spec next to an unsafe tasks file). */
const UNSAFE_FILES = [
  "910-prose-meta/spec.md",
  "911-two-status/spec.md",
  "913-mixed-eol/spec.md",
  "914-fenced/spec.md",
  "914-fenced/tasks.md",
  "915-dup-verify/tasks.md",
  "916-dup-id/tasks.md",
  "917-bom/spec.md",
];

describe("migrate leaves unsafe files untouched (030, US-5, FR-006)", () => {
  it("030:FR-006: every unsafe file is skipped, byte-identical, and listed with its reason and the fix", async () => {
    const dir = tempProject({ ...UNSAFE, "901-ok": GOOD });
    const before = Object.fromEntries(UNSAFE_FILES.map((key) => [key, read(dir, key.split("/")[0] as string, key.split("/")[1] as string)]));
    const r = await runCommand(new MigrateCommand(), dir, [], {});
    for (const [key, text] of Object.entries(before)) {
      const [f, n] = key.split("/") as [string, string];
      expect(read(dir, f, n), key).toBe(text);
    }
    expect(r.out).toMatch(/Total: 4 converted, 0 unchanged, 8 skipped/);
    expect(r.out).toMatch(/SKIPPED {2}untouched: story metadata inside prose/);
    expect(r.out).toMatch(/SKIPPED {2}untouched: .*two status bullets/);
    expect(r.out).toMatch(/SKIPPED {2}untouched: mixed line endings/);
    expect(r.out).toMatch(/SKIPPED {2}untouched: story metadata inside a code fence/);
    expect(r.out).toMatch(/SKIPPED {2}untouched: .*Verify lines/);
    expect(r.out).toMatch(/SKIPPED {2}untouched: .*repeats a task id/);
    expect(r.out).toMatch(/SKIPPED {2}untouched: file starts with a byte-order mark/);
    expect(r.out.match(/ fix: /g)?.length).toBeGreaterThanOrEqual(7);
    expect(r.err).toMatch(/8 file\(s\) were left untouched/);
    expect(readSpec("901-ok", read(dir, "901-ok", "spec.md")).format).toBe(2);
  });

  it("030:FR-005: a spec with no frontmatter is converted, with minimal frontmatter, and the report says so", async () => {
    const dir = tempProject(NO_FRONTMATTER);
    const r = await runCommand(new MigrateCommand(), dir, [], {});
    expect(read(dir, "912-no-frontmatter", "spec.md").startsWith("---\nformat: 2\nfeature: 912-no-frontmatter\nstories:")).toBe(true);
    expect(r.out).toContain("added minimal frontmatter");
  });

  it("030:FR-009: after a run with skips, a rerun converts nothing new and the skips stay skipped and untouched", async () => {
    const dir = tempProject({ ...UNSAFE, "901-ok": GOOD });
    await runCommand(new MigrateCommand(), dir, [], {});
    const hash = hashTree(dir);
    const again = await runCommand(new MigrateCommand(), dir, [], {});
    expect(hashTree(dir)).toBe(hash);
    expect(again.out).toMatch(/Total: 0 converted/);
    expect(again.out).toMatch(/SKIPPED/);
  });
});

describe("migrate writes each file once, complete or not at all (030, FR-010, FR-024)", () => {
  it("030:FR-010: an interrupted write (the rename fails) leaves the original and no temp file, and a rerun completes", () => {
    const dir = tempProject({ "901-ok": GOOD });
    const hash = hashTree(dir);
    const failing = migrateProject(dir, {
      ops: {
        rename: () => {
          throw new Error("disk went away");
        },
      },
    });
    expect(failing.records.every((r) => r.status === "skipped")).toBe(true);
    expect(failing.records[0]?.reason).toMatch(/could not write the file \(disk went away\)/);
    expect(listFiles(dir).filter((f) => f.endsWith(".migrate-tmp"))).toEqual([]);
    expect(hashTree(dir).length).toBe(hash.length);
    expect(read(dir, "901-ok", "spec.md")).toBe(GOOD["spec.md"]);
    expect(read(dir, "901-ok", "tasks.md")).toBe(GOOD["tasks.md"]);
    const rerun = migrateProject(dir, {});
    expect(rerun.counts).toEqual({ converted: 2, unchanged: 0, skipped: 0 });
    expect(readSpec("901-ok", read(dir, "901-ok", "spec.md")).format).toBe(2);
  });

  it("030:FR-010: a stray temp file left by a killed run is ignored and overwritten", () => {
    const dir = tempProject({ "901-ok": GOOD });
    writeFileSync(join(dir, "specs", "901-ok", "spec.md.migrate-tmp"), "half written");
    const res = migrateProject(dir, {});
    expect(res.counts.converted).toBe(2);
    expect(listFiles(dir).filter((f) => f.endsWith(".migrate-tmp"))).toEqual([]);
  });

  it("030:FR-024: a file edited between the read and the write is skipped and keeps the edit", () => {
    const dir = tempProject({ "901-ok": GOOD });
    const edited = GOOD["spec.md"] + "\nA person added this line meanwhile.\n";
    const res = migrateProject(dir, {
      hooks: {
        beforeWrite: (file) => {
          if (file.endsWith("spec.md")) writeFileSync(file, edited);
        },
      },
    });
    const spec = res.records.find((r) => r.file === "spec.md");
    expect(spec).toMatchObject({ status: "skipped", reason: expect.stringMatching(/edited while migrate was running/) });
    expect(read(dir, "901-ok", "spec.md")).toBe(edited);
    expect(res.records.find((r) => r.file === "tasks.md")?.status).toBe("converted");
  });

  it("030:FR-007: a dry run runs the same checks but never the write path", () => {
    const dir = tempProject({ ...UNSAFE, "901-ok": GOOD });
    const hash = hashTree(dir);
    let wrote = 0;
    const res = migrateProject(dir, { dryRun: true, ops: { write: () => void (wrote += 1), rename: () => void (wrote += 1) } });
    expect(wrote).toBe(0);
    expect(hashTree(dir)).toBe(hash);
    expect(res.counts.converted).toBe(4);
    expect(res.counts.skipped).toBe(8);
    expect(res.config.written).toBe(false);
  });
});
