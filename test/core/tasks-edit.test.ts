import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseStories, parseTasks } from "../../src/core/dashboard.js";
import { LOCK_DIR } from "../../src/core/fleet/lock.js";
import { setStoryStatus, tickTask } from "../../src/core/tasks-edit.js";
import { project, type TaskFx } from "../mcp/fixture.js";

const tasks: TaskFx[] = [
  { id: "T001", story: 1, done: true },
  { id: "T002", story: 1, parallel: true, paths: ["src/a.ts"] },
  { id: "T003", story: 2, paths: ["src/b.ts"], marker: "↪ DEVIATION: used a map" },
  { id: "T004", story: 2, marker: "⚠ BLOCKED: waiting" },
];
const make = () => project([{ dir: "001-alpha", stories: [{ n: 1, status: "in-progress" }, { n: 2, dependsOn: ["US-1"] }], phases: [{ title: "Work", tasks }] }]);
const tasksFile = (root: string) => join(root, "specs", "001-alpha", "tasks.md");
const diffLines = (a: string, b: string): number => {
  const x = a.split("\n");
  const y = b.split("\n");
  return Math.max(x.length, y.length) - x.filter((l, i) => l === y[i]).length;
};

describe("tickTask", () => {
  it("025:FR-003: flips only that task's checkbox: exactly one changed line", () => {
    const root = make();
    const before = readFileSync(tasksFile(root), "utf8");
    expect(tickTask(root, "001", "T002")).toEqual({ ok: true, ticked: "T002", feature: "001-alpha" });
    const after = readFileSync(tasksFile(root), "utf8");
    expect(diffLines(before, after)).toBe(1);
    expect(parseTasks(after).find((t) => t.id === "T002")?.done).toBe(true);
  });

  it("025:SC-002: re-parsing after the write gives the same tasks, paths and markers, apart from the tick", () => {
    const root = make();
    const before = parseTasks(readFileSync(tasksFile(root), "utf8"));
    tickTask(root, "001", "T003");
    const after = parseTasks(readFileSync(tasksFile(root), "utf8"));
    expect(after.map((t) => ({ ...t, done: false }))).toEqual(before.map((t) => ({ ...t, done: false })));
    expect(after.find((t) => t.id === "T003")).toMatchObject({ done: true, deviation: "used a map", paths: ["src/b.ts"] });
  });

  it("025:FR-003: refuses an unknown task, naming it", () => {
    const out = tickTask(make(), "001", "T099");
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.error).toMatch(/task 'T099' not found/);
  });

  it("025:FR-003: refuses an already-checked task and leaves the file alone", () => {
    const root = make();
    const before = readFileSync(tasksFile(root), "utf8");
    const out = tickTask(root, "001", "T001");
    expect(!out.ok && out.error).toMatch(/already checked/);
    expect(readFileSync(tasksFile(root), "utf8")).toBe(before);
  });

  it("025:FR-003: accepts a lower-case id and the directory name", () => {
    expect(tickTask(make(), "001-alpha", "t002")).toMatchObject({ ok: true, ticked: "T002" });
  });

  it("025:FR-002: an unknown feature or a feature with no tasks.md is an error", () => {
    expect(tickTask(make(), "404", "T001")).toMatchObject({ ok: false });
    const r = project([{ dir: "001-alpha", stories: [{ n: 1 }] }]);
    expect(tickTask(r, "001", "T001")).toMatchObject({ ok: false });
  });

  it("025:FR-003: keeps CRLF line endings", () => {
    const root = make();
    writeFileSync(tasksFile(root), readFileSync(tasksFile(root), "utf8").replace(/\n/g, "\r\n"));
    tickTask(root, "001", "T002");
    const after = readFileSync(tasksFile(root), "utf8");
    expect(after.split("\r\n").length).toBeGreaterThan(5);
    expect(after.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });

  it("025:FR-005: a busy lock returns an error and writes nothing; once free, the tick lands", () => {
    const root = make();
    mkdirSync(join(root, LOCK_DIR), { recursive: true });
    const lock = join(root, LOCK_DIR, "tasks-001-alpha.lock");
    writeFileSync(lock, JSON.stringify({ pid: 1, at: new Date().toISOString() }));
    const before = readFileSync(tasksFile(root), "utf8");
    // the wait is 2 s by default; a fresh foreign lock makes the call fail soft
    const busy = tickTask(root, "001", "T002");
    expect(!busy.ok && busy.error).toMatch(/busy/);
    expect(readFileSync(tasksFile(root), "utf8")).toBe(before);
    writeFileSync(lock, JSON.stringify({ pid: 1, at: new Date(Date.now() - 60_000).toISOString() }));
    expect(tickTask(root, "001", "T002")).toMatchObject({ ok: true });
  });

  it("025:FR-005: re-parse after every write: ticking every open task in turn never breaks the file", () => {
    const root = make();
    for (const id of ["T002", "T003", "T004"]) {
      expect(tickTask(root, "001", id)).toMatchObject({ ok: true });
      expect(parseTasks(readFileSync(tasksFile(root), "utf8"))).toHaveLength(4);
    }
    expect(parseTasks(readFileSync(tasksFile(root), "utf8")).every((t) => t.done)).toBe(true);
  });

  const dist = resolve(__dirname, "..", "..", "dist", "core", "tasks-edit.js");
  it.skipIf(!existsSync(dist))("025:FR-005: several processes ticking different tasks at once all survive (needs `npm run build`)", () => {
    const root = project([
      { dir: "001-alpha", stories: [{ n: 1 }], phases: [{ title: "Work", tasks: Array.from({ length: 6 }, (_, i) => ({ id: `T00${i + 1}`, story: 1 })) }] },
    ]);
    const script = `import { tickTask } from ${JSON.stringify("file:///" + dist.replace(/\\/g, "/"))};
      const r = tickTask(process.argv[1], "001", process.argv[2]); if (!r.ok) { console.error(r.error); process.exit(1); }`;
    const procs = ["T001", "T002", "T003", "T004", "T005", "T006"].map(
      (id) =>
        new Promise<void>((done, bad) => {
          import("node:child_process").then(({ execFile }) =>
            execFile(process.execPath, ["--input-type=module", "-e", script, root, id], (err) => (err ? bad(err) : done())),
          );
        }),
    );
    return Promise.all(procs).then(() => {
      expect(parseTasks(readFileSync(tasksFile(root), "utf8")).filter((t) => t.done)).toHaveLength(6);
    });
  });
});

