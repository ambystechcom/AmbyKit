import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeManifest } from "../../src/core/lanes.js";

/**
 * A git-free AmbyKit project for MCP tests: `specs/<dir>/spec.md` with stories and dependencies, an
 * optional `tasks.md`, and simulated lane checkouts under `.worktrees/` (a lane manifest plus the
 * lane's own `tasks.md`), which is all the state code looks at.
 */

export interface StoryFx {
  n: number;
  status?: string;
  dependsOn?: string[];
  blockedBy?: string[];
  title?: string;
}

export function specMd(dir: string, stories: StoryFx[]): string {
  const out = [`---`, `feature: ${dir}`, `title: ${dir}`, `status: ready`, `---`, ``, `# Spec`, ``];
  for (const s of stories) {
    out.push(`### US-${s.n} — ${s.title ?? `Story ${s.n}`}  (priority: P1)`, ``);
    out.push(`- **depends-on:** [${(s.dependsOn ?? []).join(", ")}]`);
    out.push(`- **blocked-by:** [${(s.blockedBy ?? []).join(", ")}]`);
    out.push(`- **status:** ${s.status ?? "ready"}`, ``);
  }
  return out.join("\n");
}

export interface TaskFx {
  id: string;
  story?: number;
  done?: boolean;
  parallel?: boolean;
  text?: string;
  paths?: string[];
  /** Appended after the path group, e.g. `⚠ BLOCKED: waiting`. */
  marker?: string;
}

export function tasksMd(dir: string, phases: { title: string; tasks: TaskFx[] }[]): string {
  const out = [`---`, `feature: ${dir}`, `---`, ``, `# Tasks`, ``];
  phases.forEach((p, i) => {
    out.push(`## Phase ${i + 1} — ${p.title}`, ``);
    for (const t of p.tasks) {
      const tags = [`[${t.id}]`, ...(t.parallel ? ["[P]"] : []), ...(t.story !== undefined ? [`[US${t.story}]`] : [])];
      const group = t.paths ? ` (${t.paths.join(", ")})` : "";
      out.push(`- [${t.done ? "x" : " "}] ${tags.join(" ")} ${t.text ?? `do ${t.id}`}${group}${t.marker ? ` ${t.marker}` : ""}`);
    }
    out.push(``, `**Verify:** run the checks`, ``);
  });
  return out.join("\n");
}

export interface FeatureFx {
  dir: string;
  stories: StoryFx[];
  phases?: { title: string; tasks: TaskFx[] }[];
}

export function project(features: FeatureFx[], config: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-mcp-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [], ...config }));
  for (const f of features) {
    const d = join(root, "specs", f.dir);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "spec.md"), specMd(f.dir, f.stories));
    if (f.phases) writeFileSync(join(d, "tasks.md"), tasksMd(f.dir, f.phases));
  }
  return root;
}

/** Add a simulated lane checkout for `feature` that owns `taskIds`; its tasks.md is `body`. */
export function addLaneCheckout(root: string, feature: string, phase: number, index: number, taskIds: string[], body: string): string {
  const name = `${feature}.lane-${phase}-${index}`;
  const laneRoot = join(root, ".worktrees", name);
  mkdirSync(join(laneRoot, "specs", feature), { recursive: true });
  mkdirSync(join(laneRoot, ".amby"), { recursive: true });
  writeFileSync(join(laneRoot, "specs", feature, "tasks.md"), body);
  writeManifest(laneRoot, { version: 1, feature, phase, lane: name, base: feature, tasks: taskIds.map((id) => ({ id, paths: [] })) });
  return laneRoot;
}
