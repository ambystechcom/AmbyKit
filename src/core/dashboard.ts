import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface StoryProgress {
  id: string; // feature-local canonical, e.g. "US1" (NOT globally unique — restarts per feature)
  displayId: string; // as written, e.g. "US-1"
  featureRef: string; // short, unique feature ref, e.g. "001"
  key: string; // globally-unique: `${featureRef}:${id}`, e.g. "001:US1"
  title: string;
  priority: string; // "P1" | ""
  status: string; // draft|ready|in-progress|blocked|done|""
  dependsOn: string[];
  blockedBy: string[];
  feature: string;
  tasksTotal: number;
  tasksDone: number;
  percent: number;
}

/** Short, unique reference for a feature dir: its leading number (e.g. "001"), else the full name. */
export function featureRefOf(feature: string): string {
  const m = /^(\d+)/.exec(feature);
  return m ? (m[1] ?? feature) : feature;
}

/** Globally-unique story key from a feature ref and a local canonical id. */
export function storyKey(featureRef: string, localId: string): string {
  return `${featureRef}:${localId}`;
}

/** Human-facing qualified id, e.g. "001:US-1". */
export function displayKey(s: StoryProgress): string {
  return `${s.featureRef}:${s.displayId}`;
}

export interface TaskLine {
  id: string; // T001
  done: boolean;
  story: string | null; // canonical US id
  description: string;
}

/** Canonicalize a story id like "US-1"/"US1"/"us 1" → "US1". */
export function canonicalStoryId(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const listValues = (raw: string): string[] =>
  raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(canonicalStoryId);

/** Parse user stories from a spec.md body. */
export function parseStories(content: string, feature: string): StoryProgress[] {
  const lines = content.split(/\r?\n/);
  const stories: StoryProgress[] = [];
  let current: StoryProgress | null = null;
  const ref = featureRefOf(feature);

  const headingRe = /^#{2,4}\s+(US-?\d+)\s*[—–-]\s*(.+?)\s*$/;

  for (const line of lines) {
    const heading = headingRe.exec(line);
    if (heading) {
      if (current) stories.push(current);
      const displayId = heading[1] ?? "";
      let title = (heading[2] ?? "").trim();
      let priority = "";
      const pri = /\(priority:\s*(P\d)\)/i.exec(title);
      if (pri) {
        priority = (pri[1] ?? "").toUpperCase();
        title = title.replace(/\s*\(priority:\s*P\d\)\s*/i, "").trim();
      }
      const localId = canonicalStoryId(displayId);
      current = {
        id: localId,
        displayId,
        featureRef: ref,
        key: storyKey(ref, localId),
        title,
        priority,
        status: "",
        dependsOn: [],
        blockedBy: [],
        feature,
        tasksTotal: 0,
        tasksDone: 0,
        percent: 0,
      };
      continue;
    }
    if (!current) continue;

    const status = /\*\*status:\*\*\s*([a-z-]+)/i.exec(line);
    if (status) current.status = (status[1] ?? "").toLowerCase();
    const dep = /\*\*depends-on:\*\*\s*(.+)$/i.exec(line);
    if (dep) current.dependsOn = listValues(dep[1] ?? "");
    const blk = /\*\*blocked-by:\*\*\s*(.+)$/i.exec(line);
    if (blk) current.blockedBy = listValues(blk[1] ?? "");
    if (!current.priority) {
      const pri = /\*\*priority:\*\*\s*(P\d)/i.exec(line);
      if (pri) current.priority = (pri[1] ?? "").toUpperCase();
    }
  }
  if (current) stories.push(current);
  return stories;
}

/** Parse task checkbox lines from a tasks.md body. */
export function parseTasks(content: string): TaskLine[] {
  const lines = content.split(/\r?\n/);
  const tasks: TaskLine[] = [];
  const taskRe = /^\s*-\s*\[([ xX])\]\s*\[(T\d+)\]\s*(.*)$/;
  for (const line of lines) {
    const m = taskRe.exec(line);
    if (!m) continue;
    const done = (m[1] ?? "").toLowerCase() === "x";
    const id = m[2] ?? "";
    const rest = m[3] ?? "";
    const storyTag = /\[(US-?\d+)\]/i.exec(rest);
    tasks.push({
      id,
      done,
      story: storyTag ? canonicalStoryId(storyTag[1] ?? "") : null,
      description: rest.replace(/^\s*(\[P\]\s*)?(\[US-?\d+\]\s*)?/i, "").trim(),
    });
  }
  return tasks;
}

/** Fold task completion into each story's counts. */
export function applyTasks(stories: StoryProgress[], tasks: TaskLine[]): void {
  const byId = new Map(stories.map((s) => [s.id, s]));
  for (const t of tasks) {
    if (!t.story) continue;
    const s = byId.get(t.story);
    if (!s) continue;
    s.tasksTotal += 1;
    if (t.done) s.tasksDone += 1;
  }
  for (const s of stories) {
    s.percent = s.tasksTotal === 0 ? 0 : Math.round((s.tasksDone / s.tasksTotal) * 100);
  }
}

/** Compute dashboard data for a whole project by reading specs/. */
export function computeDashboard(projectRoot: string): StoryProgress[] {
  const specsRoot = join(projectRoot, "specs");
  if (!existsSync(specsRoot)) return [];
  const all: StoryProgress[] = [];
  for (const entry of readdirSync(specsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(specsRoot, entry.name);
    const specPath = join(dir, "spec.md");
    if (!existsSync(specPath)) continue;
    const stories = parseStories(readFileSync(specPath, "utf8"), entry.name);
    const tasksPath = join(dir, "tasks.md");
    const tasks = existsSync(tasksPath) ? parseTasks(readFileSync(tasksPath, "utf8")) : [];
    applyTasks(stories, tasks);
    all.push(...stories);
  }
  return all;
}
