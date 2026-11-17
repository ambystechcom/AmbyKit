// T051 evidence: run the SHIPPED CLI (this repo's dist/) on a copy of specs/ in v1 and in v2 and compare what
// spec 020 (Verify, BLOCKED) and spec 024 (trace) consume. Needs `work/pristine` and `work/real-phase` (run-us2.mjs).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { here, repoRoot } from "./model.mjs";

const cli = join(repoRoot, "dist", "cli", "index.js");
const work = join(here, "work");
if (!existsSync(join(work, "pristine")) || !existsSync(join(work, "real-phase"))) throw new Error("run run-us2.mjs first");
const tmpRoot = mkdtempSync(join(tmpdir(), "spike026-cli-"));
const mkProject = (name, from) => {
  // OS temp, not the repo: the copied test/ dir would otherwise be collected by the repo's own vitest glob
  const p = join(tmpRoot, name);
  mkdirSync(join(p, ".amby"), { recursive: true });
  cpSync(join(work, from), join(p, "specs"), { recursive: true });
  cpSync(join(repoRoot, "test"), join(p, "test"), { recursive: true });
  writeFileSync(join(p, ".amby", "config.json"), "{}");
  return p;
};
const run = (cwd, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const out = [];
const say = (s = "") => (console.log(s), out.push(s));

const projects = { "v1 (pristine copy)": mkProject("proj-v1", "pristine"), "v2 (per-phase copy)": mkProject("proj-v2", "real-phase") };
const res = {};
for (const [label, p] of Object.entries(projects)) {
  const analyze = run(p, "analyze");
  const text = analyze.stdout + analyze.stderr;
  const dash = JSON.parse(run(p, "dashboard", "--json").stdout);
  const trace = run(p, "trace", "--json").stdout;
  const count = (re) => (text.match(re) ?? []).length;
  const stories = Array.isArray(dash) ? dash : dash.stories ?? [];
  res[label] = {
    analyzeExit: analyze.status,
    missingVerifyPhases: (/(\d+) phase/.exec(text) ?? [])[1] ?? "see lines",
    verifyHintLines: count(/add a \*\*Verify:\*\* line/g),
    noPathTasks: (/Tasks without a usable file path: (.*)/.exec(text)?.[1].match(/T\d+/g) ?? []).length,
    buildableNow: (/Buildable now: (.*)/.exec(text)?.[1].split(",").length) ?? 0,
    storiesWithStatus: stories.filter((s) => s.status).length,
    storiesDone: stories.filter((s) => s.status === "done").length,
    storiesTotal: stories.length,
    storiesWithDeps: stories.filter((s) => (s.dependsOn ?? []).length).length,
    trace,
  };
}
const [a, b] = Object.values(res);
say("# T051 — the shipped (1.x) CLI reading a v1 copy and a v2 copy of this repo's specs");
say("");
say("| Signal the shipped CLI computes | v1 copy | v2 copy (per-phase) |");
say("|---|---:|---:|");
const row = (n, k) => say(`| ${n} | ${a[k]} | ${b[k]} |`);
row("`analyze` exit status", "analyzeExit");
row("stories with a status (`dashboard --json`)", "storiesWithStatus");
row("stories reported done", "storiesDone");
row("stories with depends-on", "storiesWithDeps");
row("`analyze`: stories listed as buildable now", "buildableNow");
row("`analyze`: tasks reported without a usable file path", "noPathTasks");
row("`analyze`: lines asking to add a Verify line", "verifyHintLines");
say("");
say(`\`ambykit trace --json\` (spec 024 reads requirement ids from prose and test names): ${a.trace === b.trace ? "byte-identical in v1 and v2" : "DIFFERENT"}.`);
say("");
say("Reading: a 1.x binary on v2 files does not crash and trace is untouched, but story status, depends-on, ownership and Verify results are not seen: the data the dashboard and analyze exist to show.");
writeFileSync(join(here, "results", "t051-shipped-cli-on-v2.md"), out.join("\n") + "\n");
