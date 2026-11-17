// US-2 evidence (T032-T035) on a TEMPORARY COPY of specs/. The real tree is never written.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { repoRoot, here, listFeatures, readText, readV1, markers } from "./model.mjs";
import { migrateTree, migrateSpec, migrateTasks, summarize } from "./migrate.mjs";
import { buildBaseline } from "./baseline.mjs";
import { readFeature } from "./read.mjs";
import { diffModels } from "./compare.mjs";

const work = join(here, "work");
const res = join(here, "results");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const hashTree = (root) => {
  const h = createHash("sha256");
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else h.update(relative(root, p) + "\0").update(readFileSync(p));
    }
  };
  walk(root);
  return h.digest("hex").slice(0, 16);
};
const copySpecs = (name) => {
  const dest = join(work, name);
  cpSync(join(repoRoot, "specs"), dest, { recursive: true });
  return dest;
};
const log = (name) => {
  const buf = [];
  return { p: (s = "") => (console.log(s), buf.push(s)), save: () => writeFileSync(join(res, name), buf.join("\n") + "\n") };
};
let failures = 0;
const check = (L, ok, label) => {
  if (!ok) failures += 1;
  L.p(`${ok ? "PASS" : "FAIL"}  ${label}`);
};

const realHash = hashTree(join(repoRoot, "specs"));
const pristine = copySpecs("pristine");
const baseline = buildBaseline(pristine); // the v1 model of exactly what was copied
const layouts = [["phase", {}], ["task", {}], ["phase-dual", { layout: "phase", dual: true }]];

// ── T032 dry run ──────────────────────────────────────────────────────────────────────────────
{
  const L = log("us2-dryrun.txt");
  for (const [name, o] of layouts) {
    const dir = copySpecs(`dry-${name}`);
    const before = hashTree(dir);
    L.p(`== dry-run, layout=${name} (tree hash before ${before})`);
    const recs = migrateTree(dir, { dryRun: true, layout: o.layout ?? name, dual: !!o.dual });
    L.p(summarize(recs));
    const after = hashTree(dir);
    check(L, before === after, `dry-run wrote nothing: tree hash ${before} -> ${after}`);
    L.p();
  }
  check(L, hashTree(join(repoRoot, "specs")) === realHash, "the real specs/ tree is unchanged by this whole script (hash identical at start and now)");
  L.save();
}

// ── T033 real run twice + prose preservation ──────────────────────────────────────────────────
const converted = {};
{
  const L = log("us2-idempotence.txt");
  for (const [name, o] of layouts) {
    const dir = copySpecs(`real-${name}`);
    converted[name] = dir;
    L.p(`== real run, layout=${name}`);
    const r1 = migrateTree(dir, { layout: o.layout ?? name, dual: !!o.dual });
    const h1 = hashTree(dir);
    L.p(summarize(r1));
    const r2 = migrateTree(dir, { layout: o.layout ?? name, dual: !!o.dual });
    const h2 = hashTree(dir);
    check(L, h1 === h2 && r2.every((r) => r.status !== "converted"), `second run changed nothing (tree hash ${h1} == ${h2}; ${r2.filter((r) => r.status === "unchanged").length} unchanged, ${r2.filter((r) => r.status === "skipped").length} skipped)`);
    // prose preservation
    let lost = 0, checked = 0, extra = 0;
    const BULLET = /^\s*[-*]\s+\*\*(status|depends-on|blocked-by|priority):\*\*/i;
    for (const rec of r1.filter((x) => x.status === "converted")) {
      const a = readText(join(pristine, rec.feature), rec.file);
      const b = readText(join(dir, rec.feature), rec.file);
      const isSpec = rec.file === "spec.md";
      const moved = (l) => (isSpec ? BULLET.test(l) : /^\s*-\s*\[[ xX]\]\s*\[T\d+\].*\([^()]*\)/.test(l) || /^\s*(?:-\s*)?\*\*Verify:\*\*/.test(l));
      const prose = a.split(/\r?\n/).filter((l) => l.trim() && !moved(l));
      const outLines = b.split(/\r?\n/).filter((l) => l.trim());
      let k = 0;
      for (const l of prose) {
        while (k < outLines.length && outLines[k] !== l) k++;
        if (k >= outLines.length) { lost += 1; k = 0; break; }
        k++;
      }
      checked += prose.length;
      // lines that were NOT in the original and are not data (frontmatter stories, yaml blocks, stripped task lines)
      const orig = new Set(a.split(/\r?\n/));
      let inBlock = false, inFm = false;
      b.split(/\r?\n/).forEach((l, i) => {
        if (isSpec && i === 0) inFm = true;
        if (isSpec && inFm) { if (i > 0 && l === "---") inFm = false; return; }
        if (/^\s*```yaml\s*$/.test(l)) { inBlock = true; return; }
        if (inBlock) { if (/^\s*```\s*$/.test(l)) inBlock = false; return; }
        if (!orig.has(l) && l.trim() && !(/^\s*-\s*\[[ xX]\]\s*\[T\d+\]/.test(l))) extra += 1;
      });
    }
    check(L, lost === 0, `prose preserved: every prose line (${checked} checked across converted files) still present, in order; none lost`);
    check(L, extra === 0, `no foreign lines added outside frontmatter, yaml blocks and rewritten task lines (${extra} found)`);
    L.p();
  }
  L.save();
}

