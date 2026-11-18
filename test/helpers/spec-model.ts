import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseStories, parseTasks, type StoryProgress, type TaskLine } from "../../src/core/dashboard.js";
import { parsePhases, type PhaseVerify } from "../../src/core/markers.js";

/** The comparable model of one feature (spike 026 `model.mjs`): what every reader must reproduce. */
export interface FeatureModel {
  stories: Pick<StoryProgress, "id" | "displayId" | "title" | "priority" | "status" | "dependsOn" | "blockedBy">[];
  tasks: Record<string, unknown>[];
  phases: Record<string, unknown>[];
}

const omit = <T extends object>(o: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** Drop the trailing declared-path group from a description (so ownership is not part of prose). */
export function stripOwnerGroup(desc: string, t: Pick<TaskLine, "paths" | "pathIssue">): string {
  if (t.paths.length === 0 && t.pathIssue !== "glob") return desc;
  return desc.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

export const storyOut = (s: StoryProgress) => ({
  id: s.id,
  displayId: s.displayId,
  title: s.title,
  priority: s.priority,
  status: s.status,
  dependsOn: s.dependsOn,
  blockedBy: s.blockedBy,
});
export const taskOut = (t: TaskLine) =>
  omit({
    id: t.id,
    done: t.done,
    story: t.story,
    description: stripOwnerGroup(t.description, t),
    phase: t.phase,
    parallel: t.parallel,
    paths: t.paths,
    pathIssue: t.pathIssue,
    blocked: t.blocked,
    deviation: t.deviation,
  });
export const phaseOut = (p: PhaseVerify) =>
  omit({ phase: p.phase, title: p.title, tasks: p.tasks, check: p.check, result: p.result, why: p.why, duplicates: p.duplicates });

export interface Readers {
  stories(text: string, feature: string): StoryProgress[];
  tasks(text: string): TaskLine[];
  phases(text: string): PhaseVerify[];
}

/** The shipped (1.x) parsers: the baseline is the product's own behavior (Principle 4). */
export const v1Readers: Readers = { stories: parseStories, tasks: parseTasks, phases: parsePhases };

export function modelOf(feature: string, specText: string | null, tasksText: string | null, r: Readers = v1Readers): FeatureModel {
  return {
    stories: specText === null ? [] : (r.stories(specText, feature).map(storyOut) as FeatureModel["stories"]),
    tasks: tasksText === null ? [] : r.tasks(tasksText).map(taskOut),
    phases: tasksText === null ? [] : r.phases(tasksText).map(phaseOut),
  };
}

export function listFeatures(specsDir: string): string[] {
  return readdirSync(specsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(specsDir, e.name, "spec.md")))
    .map((e) => e.name)
    .sort();
}

const read = (dir: string, f: string): string | null => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : null);

/** Model of every feature under `specsDir`. */
export function modelOfSpecs(specsDir: string, r: Readers = v1Readers, only?: (f: string) => boolean): Record<string, FeatureModel> {
  const out: Record<string, FeatureModel> = {};
  for (const f of listFeatures(specsDir)) {
    if (only && !only(f)) continue;
    out[f] = modelOf(f, read(join(specsDir, f), "spec.md"), read(join(specsDir, f), "tasks.md"), r);
  }
  return out;
}

/** Features whose files change while this feature is built (030 itself, and anything added after the baseline). */
export const BASELINE_FEATURE = (f: string): boolean => /^(0[0-1]\d|02[0-9])-/.test(f);
