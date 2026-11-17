// T023: read every real spec through the dispatcher and compare with the baseline model (SC-001, v1 side).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, here, listFeatures, readText } from "./model.mjs";
import { readFeature, describeFormats } from "./read.mjs";
import { diffModels, showDiff } from "./compare.mjs";

const baseline = JSON.parse(readFileSync(join(here, "model-v1.json"), "utf8"));
const specsRoot = join(repoRoot, "specs");
let bad = 0;
const fmts = {};
for (const f of listFeatures(specsRoot)) {
  const dir = join(specsRoot, f);
  const r = readFeature(f, readText(dir, "spec.md"), readText(dir, "tasks.md"));
  const d = diffModels(baseline[f], r.model);
  const key = `spec=${r.formats.spec} tasks=${r.formats.tasks}`;
  fmts[key] = (fmts[key] ?? 0) + 1;
  const ok = d.length === 0 && r.errors.length === 0;
  if (!ok) bad += 1;
  console.log(`${ok ? "identical" : "DIFFERS  "}  ${f.padEnd(40)} ${describeFormats(r)}  ${r.model.stories.length} stories ${r.model.tasks.length} tasks`);
  if (!ok) console.log(showDiff(d) + r.errors.map((e) => `\n  error ${e.file}:${e.line} ${e.message}`).join(""));
}
console.log(`\nformat detection: ${JSON.stringify(fmts)}`);
console.log(bad === 0 ? "ALL REAL v1 SPECS IDENTICAL TO BASELINE" : `${bad} DIFFER`);
process.exit(bad === 0 ? 0 : 1);
