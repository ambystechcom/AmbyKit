// T011: build the v1 model for every spec through the built parsers → model-v1.json
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, here, listFeatures, readText, readV1, isMain } from "./model.mjs";

export function buildBaseline(specsRoot) {
  const out = {};
  for (const f of listFeatures(specsRoot)) {
    const dir = join(specsRoot, f);
    out[f] = readV1(f, readText(dir, "spec.md"), readText(dir, "tasks.md"));
  }
  return out;
}
if (isMain(import.meta.url)) {
  const base = buildBaseline(join(repoRoot, "specs"));
  writeFileSync(join(here, "model-v1.json"), JSON.stringify(base, null, 1) + "\n");
  const n = Object.keys(base).length;
  const t = Object.values(base).reduce((s, m) => s + m.tasks.length, 0);
  const st = Object.values(base).reduce((s, m) => s + m.stories.length, 0);
  console.log(`model-v1.json: ${n} features, ${st} stories, ${t} tasks`);
}