describe("setStoryStatus", () => {
  const specFile = (root: string) => join(root, "specs", "001-alpha", "spec.md");

  it("025:FR-004: changes only that story's status line", () => {
    const root = make();
    const before = readFileSync(specFile(root), "utf8");
    expect(setStoryStatus(root, "001", "US-2", "done")).toEqual({ ok: true, story: "US-2", status: "done", feature: "001-alpha" });
    const after = readFileSync(specFile(root), "utf8");
    expect(diffLines(before, after)).toBe(1);
    const stories = parseStories(after, "001-alpha");
    expect(stories.find((s) => s.id === "US2")?.status).toBe("done");
    expect(stories.find((s) => s.id === "US1")?.status).toBe("in-progress");
    expect(stories.find((s) => s.id === "US2")?.dependsOn).toEqual(parseStories(before, "001-alpha").find((s) => s.id === "US2")?.dependsOn);
  });

  it("025:FR-004: refuses an invalid value and lists the allowed ones", () => {
    const root = make();
    const before = readFileSync(specFile(root), "utf8");
    const out = setStoryStatus(root, "001", "US-1", "finished");
    expect(!out.ok && out.error).toMatch(/allowed: draft, ready, in-progress, blocked, done/);
    expect(readFileSync(specFile(root), "utf8")).toBe(before);
  });

  it("025:FR-002: an unknown story is an error naming it and the real ones", () => {
    const out = setStoryStatus(make(), "001", "US-7", "done");
    expect(!out.ok && out.error).toMatch(/story 'US-7' not found.*US-1, US-2/);
  });

  it("025:FR-004: accepts 001:US-1 and US1", () => {
    expect(setStoryStatus(make(), "001", "001:US-1", "blocked")).toMatchObject({ ok: true, story: "US-1" });
    expect(setStoryStatus(make(), "001", "US1", "ready")).toMatchObject({ ok: true });
  });
});

describe("tickTask releases claims (feature 025, FR-015)", () => {
  it("025:FR-015: ticking a task frees its claims in the feature's unfinished run, and no one else's", async () => {
    const { createRun } = await import("../../src/core/fleet/runs.js");
    const { claimFiles, readClaims } = await import("../../src/core/fleet/claims.js");
    const root = make();
    const out = createRun(root, "001-alpha");
    if (!out.ok) throw new Error(out.warning);
    const run = out.run.run;
    claimFiles(root, run, { task: "T002", files: ["src/a.ts", "src/b.ts"], worker: "lane-1-1" });
    claimFiles(root, run, { task: "T003", files: ["src/c.ts"], worker: "lane-1-2" });
    expect(tickTask(root, "001", "T002")).toMatchObject({ ok: true });
    expect(Object.keys(readClaims(root, run))).toEqual(["src/c.ts"]);
  });

  it("025:FR-015: with no run at all the tick still succeeds", () => {
    expect(tickTask(make(), "001", "T002")).toMatchObject({ ok: true });
  });

  it("025:FR-015: a refused tick (already checked) leaves the claims alone", async () => {
    const { createRun } = await import("../../src/core/fleet/runs.js");
    const { claimFiles, readClaims } = await import("../../src/core/fleet/claims.js");
    const root = make();
    const out = createRun(root, "001-alpha");
    if (!out.ok) throw new Error(out.warning);
    claimFiles(root, out.run.run, { task: "T001", files: ["src/a.ts"], worker: "w" });
    expect(tickTask(root, "001", "T001")).toMatchObject({ ok: false }); // T001 is already checked in the fixture
    expect(Object.keys(readClaims(root, out.run.run))).toEqual(["src/a.ts"]);
  });
});
