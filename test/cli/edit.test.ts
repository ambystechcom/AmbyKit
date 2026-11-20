import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EditCommand } from "../../src/cli/edit.js";
import { readSpec, readTasks } from "../../src/core/spec-format/dispatch.js";
import { runCommand } from "../helpers/run-command.js";

const TWINS = join(import.meta.dirname, "..", "fixtures", "spec-format-twins");

function twin(kind: "v1" | "v2"): string {
  const dir = mkdtempSync(join(tmpdir(), `ambykit-030-editcmd-${kind}-`));
  mkdirSync(join(dir, ".amby"), { recursive: true });
  writeFileSync(join(dir, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  cpSync(join(TWINS, kind, "specs"), join(dir, "specs"), { recursive: true });
  return dir;
}
const file = (dir: string, f: string): string => join(dir, "specs", "001-twin", f);
const edit = (dir: string, positionals: string[], flags: Record<string, string | boolean> = {}) => runCommand(new EditCommand(), dir, positionals, flags);

describe("ambykit edit (030, US-10, FR-020)", () => {
  it("030:FR-020: files — sets a task's files in a v2 project and prints one line", async () => {
    const dir = twin("v2");
    const r = await edit(dir, ["files", "001", "T020", "docs/new.md", "docs/other.md"]);
    expect(r).toMatchObject({ code: 0, out: "T020 files set: docs/new.md, docs/other.md" });
    expect(readTasks(readFileSync(file(dir, "tasks.md"), "utf8")).tasks.find((t) => t.id === "T020")?.paths).toEqual(["docs/new.md", "docs/other.md"]);
  });

  it("030:FR-020: files — the same command edits the trailing group of a 1.x project", async () => {
    const dir = twin("v1");
    const r = await edit(dir, ["files", "001-twin", "T020", "docs/new.md"]);
    expect(r).toMatchObject({ code: 0, out: "T020 files set: docs/new.md" });
    expect(readFileSync(file(dir, "tasks.md"), "utf8")).toContain("[T020] [US4] Docs (docs/new.md)");
  });

  it("030:FR-020: verify — records a result and a reason, in v2 and in 1.x", async () => {
    const b = twin("v2");
    const rb = await edit(b, ["verify", "001", "2"], { result: "failed", why: "2 red" });
    expect(rb).toMatchObject({ code: 0, out: "phase 2 Verify failed: 2 red" });
    expect(readTasks(readFileSync(file(b, "tasks.md"), "utf8")).phases.find((p) => p.phase === 2)).toMatchObject({ result: "failed", why: "2 red" });
    const a = twin("v1");
    await edit(a, ["verify", "001", "phase-2"], { result: "passed" });
    expect(readTasks(readFileSync(file(a, "tasks.md"), "utf8")).phases.find((p) => p.phase === 2)).toMatchObject({ result: "passed" });
  });

  it("030:FR-020: status — sets a story's status in v2 frontmatter and in a 1.x bullet", async () => {
    const b = twin("v2");
    expect(await edit(b, ["status", "001", "US-3", "in-progress"])).toMatchObject({ code: 0, out: "US-3 status set: in-progress" });
    expect(readSpec("001-twin", readFileSync(file(b, "spec.md"), "utf8")).stories.find((s) => s.id === "US3")?.status).toBe("in-progress");
    const a = twin("v1");
    await edit(a, ["status", "001", "US-3", "in-progress"]);
    expect(readSpec("001-twin", readFileSync(file(a, "spec.md"), "utf8")).stories.find((s) => s.id === "US3")?.status).toBe("in-progress");
  });

  it("030:FR-020: refuses an unknown task, story, phase and feature, an invalid status and result, and a glob — exit 1, file unchanged", async () => {
    const dir = twin("v2");
    const tasksBefore = readFileSync(file(dir, "tasks.md"), "utf8");
    const specBefore = readFileSync(file(dir, "spec.md"), "utf8");
    const cases: [string[], Record<string, string>, RegExp][] = [
      [["files", "001", "T999", "src/a.ts"], {}, /unknown task T999/],
      [["files", "001", "T020", "src/**/*.ts"], {}, /glob/],
      [["verify", "001", "99"], { result: "passed" }, /unknown phase 99/],
      [["verify", "001", "1"], { result: "maybe" }, /invalid result/],
      [["status", "001", "US-9", "done"], {}, /unknown story/],
      [["status", "001", "US-1", "finished"], {}, /invalid status/],
      [["status", "999", "US-1", "done"], {}, /feature '999' not found/],
    ];
    for (const [pos, flags, re] of cases) {
      const r = await edit(dir, pos, flags);
      expect(r.code, pos.join(" ")).toBe(1);
      expect(r.err, pos.join(" ")).toMatch(re);
    }
    expect(readFileSync(file(dir, "tasks.md"), "utf8")).toBe(tasksBefore);
    expect(readFileSync(file(dir, "spec.md"), "utf8")).toBe(specBefore);
  });

  it("030:FR-020: missing arguments print the usage and exit 1", async () => {
    const dir = twin("v2");
    for (const pos of [[], ["files"], ["files", "001"], ["verify", "001", "1"], ["status", "001", "US-1"], ["nope", "001"]]) {
      const r = await edit(dir, pos);
      expect(r.code, pos.join(" ")).toBe(1);
      expect(r.err).toMatch(/Usage|Missing/);
    }
  });

  it("030:FR-020: a v2 file with a located error is refused, naming file and line", async () => {
    const dir = twin("v2");
    writeFileSync(file(dir, "tasks.md"), "---\nformat: 2\n---\n## Phase 1\n\n- [ ] [T001] a\n```yaml\nfiles: [\n```\n");
    const r = await edit(dir, ["files", "001", "T001", "src/a.ts"]);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/fix the file first.*tasks\.md:\d+/);
  });
});