// ── T034 converted copy read as v2 vs baseline ────────────────────────────────────────────────
{
  const L = log("us2-v2-vs-v1.txt");
  for (const [name] of layouts) {
    const dir = converted[name];
    let same = 0, differ = 0, errors = 0, warnings = 0, nonV1 = 0;
    for (const f of listFeatures(dir)) {
      const r = readFeature(f, readText(join(dir, f), "spec.md"), readText(join(dir, f), "tasks.md"));
      const d = diffModels(baseline[f], r.model);
      errors += r.errors.length;
      warnings += r.warnings.length;
      if (r.formats.spec === "v2" || r.formats.tasks === "v2") nonV1 += 1;
      if (d.length === 0) same += 1;
      else {
        differ += 1;
        L.p(`DIFF ${f}: ${d.slice(0, 5).map((x) => `${x.path} ${x.a}≠${x.b}`).join("; ")}`);
      }
    }
    check(L, differ === 0 && errors === 0, `layout=${name}: ${same} features identical to baseline, ${differ} differ, ${errors} errors, ${warnings} warnings; ${nonV1} features carry v2 data`);
  }
  // SC-001 summary table for the phase layout
  L.p("\nformat of each file after migration (phase layout):");
  const dir = converted.phase;
  const rows = listFeatures(dir).map((f) => {
    const r = readFeature(f, readText(join(dir, f), "spec.md"), readText(join(dir, f), "tasks.md"));
    return `  ${f.padEnd(40)} spec=${r.formats.spec.padEnd(4)} tasks=${r.formats.tasks.padEnd(4)}${r.mixed ? " MIXED" : ""}`;
  });
  rows.forEach((x) => L.p(x));
  L.save();
}

// ── T035 the CURRENT (1.x) built parsers on converted files ───────────────────────────────────
{
  const L = log("us2-v1-reader-on-v2.txt");
  const fields = [
    ["story id/title", "stories", (s) => `${s.id}|${s.displayId}|${s.title}`],
    ["story priority", "stories", (s) => s.priority],
    ["story status", "stories", (s) => s.status],
    ["story depends-on", "stories", (s) => s.dependsOn.join()],
    ["story blocked-by", "stories", (s) => s.blockedBy.join()],
    ["task id/done/story/[P]/phase", "tasks", (t) => `${t.id}|${t.done}|${t.story}|${t.parallel}|${t.phase}`],
    ["task description", "tasks", (t) => t.description],
    ["task paths (ownership)", "tasks", (t) => `${t.paths.join()}|${t.pathIssue ?? ""}`],
    ["task BLOCKED/DEVIATION", "tasks", (t) => `${t.blocked ?? "-"}|${t.deviation ?? "-"}`],
    ["phase Verify check+result", "phases", (p) => `${p.check ?? "-"}|${p.result ?? "-"}|${p.why ?? ""}`],
  ];
  for (const [name] of layouts) {
    const dir = converted[name];
    L.p(`== 1.x reader (shipped parseStories/parseTasks/parsePhases) on converted copy, layout=${name}`);
    L.p("field".padEnd(32) + "items wrong / total   verdict");
    let anyLossy = false;
    for (const [label, key, pick] of fields) {
      let wrong = 0, total = 0;
      for (const f of listFeatures(dir)) {
        const now = readV1(f, readText(join(dir, f), "spec.md"), readText(join(dir, f), "tasks.md"))[key];
        const was = baseline[f][key];
        const idOf = (x) => x.id ?? `p${x.phase}`;
        const m = new Map(now.map((x) => [idOf(x), x]));
        for (const w of was) {
          total += 1;
          const n = m.get(idOf(w));
          if (!n || pick(n) !== pick(w)) wrong += 1;
        }
        if (now.length > was.length) wrong += now.length - was.length;
      }
      const verdict = wrong === 0 ? "readable" : wrong === total ? "NOT readable (all empty/changed)" : "partly readable";
      if (wrong) anyLossy = true;
      L.p(label.padEnd(32) + `${String(wrong).padStart(5)} / ${String(total).padEnd(8)} ${verdict}`);
    }
    L.p(anyLossy ? "=> 1.x reads the converted files WITHOUT error but loses the moved fields: readable only with the new reader.\n" : "=> 1.x reads everything unchanged (dual-write).\n");
  }
  L.save();
}

