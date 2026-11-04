import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { analyzeProject } from "../../src/core/analyze.js";
import { phase, tasksMd, type PhaseDef } from "../helpers/tasks-fixture.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function project(phases: PhaseDef[]): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-lanes-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  const dir = join(root, "specs", "001-demo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "spec.md"), "---\nfeature: 001-demo\n---\n# Demo\n\n### US-1 — One  (priority: P1)\n\n- **status:** draft\n");
  writeFileSync(join(dir, "tasks.md"), tasksMd(phases, { feature: "001-demo" }));
  return root;
}

async function analyze(cwd: string, flags: Record<string, string | boolean> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const [oLog, oErr, oWarn] = [console.log, console.error, console.warn];
  console.log = (...a: unknown[]) => void out.push(a.join(" "));
  console.error = (...a: unknown[]) => void err.push(a.join(" "));
  console.warn = (...a: unknown[]) => void err.push(a.join(" "));
  try {
    const code = await new AnalyzeCommand().run({ cwd, positionals: [], flags });
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    [console.log, console.error, console.warn] = [oLog, oErr, oWarn];
  }
}

describe("ambykit analyze — lane conflicts (feature 015)", () => {
  it("exits 1 naming the ids and the path when two [P] tasks collide (FR-007, SC-001)", async () => {
    const root = project([
      phase(1, [
        { id: "T001", parallel: true, story: 1, paths: ["src/a.ts"] },
        { id: "T002", parallel: true, story: 1, paths: ["src/a.ts"] },
      ]),
    ]);
    const r = await analyze(root);
    expect(r.code).toBe(1);
    const text = r.out + r.err;
    expect(text).toContain("Lane conflicts");
    expect(text).toContain("T001, T002");
    expect(text).toContain("src/a.ts");
  });

  it("exits 0 for disjoint parallel tasks", async () => {
    const root = project([
      phase(1, [
        { id: "T001", parallel: true, story: 1, paths: ["src/a.ts"] },
        { id: "T002", parallel: true, story: 1, paths: ["src/b.ts"] },
      ]),
    ]);
    expect((await analyze(root)).code).toBe(0);
  });

  it("warns about path-less tasks without failing (FR-002)", async () => {
    const root = project([phase(1, [{ id: "T001", story: 1, paths: null }])]);
    const r = await analyze(root);
    expect(r.code).toBe(0);
    expect(r.out + r.err).toContain("001-demo:T001");
  });

  it("carries conflicts and declarations in --json", async () => {
    const root = project([
      phase(1, [
        { id: "T001", parallel: true, story: 1, paths: ["src/a.ts"] },
        { id: "T002", parallel: true, story: 1, paths: ["src/"] },
        { id: "T003", story: 1, paths: null },
      ]),
    ]);
    const r = await analyze(root, { json: true });
    expect(r.code).toBe(1);
    const j = JSON.parse(r.out);
    expect(j.lanes.conflicts).toEqual([{ feature: "001-demo", phase: 1, path: "src", tasks: ["T001", "T002"] }]);
    expect(j.lanes.declarations).toEqual([{ feature: "001-demo", task: "T003", issue: "missing" }]);
  });

  it("finds no lane conflicts in this repository's own specs (SC-009)", () => {
    expect(analyzeProject(REPO).lanes.conflicts).toEqual([]);
  });
});
