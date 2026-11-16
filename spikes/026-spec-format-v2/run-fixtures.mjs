// T022: fixture twins (v1 vs v2 in both layouts, LF and CRLF), malformed inputs with locations, mixed features.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { here } from "./model.mjs";
import { readFeature, describeFormats } from "./read.mjs";
import { diffModels, showDiff } from "./compare.mjs";

const fx = (...p) => readFileSync(join(here, "fixtures", ...p), "utf8");
const crlf = (s) => s.replace(/\r?\n/g, "\r\n");
let failures = 0;
const check = (ok, label, extra = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "\n" + extra : ""}`);
};

const F = "900-edge-rich";
const spec1 = fx("edge-rich", "spec.v1.md");
const spec2 = fx("edge-rich", "spec.v2.md");
const tasks1 = fx("edge-rich", "tasks.v1.md");
const tasksP = fx("edge-rich", "tasks.v2-phase.md");
const tasksT = fx("edge-rich", "tasks.v2-task.md");

console.log("== Twins: v1 vs v2 give an identical model ==");
const base = readFeature(F, spec1, tasks1);
console.log(`v1 baseline: ${describeFormats(base)}; ${base.model.stories.length} stories, ${base.model.tasks.length} tasks, ${base.model.phases.length} phases`);
for (const [label, t2, enc] of [
  ["phase layout, LF", tasksP, (s) => s],
  ["task layout, LF", tasksT, (s) => s],
  ["phase layout, CRLF", tasksP, crlf],
  ["task layout, CRLF", tasksT, crlf],
]) {
  const r = readFeature(F, enc(spec2), enc(t2));
  const d = diffModels(base.model, r.model);
  check(d.length === 0 && r.errors.length === 0 && r.formats.spec === "v2" && r.formats.tasks === "v2", `v2 ${label} == v1 (${describeFormats(r)})`, d.length ? showDiff(d) : "");
  if (r.warnings.length) for (const w of r.warnings) console.log(`      warning ${w.file}:${w.line} ${w.message}`);
}
const r1crlf = readFeature(F, crlf(spec1), crlf(tasks1));
check(diffModels(base.model, r1crlf.model).length === 0, "v1 CRLF == v1 LF");

console.log("\n== Spot checks of the edge cases the twins carry ==");
const m = base.model;
const t = (id) => m.tasks.find((x) => x.id === id);
check(t("T002").paths.includes("docs/ünï.md") && !t("T002").paths.some((p) => p.includes(" ")), "unusual path characters (non-ASCII kept, spaced item dropped by v1 rule)");
check(t("T003").pathIssue === "glob", "glob ownership is flagged as glob");
check(t("T004").blocked?.includes("(src/d.ts)") && t("T004").deviation === "did it differently" && t("T004").paths[0] === "src/c.ts", "BLOCKED + DEVIATION marker text survives, path before the marker is ownership");
check(t("T006").pathIssue === "missing" && t("T006").description.endsWith("(see plan)"), "prose parenthetical is not ownership");
check(t("T007").paths[0] === "src/e.ts" && t("T007").description.endsWith("(x.y)"), "prose (x.y) kept in description, ownership is the last group");
check(m.stories[1].dependsOn.includes("019US1"), "cross-feature depends-on 019:US-1 canonicalizes the same way as v1");
check(m.phases[1].result === "failed" && m.phases[1].why === "it broke" && m.phases[3].result === "unverified", "Verify results failed/unverified survive");

console.log("\n== Malformed v2: every error carries file:line, nothing is guessed ==");
const cases = [
  ["bad-frontmatter.spec.md", "spec", [2, 6], "invalid YAML"],
  ["orphan-story.spec.md", "spec", [6, 6], "has no heading"],
  ["deps-not-list.spec.md", "spec", [4, 4], "must be a list"],
  ["bad-yaml.tasks.md", "tasks", [5, 8], "invalid YAML"],
  ["unknown-key.tasks.md", "tasks", [4, 4], "unknown key `owner`"],
  ["unclosed.tasks.md", "tasks", [4, 4], "not closed"],
  ["bad-result.tasks.md", "tasks", [5, 5], "verify.result must be"],
  ["wrong-phase.tasks.md", "tasks", [9, 9], "not a task of this phase"],
  ["detached-task-block.tasks.md", "tasks", [6, 6], "must directly follow"],
];
for (const [file, kind, [lo, hi], msg] of cases) {
  const text = fx("malformed", file);
  const r = kind === "spec" ? readFeature("901-x", text, null) : readFeature("901-x", null, text);
  const hit = r.errors.find((e) => e.message.includes(msg));
  check(!!hit && hit.line >= lo && hit.line <= hi, `${file}: ${hit ? `${hit.file}:${hit.line} ${hit.message}` : "NO ERROR"}`);
}
const w = readFeature("903-deps", fx("malformed", "deps-not-list.spec.md"), null).warnings.find((x) => x.message.includes("status `made-up`"));
check(!!w, `status v2 does not list is a warning at ${w ? `${w.file}:${w.line}` : "?"}`);
const nr = readFeature("904-x", fx("malformed", "neither.spec.md"), null);
check(nr.formats.spec === "none" && nr.model.stories.length === 0 && nr.errors.length === 0, "file in neither format: reported as format `none`, no stories invented");

console.log("\n== Mixed features state which part used which format ==");
const mixA = readFeature(F, spec1, tasksP); // spec v1, tasks v2
const mixB = readFeature(F, spec2, tasks1); // spec v2, tasks v1
check(mixA.mixed && mixA.formats.spec === "v1" && mixA.formats.tasks === "v2" && diffModels(base.model, mixA.model).length === 0, `spec v1 + tasks v2: ${describeFormats(mixA)}, same model`);
check(mixB.mixed && mixB.formats.spec === "v2" && mixB.formats.tasks === "v1" && diffModels(base.model, mixB.model).length === 0, `spec v2 + tasks v1: ${describeFormats(mixB)}, same model`);

console.log("\n== Duplicate Verify lines (v1) ==");
const dv = readFeature("905-x", null, fx("edge-rich", "tasks.dup-verify.v1.md"));
check(dv.model.phases[0].duplicates === 1, "v1 reader counts the second Verify line as a duplicate (migrate must not guess which one wins)");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