// ── skips: unsafe specs are left untouched and listed (FR-007) ────────────────────────────────
{
  const L = log("us2-skips.txt");
  const synth = join(work, "synth", "specs");
  const mk = (name, spec, tasks) => {
    mkdirSync(join(synth, name), { recursive: true });
    writeFileSync(join(synth, name, "spec.md"), spec);
    if (tasks) writeFileSync(join(synth, name, "tasks.md"), tasks);
  };
  mk("910-prose-meta", "---\nfeature: 910\n---\n\n### US-1 — Story\n\nThe **status:** field is explained here in a sentence.\n- **status:** done\n");
  mk("911-two-status", "---\nfeature: 911\n---\n\n### US-1 — Story\n\n- **status:** draft\n- **status:** done\n");
  mk("912-no-frontmatter", "### US-1 — Story\n\n- **status:** done\n");
  mk("913-mixed-eol", "---\nfeature: 913\n---\r\n\r\n### US-1 — Story\n\n- **status:** done\n");
  mk("914-fenced", "---\nfeature: 914\n---\n\n### US-1 — Story\n\n```md\n- **status:** done\n```\n", "## Phase 1\n\n```\n- [ ] [T001] example (src/a.ts)\n```\n");
  mk("915-dup-verify", "---\nfeature: 915\n---\n\n### US-1 — Story\n", "## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n- **Verify:** one\n- **Verify:** two\n");
  mk("916-dup-id", "---\nfeature: 916\n---\n\n### US-1 — Story\n", "## Phase 1\n\n- [ ] [T001] a (src/a.ts)\n- [ ] [T001] b (src/b.ts)\n");
  mk("917-bom", "﻿---\nfeature: 917\n---\n\n### US-1 — Story\n\n- **status:** done\n");
  const originals = new Map();
  for (const d of readdirSync(synth)) for (const f of ["spec.md", "tasks.md"]) { const t = readText(join(synth, d), f); if (t != null) originals.set(`${d}/${f}`, t); }
  const recs = migrateTree(synth, {});
  L.p(summarize(recs));
  const skipped = recs.filter((r) => r.status === "skipped");
  check(L, skipped.length === 8 && new Set(skipped.map((r) => r.feature)).size === 7, "7 unsafe specs (8 files) skipped, each listed with its reason");
  check(L, readText(join(synth, "912-no-frontmatter"), "spec.md").startsWith("---\nfeature: 912-no-frontmatter\nstories:"), "a spec with no frontmatter gets minimal frontmatter (converted, and noted in the report)");
  check(L, skipped.every((r) => readText(join(synth, r.feature), r.file) === originals.get(`${r.feature}/${r.file}`)), "every skipped file is byte-identical to what it was (left untouched)");
  const again = migrateTree(synth, {});
  check(L, again.filter((r) => r.status === "converted").length === 0, "a rerun converts nothing new (idempotent, skips stay skipped)");
  L.save();
}

rmSync(join(work, "synth"), { recursive: true, force: true });
console.log(failures === 0 ? "\nUS-2 ALL PASS" : `\nUS-2: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
