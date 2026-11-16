// The one comparable model (T010). Both readers produce exactly this shape; compare.mjs diffs it.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import matter from "gray-matter";

export const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "..", "..");
const dist = (f) => import(pathToFileURL(join(repoRoot, "dist", "core", f)).href);
export const dashboard = await dist("dashboard.js");
export const markers = await dist("markers.js");
export const lanes = await dist("lanes.js");
export const yaml = matter.engines.yaml;
export { matter };

/** Strip the trailing declared-path group from a task description (so ownership is not part of prose). */
export function stripOwnerGroup(desc, task) {
  if (task.paths.length === 0 && task.pathIssue !== "glob") return desc;
  return desc.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

const omit = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function storyOut(s) {
  return { id: s.id, displayId: s.displayId, title: s.title, priority: s.priority, status: s.status, dependsOn: s.dependsOn, blockedBy: s.blockedBy };
}
export function taskOut(t) {
  return omit({
    id: t.id, done: t.done, story: t.story, description: stripOwnerGroup(t.description, t), phase: t.phase,
    parallel: t.parallel, paths: t.paths, pathIssue: t.pathIssue, blocked: t.blocked, deviation: t.deviation,
  });
}
export function phaseOut(p) {
  return omit({ phase: p.phase, title: p.title, tasks: p.tasks, check: p.check, result: p.result, why: p.why, duplicates: p.duplicates });
}

/** Feature meta from the spec frontmatter (same in v1 and v2; `stories` is v2-only and not part of meta). */
export function metaOf(specText) {
  let data = {};
  try { data = matter(specText).data ?? {}; } catch { /* reported by the v2 reader */ }
  const s = (v) => (v === undefined || v === null ? undefined : String(v));
  return omit({ feature: s(data.feature), title: s(data.title), status: s(data.status) });
}

export function makeModel(feature, { meta, stories, tasks, phases, formats }) {
  return { feature, formats, meta, stories, tasks, phases };
}

/** v1 model through the SHIPPED parsers (Principle 4: the baseline is the product's own behavior). */
export function readV1(feature, specText, tasksText) {
  const stories = specText == null ? [] : dashboard.parseStories(specText, feature).map(storyOut);
  const tasks = tasksText == null ? [] : dashboard.parseTasks(tasksText).map(taskOut);
  const phases = tasksText == null ? [] : markers.parsePhases(tasksText).map(phaseOut);
  return makeModel(feature, {
    meta: specText == null ? {} : metaOf(specText), stories, tasks, phases,
    formats: { spec: specText == null ? "none" : "v1", tasks: tasksText == null ? "none" : "v1" },
  });
}

export function listFeatures(specsRoot) {
  return readdirSync(specsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(specsRoot, e.name, "spec.md")))
    .map((e) => e.name).sort();
}
export function readText(dir, file) {
  const p = join(dir, file);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

/** True when `metaUrl` is the script node was started with (works on Windows paths). */
export const isMain = (metaUrl) => !!process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === metaUrl;
