// T041: two lane branches edit the same tasks.md; does git (plus AmbyKit's check-off-aware merge) merge them?
// Runs in OS temp repos only. Layouts: v1, v2 per-phase blocks, v2 per-task blocks.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { here, lanes } from "./model.mjs";
import { migrateTasks } from "./migrate.mjs";
import { readFeature } from "./read.mjs";

const git = (cwd, ...args) => spawnSync("git", ["-c", "core.autocrlf=false", "-c", "user.name=spike", "-c", "user.email=spike@example.invalid", ...args], { cwd, encoding: "utf8" });

const V1 = [
  "## Phase 1 — Build", "",
  ...[1, 2, 3, 4, 5, 6].map((n) => `- [ ] [T00${n}] [P] [US1] Task ${n} (src/t${n}.ts)`),
  "- **Checkpoint:** phase demoable.",
  "- **Verify:** `npm test` passes ? unverified", "",
  "## Phase 2 — Next", "",
  "- [ ] [T010] [US1] Later task (src/later.ts)", "",
].join("\n");

const LAYOUTS = {
  v1: V1,
  "v2 phase blocks": migrateTasks(V1, "x", { layout: "phase" }).text,
  "v2 task blocks": migrateTasks(V1, "x", { layout: "task" }).text,
};

const tick = (t, id) => t.replace(`- [ ] [${id}]`, `- [x] [${id}]`);
const setVerify = (t) => t.replace("? unverified", "✓ passed").replace("result: unverified", "result: passed");
const newOwner = (t, id, to) => {
  const from = `src/t${id.slice(-1)}.ts`;
  return t.split("\n").map((l, i, a) => {
    if (l.includes(`[${id}]`) && l.includes(`(${from})`)) return l.replace(from, to); // v1: group on the line
    if (l.includes(`${id}: [\"${from}\"]`)) return l.replace(from, to); // phase block entry
    if (/^\s+files: \[/.test(l) && l.includes(from) && a[i - 2]?.includes(`[${id}]`)) return l.replace(from, to); // task block
    return l;
  }).join("\n");
};

const SCENARIOS = [
  ["S1 two lanes tick ADJACENT tasks (T001 / T002)", (t) => tick(t, "T001"), (t) => tick(t, "T002"), (m) => m.tasks.find((x) => x.id === "T001").done && m.tasks.find((x) => x.id === "T002").done],
  ["S2 two lanes tick DISTANT tasks (T001 / T005)", (t) => tick(t, "T001"), (t) => tick(t, "T005"), (m) => m.tasks.find((x) => x.id === "T001").done && m.tasks.find((x) => x.id === "T005").done],
  ["S3 lane A ticks T003, lane B records the phase Verify result", (t) => tick(t, "T003"), setVerify, (m) => m.tasks.find((x) => x.id === "T003").done && m.phases[0].result === "passed"],
  ["S4 lane A ticks T002, lane B changes T001's ownership", (t) => tick(t, "T002"), (t) => newOwner(t, "T001", "src/moved.ts"), (m) => m.tasks.find((x) => x.id === "T002").done && m.tasks.find((x) => x.id === "T001").paths[0] === "src/moved.ts"],
  ["S5 lane A ticks T004, lane B changes T005's ownership (distant)", (t) => tick(t, "T004"), (t) => newOwner(t, "T005", "src/moved.ts"), (m) => m.tasks.find((x) => x.id === "T004").done && m.tasks.find((x) => x.id === "T005").paths[0] === "src/moved.ts"],
];

const rows = [];
for (const [layout, base] of Object.entries(LAYOUTS)) {
  for (const [name, editA, editB, ok] of SCENARIOS) {
    const dir = mkdtempSync(join(tmpdir(), "spike026-"));
    try {
      const file = join(dir, "tasks.md");
      git(dir, "init", "-q", "-b", "main");
      writeFileSync(file, base);
      git(dir, "add", "."); git(dir, "commit", "-q", "-m", "base");
      git(dir, "checkout", "-q", "-b", "laneA"); writeFileSync(file, editA(base)); git(dir, "commit", "-q", "-am", "A");
      git(dir, "checkout", "-q", "main"); git(dir, "checkout", "-q", "-b", "laneB"); writeFileSync(file, editB(base)); git(dir, "commit", "-q", "-am", "B");
      git(dir, "checkout", "-q", "laneA");
      const m = git(dir, "merge", "--no-edit", "laneB");
      let result;
      let text;
      if (m.status === 0) {
        result = "clean (git alone)";
        text = readFileSync(file, "utf8");
      } else {
        const show = (stage) => git(dir, "show", `:${stage}:tasks.md`).stdout;
        const merged = lanes.mergeCheckoffs(show(1), show(2), show(3));
        if (merged !== null) { result = "git CONFLICT, resolved by check-off-aware merge"; text = merged; }
        else { result = "CONFLICT, needs a person"; text = null; }
      }
      let correct = "n/a";
      if (text !== null) {
        const r = readFeature("x", null, text);
        correct = r.errors.length === 0 && ok(r.model) ? "yes" : "NO";
      }
      rows.push({ layout, name, result, correct });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

const out = ["# US-3 — lane merge experiment", "",
  "Two lane branches edit the same `tasks.md` (6 parallel tasks in one phase). Merge with git; on a conflict try AmbyKit's shipped `mergeCheckoffs` (the check-off-only rule `ambykit lane merge` uses). Final text is read back with the v2 reader and checked for both lanes' changes.", "",
  "| Layout | Scenario | Outcome | Both changes present |", "|---|---|---|---|"];
for (const r of rows) out.push(`| ${r.layout} | ${r.name} | ${r.result} | ${r.correct} |`);
const by = (l) => rows.filter((r) => r.layout === l);
out.push("", "Summary (scenarios merging without a person): " + Object.keys(LAYOUTS).map((l) => `${l} ${by(l).filter((r) => !r.result.startsWith("CONFLICT")).length}/${by(l).length}`).join(", "));
out.push("Summary (scenarios that git alone merges cleanly): " + Object.keys(LAYOUTS).map((l) => `${l} ${by(l).filter((r) => r.result.startsWith("clean")).length}/${by(l).length}`).join(", "));
mkdirSync(join(here, "results"), { recursive: true });
writeFileSync(join(here, "results", "us3-merge.md"), out.join("\n") + "\n");
console.log(out.join("\n"));
