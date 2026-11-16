// T040: size and approximate token cost per format (tokens ~= chars / 4; no tokenizer dependency).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, here, listFeatures, readText } from "./model.mjs";
import { migrateSpec, migrateTasks } from "./migrate.mjs";
import { splitFrontmatter } from "./read-v2.mjs";

const specsRoot = join(repoRoot, "specs");
const SAMPLE = ["004-templates-and-ui-depth", "014-enhanced-dashboard", "020-blocked-and-verify"];
const size = (t) => ({ chars: t.length, words: (t.match(/\S+/g) ?? []).length, tokens: Math.round(t.length / 4) });
const add = (a, b) => ({ chars: a.chars + b.chars, words: a.words + b.words, tokens: a.tokens + b.tokens });
const zero = { chars: 0, words: 0, tokens: 0 };

const FORMATS = [
  ["v1", (s, t, f) => [s, t]],
  ["v2 phase layout", (s, t, f) => [migrateSpec(s, f).text ?? s, t == null ? t : migrateTasks(t, f, { layout: "phase" }).text ?? t]],
  ["v2 task layout", (s, t, f) => [migrateSpec(s, f).text ?? s, t == null ? t : migrateTasks(t, f, { layout: "task" }).text ?? t]],
  ["v2 phase + dual-write", (s, t, f) => [migrateSpec(s, f, { dual: true }).text ?? s, t == null ? t : migrateTasks(t, f, { layout: "phase", dual: true }).text ?? t]],
];

const per = {}; // feature -> format -> {spec, tasks}
const totals = Object.fromEntries(FORMATS.map(([n]) => [n, { spec: { ...zero }, tasks: { ...zero } }]));
let fmLines = 0, metaV1 = { ...zero }, metaV2 = { ...zero }, fmTotal = { ...zero }, specV2Total = { ...zero }, blocksTotal = { ...zero };

for (const f of listFeatures(specsRoot)) {
  const s = readText(join(specsRoot, f), "spec.md");
  const t = readText(join(specsRoot, f), "tasks.md");
  per[f] = {};
  for (const [name, conv] of FORMATS) {
    const [s2, t2] = conv(s, t, f);
    per[f][name] = { spec: size(s2), tasks: t2 == null ? { ...zero } : size(t2) };
    totals[name].spec = add(totals[name].spec, per[f][name].spec);
    totals[name].tasks = add(totals[name].tasks, per[f][name].tasks);
  }
  // spec metadata only: the bullets v1 stores in prose vs the frontmatter stories block in v2
  const s1 = s.split(/\r?\n/);
  const bullets = s1.filter((l) => /^\s*[-*]\s+\*\*(status|depends-on|blocked-by|priority):\*\*/i.test(l)).join("\n");
  metaV1 = add(metaV1, size(bullets));
  const v2 = migrateSpec(s, f).text ?? s;
  const lines = v2.split(/\r?\n/);
  const fm = splitFrontmatter(lines);
  const storiesAt = fm ? lines.findIndex((l, i) => i < fm.end && /^stories:/.test(l)) : -1;
  if (fm && storiesAt >= 0) metaV2 = add(metaV2, size(lines.slice(storiesAt, fm.end - 1).join("\n")));
  if (fm) {
    fmTotal = add(fmTotal, size(lines.slice(0, fm.end).join("\n")));
    fmLines += fm.end;
  }
  specV2Total = add(specV2Total, size(v2));
  // tasks: how much of the v2 phase-layout file is the machine blocks
  const tv2 = t == null ? "" : migrateTasks(t, f, { layout: "phase" }).text ?? t;
  const blocks = [...tv2.matchAll(/^```yaml\r?\n[\s\S]*?^```/gm)].map((m) => m[0]).join("\n");
  blocksTotal = add(blocksTotal, size(blocks));
}

const pct = (a, b) => (b === 0 ? "n/a" : `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toFixed(1)}%`);
const out = [];
out.push("# US-3 — size and token cost per format", "", "Tokens are approximated as characters / 4 (no tokenizer dependency). Words are whitespace-separated. Source: AmbyKit's own `specs/` at measurement time.", "");
for (const f of SAMPLE) {
  out.push(`## ${f}`, "", "| Format | spec.md tokens | tasks.md tokens | total tokens | total words | total chars | vs v1 (tokens) |", "|---|---:|---:|---:|---:|---:|---:|");
  const base = add(per[f]["v1"].spec, per[f]["v1"].tasks);
  for (const [name] of FORMATS) {
    const sp = per[f][name].spec, tk = per[f][name].tasks, all = add(sp, tk);
    out.push(`| ${name} | ${sp.tokens} | ${tk.tokens} | ${all.tokens} | ${all.words} | ${all.chars} | ${name === "v1" ? "—" : pct(all.tokens, base.tokens)} |`);
  }
  out.push("");
}
out.push("## All specs (26 features)", "", "| Format | spec.md tokens | tasks.md tokens | total tokens | vs v1 |", "|---|---:|---:|---:|---:|");
const baseAll = add(totals["v1"].spec, totals["v1"].tasks);
for (const [name] of FORMATS) {
  const all = add(totals[name].spec, totals[name].tasks);
  out.push(`| ${name} | ${totals[name].spec.tokens} | ${totals[name].tasks.tokens} | ${all.tokens} | ${name === "v1" ? "—" : pct(all.tokens, baseAll.tokens)} |`);
}
out.push("", "## Where the tokens go", "",
  `- Story metadata: v1 stores it as bullets in prose (${metaV1.tokens} tokens across all specs); v2 stores it in the frontmatter \`stories:\` block (${metaV2.tokens} tokens). Net change: ${pct(metaV2.tokens, metaV1.tokens)}.`,
  `- Machine blocks in tasks.md (phase layout): ${blocksTotal.tokens} tokens of ${totals["v2 phase layout"].tasks.tokens} (${((blocksTotal.tokens / totals["v2 phase layout"].tasks.tokens) * 100).toFixed(1)}% of the v2 tasks files).`,
  "",
  "## Can an assistant load less in v2?", "",
  `- **Spec metadata only:** the whole frontmatter is ${fmTotal.tokens} tokens across all specs, against ${totals["v1"].spec.tokens} for the v1 spec.md files that an assistant must read in full to find the same bullets: ${((fmTotal.tokens / totals["v1"].spec.tokens) * 100).toFixed(1)}% of the cost. Per spec, frontmatter-only is a bounded read of the first ~${Math.round(fmLines / Object.keys(per).length)} lines on average.`,
  `- **Tasks:** ownership blocks sit inside their phase, so a reader that wants one phase still reads that phase; a reader that wants only ownership (lane planning) can read the ${blocksTotal.tokens}-token blocks rather than ${totals["v2 phase layout"].tasks.tokens}, but only with a block-aware reader (a tool, not an assistant with a plain file read).`,
  "");
writeFileSync(join(here, "results", "us3-tokens.md"), out.join("\n") + "\n");
console.log(out.join("\n"));
