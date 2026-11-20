import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TaskLine } from "../../src/core/dashboard.js";
import type { FeatureModel } from "../../src/core/fleet-plan/types.js";
import { tempProject } from "./spec-project.js";

/**
 * Fixture for feature 031: features as injected models (pure tests) and as files (reader and command tests).
 * `TaskDefn.paths` is a task's declared ownership: a list, `null` for none (`pathIssue: missing`) or `"glob"`.
 */
export interface TaskDefn {
  id: string;
  done?: boolean;
  /** `string[]` = declared files, `null` = no usable path (missing), `"glob"` = a glob was declared. */
  paths?: string[] | null | "glob";
  parallel?: boolean;
}

export interface FeatureDef {
  dir: string;
  status?: string;
  tasks?: TaskDefn[];
  /** Feature-level `depends-on` (v2 frontmatter), as written. Writing it makes the spec a v2 spec. */
  dependsOn?: string[];
  /** A story edge in the spec: story `US-1` depends on these (`NNN:US-#` of another feature). */
  storyDependsOn?: string[];
  plan?: boolean;
  lanes?: number;
}

const ref = (dir: string): string => /^(\d+)-/.exec(dir)?.[1] ?? dir;

export function taskModel(t: TaskDefn, phase = 1): TaskLine {
  const paths = Array.isArray(t.paths) ? t.paths.map((p) => p.toLowerCase()) : [];
  const issue = t.paths === null || (Array.isArray(t.paths) && t.paths.length === 0) ? "missing" : t.paths === "glob" ? "glob" : undefined;
  return {
    id: t.id,
    done: t.done ?? false,
    story: "US1",
    description: `task ${t.id}`,
    phase,
    parallel: t.parallel ?? true,
    paths,
    ...(issue ? { pathIssue: issue as "missing" | "glob" } : {}),
  };
}

/** The injected-model form of a feature. */
export function model(def: FeatureDef): FeatureModel {
  const tasks = (def.tasks ?? [{ id: "T001", paths: [`src/${ref(def.dir)}.ts`] }]).map((t) => taskModel(t));
  return {
    dir: def.dir,
    ref: ref(def.dir),
    status: def.status ?? "ready",
    tasks,
    artifacts: { spec: true, plan: def.plan ?? true, tasks: true },
    lanes: def.lanes ?? 2,
  };
}

function taskLine(t: TaskDefn): string {
  const group = Array.isArray(t.paths) ? ` (${t.paths.join(", ")})` : t.paths === "glob" ? " (src/**/*.ts)" : "";
  return `- [${t.done ? "x" : " "}] [${t.id}]${t.parallel === false ? "" : " [P]"} [US1] task ${t.id}${group}`;
}

function specText(def: FeatureDef): string {
  const status = def.status ?? "ready";
  const deps = def.storyDependsOn ?? [];
  if (def.dependsOn) {
    return [
      "---",
      `feature: ${def.dir}`,
      `status: ${status}`,
      "format: 2",
      `depends-on: [${def.dependsOn.map((d) => JSON.stringify(d)).join(", ")}]`,
      "stories:",
      "  - id: US-1",
      "    priority: P1",
      "    status: draft",
      `    depends-on: [${deps.join(", ")}]`,
      "    blocked-by: []",
      "---",
      "",
      `# Spec — ${def.dir}`,
      "",
      "### US-1 — Story",
      "",
    ].join("\n");
  }
  return [
    "---",
    `feature: ${def.dir}`,
    `status: ${status}`,
    "---",
    "",
    `# Spec — ${def.dir}`,
    "",
    "### US-1 — Story  (priority: P1)",
    "",
    `- **depends-on:** [${deps.join(", ")}]`,
    "- **blocked-by:** []",
    "- **status:** draft",
    "",
  ].join("\n");
}

/** Write one feature's spec, tasks and optional plan into `<root>/specs/<dir>/`. */
export function writeFeatureFiles(root: string, d: FeatureDef): void {
  const dir = join(root, "specs", d.dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "spec.md"), specText(d));
  const tasks = d.tasks ?? [{ id: "T001", paths: [`src/${ref(d.dir)}.ts`] }];
  writeFileSync(join(dir, "tasks.md"), ["---", `feature: ${d.dir}`, "---", "", "# Tasks", "", "## Phase 1", "", ...tasks.map(taskLine), ""].join("\n"));
  if (d.plan !== false) writeFileSync(join(dir, "plan.md"), `# Plan ${d.dir}\n`);
}

/** The file form: a temp project (no git) with every feature's spec, tasks and optional plan. */
export function fleetProject(defs: FeatureDef[]): string {
  const root = tempProject({});
  for (const d of defs) writeFeatureFiles(root, d);
  return root;
}

/** Three features: 031 depends on 030 (declared), 032 shares `src/shared.ts` with 031. */
export const THREE: FeatureDef[] = [
  { dir: "030-base", tasks: [{ id: "T001", paths: ["src/base.ts"] }] },
  { dir: "031-mid", dependsOn: ["030"], tasks: [{ id: "T001", paths: ["src/shared.ts"] }] },
  { dir: "032-top", tasks: [{ id: "T001", paths: ["src/shared.ts"] }] },
];
