import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Overview fixtures for feature 014. `base` reproduces the spec's US-1 numbers exactly: 3 features,
 * 10 stories, 25 of 40 tasks done (63%). `edges` adds the cases the widgets must handle: a feature
 * with no tasks.md (not planned), duplicate `008-*` numbers, an unknown status, an unassigned task,
 * a dependency cycle, an unknown reference, clarification markers, and an unreadable tasks.md.
 */

export interface StoryDef {
  id: number;
  title?: string;
  status: string;
  priority?: string;
  dependsOn?: string[];
  blockedBy?: string[];
}

export interface FeatureDef {
  dir: string;
  stories: StoryDef[];
  /** Per story id: [total, done]. `undefined` = no tasks.md. */
  tasks?: Record<number, [number, number]>;
  /** Extra raw task lines (e.g. unassigned). */
  extraTasks?: string[];
  /** Extra spec lines appended (e.g. clarification markers). */
  specExtra?: string[];
  ui?: { signedOff: boolean };
  plan?: boolean;
  /** Make tasks.md unreadable (a directory). */
  brokenTasks?: boolean;
}

export const BASE_FEATURES: FeatureDef[] = [
  {
    dir: "001-core",
    stories: [1, 2, 3, 4].map((id) => ({ id, status: "done", priority: "P1" })),
    tasks: { 1: [3, 3], 2: [3, 3], 3: [3, 3], 4: [3, 3] },
    ui: { signedOff: true },
    plan: true,
  },
  {
    dir: "002-widgets",
    stories: [
      { id: 1, status: "done", priority: "P1" },
      { id: 2, status: "in-progress", priority: "P1" },
      { id: 3, status: "blocked", priority: "P2", blockedBy: ["US-2"] },
      { id: 4, status: "draft", priority: "P2", dependsOn: ["US-2"] },
    ],
    tasks: { 1: [8, 8], 2: [6, 5], 3: [3, 0], 4: [3, 0] },
    plan: true,
  },
  {
    dir: "003-reports",
    stories: [
      { id: 1, status: "deferred", priority: "P3" },
      { id: 2, status: "draft", priority: "P3" },
    ],
    tasks: { 1: [4, 0], 2: [4, 0] },
    plan: true,
  },
];

export const EDGE_FEATURES: FeatureDef[] = [
  {
    dir: "004-mcp",
    stories: [{ id: 1, status: "draft" }],
    specExtra: [
      "- FR-001 THE SYSTEM SHALL serve. [NEEDS CLARIFICATION: which transport?]",
      "> Flag unknowns inline as `[NEEDS CLARIFICATION: …]` — never guess.",
    ],
  },
  {
    dir: "008-alpha",
    stories: [
      { id: 1, status: "draft", dependsOn: ["US-2"] },
      { id: 2, status: "draft", dependsOn: ["US-1"] },
    ],
    tasks: { 1: [1, 0], 2: [1, 0] },
  },
  {
    dir: "008-beta",
    stories: [{ id: 1, status: "wip", dependsOn: ["US-9"] }],
    tasks: { 1: [2, 1] },
    extraTasks: ["- [ ] [T090] unassigned cleanup (x.ts)"],
  },
  { dir: "009-broken", stories: [{ id: 1, status: "ready" }], brokenTasks: true },
];

function specBody(f: FeatureDef): string {
  const lines = [`---`, `feature: ${f.dir}`, `status: ready`, `---`, `# Spec — ${f.dir}`, ""];
  for (const s of f.stories) {
    lines.push(`### US-${s.id} — ${s.title ?? `Story ${s.id}`}  (priority: ${s.priority ?? "P2"})`, "");
    lines.push(`- **depends-on:** [${(s.dependsOn ?? []).join(", ")}]`);
    lines.push(`- **blocked-by:** [${(s.blockedBy ?? []).join(", ")}]`);
    lines.push(`- **status:** ${s.status}`, "");
  }
  lines.push(...(f.specExtra ?? []), "");
  return lines.join("\n");
}

function tasksBody(f: FeatureDef): string {
  const lines: string[] = [];
  let n = 1;
  for (const [id, [total, done]] of Object.entries(f.tasks ?? {})) {
    for (let i = 0; i < total; i++) {
      const tid = `T${String(n++).padStart(3, "0")}`;
      lines.push(`- [${i < done ? "x" : " "}] [${tid}] [US${id}] task ${tid} for US-${id} (src/x.ts)`);
    }
  }
  lines.push(...(f.extraTasks ?? []), "");
  return lines.join("\n");
}

/** Write features into `root/specs/`. */
export function writeFeatures(root: string, features: FeatureDef[]): void {
  for (const f of features) {
    const dir = join(root, "specs", f.dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "spec.md"), specBody(f));
    if (f.brokenTasks) mkdirSync(join(dir, "tasks.md"));
    else if (f.tasks) writeFileSync(join(dir, "tasks.md"), tasksBody(f));
    if (f.ui) writeFileSync(join(dir, "ui.md"), `---\nsigned_off: ${f.ui.signedOff}\n---\n# UI\n`);
    if (f.plan) writeFileSync(join(dir, "plan.md"), "# Plan\n");
  }
}

/** A fresh AmbyKit project with the base features, plus the edge features when `edges` is set. */
export function dashboardFixture(opts: { edges?: boolean; features?: FeatureDef[] } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-overview-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }) + "\n");
  writeFeatures(root, opts.features ?? [...BASE_FEATURES, ...(opts.edges ? EDGE_FEATURES : [])]);
  return root;
}

/** An AmbyKit project with no specs/ at all. */
export function emptyProject(): string {
  return dashboardFixture({ features: [] });
}
