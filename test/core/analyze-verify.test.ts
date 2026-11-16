import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { analyzeProject } from "../../src/core/analyze.js";

interface Phase {
  title: string;
  tasks: Array<{ done: boolean }>;
  /** The Verify line as written (without the list dash); undefined = the phase has none. */
  verify?: string;
}

/** A project with one feature per entry; feature N is `00N-f<N>`. */
function project(features: Phase[][]): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-020-av-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  features.forEach((phases, i) => {
    const id = `00${i + 1}`;
    const dir = join(root, "specs", `${id}-f${i + 1}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "spec.md"),
      `---\nfeature: ${id}-f${i + 1}\n---\n# F${i + 1}\n\n### US-1 — One  (priority: P1)\n\n- **status:** draft\n`,
    );
    let n = 0;
    const lines = ["---", `feature: ${id}-f${i + 1}`, "---", "", "# Tasks", ""];
    for (const p of phases) {
      lines.push(`## ${p.title}`, "");
      for (const t of p.tasks) {
        n += 1;
        lines.push(`- [${t.done ? "x" : " "}] [T00${n}] [US1] Work ${n} (src/${id}-${n}.ts)`);
      }
      if (p.verify) lines.push(`- **Verify:** ${p.verify}`);
      lines.push("");
    }
    writeFileSync(join(dir, "tasks.md"), lines.join("\n"));
  });
  return root;
}

async function analyze(root: string, flags: Record<string, string | boolean> = {}) {
  const lines: string[] = [];
  const orig = [console.log, console.warn, console.error];
  console.log = (...a: unknown[]) => void lines.push(a.join(" "));
  console.warn = console.log;
  console.error = console.log;
  try {
    const code = await new AnalyzeCommand().run({ cwd: root, positionals: [], flags });
    return { code, out: lines.join("\n") };
  } finally {
    [console.log, console.warn, console.error] = orig as [typeof console.log, typeof console.warn, typeof console.error];
  }
}

const open = [{ done: false }];
const done = [{ done: true }];

describe("analyze reports missing and failed Verify lines (spec 020, US-4, FR-009)", () => {
  it("FR-009: a phase of an unfinished feature with no Verify line is reported by id", () => {
    const report = analyzeProject(project([[{ title: "Phase 1", tasks: open }, { title: "Phase 2", tasks: open, verify: "`npm test`" }]]));
    expect(report.verifyIssues).toEqual([{ feature: "001", phase: "001:phase-1", title: "Phase 1", kind: "missing" }]);
  });

  it("FR-009: a phase whose last recorded Verify failed is reported with its reason", () => {
    const report = analyzeProject(project([[{ title: "Phase 1", tasks: done, verify: "`npm test` ✗ failed: 2 red" }]]));
    expect(report.verifyIssues).toEqual([
      { feature: "001", phase: "001:phase-1", title: "Phase 1", kind: "failed", why: "2 red" },
    ]);
  });

  it("FR-009: when every phase is verified there is nothing to report", () => {
    const report = analyzeProject(
      project([[{ title: "Phase 1", tasks: done, verify: "`npm test` ✓ passed" }, { title: "Phase 2", tasks: open, verify: "`npm run typecheck` ✓ passed" }]]),
    );
    expect(report.verifyIssues).toBeUndefined();
  });

  it("FR-011: a finished feature that predates the convention stays quiet", () => {
    const report = analyzeProject(project([[{ title: "Phase 1", tasks: done }, { title: "Phase 2", tasks: done }]]));
    expect(report.verifyIssues).toBeUndefined();
  });

  it("FR-009: a heading with no tasks is not a verifiable phase", () => {
    const report = analyzeProject(project([[{ title: "Notes", tasks: [] }, { title: "Phase 1", tasks: open, verify: "`npm test`" }]]));
    expect(report.verifyIssues).toBeUndefined();
  });

  it("FR-009: a failed phase is still reported when the feature is finished", () => {
    const report = analyzeProject(project([[{ title: "Phase 1", tasks: done, verify: "`npm test` failed: boom" }]]));
    expect(report.verifyIssues?.[0]).toMatchObject({ kind: "failed", phase: "001:phase-1", why: "boom" });
  });

  it("FR-011: findings never change the exit status; text groups missing phases per feature and names failures", async () => {
    const root = project([
      [{ title: "Phase 1", tasks: open }, { title: "Phase 2", tasks: open }],
      [{ title: "Phase 1", tasks: done, verify: "`npm test` ✗ failed: red" }],
    ]);
    const { code, out } = await analyze(root);
    expect(code).toBe(0);
    expect(out).toContain("Phases with no Verify line:");
    expect(out).toContain("001 — phase 1, 2");
    expect(out).toContain("002:phase-1 — Verify FAILED: red");
    // The same project without any Verify finding exits the same way.
    const clean = await analyze(project([[{ title: "Phase 1", tasks: done, verify: "`npm test` ✓ passed" }]]));
    expect(clean.code).toBe(0);
    expect(clean.out).not.toContain("Verify");
  });

  it("FR-013: --json lists the findings per phase under a new key and drops nothing existing", async () => {
    const root = project([[{ title: "Phase 1", tasks: open }]]);
    const { out } = await analyze(root, { json: true });
    const json = JSON.parse(out) as Record<string, unknown>;
    expect(json["verifyIssues"]).toEqual([{ feature: "001", phase: "001:phase-1", title: "Phase 1", kind: "missing" }]);
    for (const key of ["issues", "buildable", "orphans", "lanes"]) expect(json).toHaveProperty(key);
  });
});
