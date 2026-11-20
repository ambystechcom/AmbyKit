import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FeatureHistory } from "../../src/core/metrics/types.js";

/**
 * A throwaway git repo built from scripted commits (feature 032 fixture): spec status changes, task check-offs and
 * converge gap tasks, in the 1.x or the 2.x spec form, with explicit commit times so cycle times are exact.
 */

export const HOUR = 3600;
export const T0 = 1_700_000_000; // unix seconds

export interface ScriptStep {
  /** Seconds after T0. */
  at: number;
  file: "spec.md" | "plan.md" | "tasks.md";
  text: string;
  feature?: string;
  /** Commit message; defaults to the file name. */
  message?: string;
}

function run(cwd: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function specText(feature: string, status: string, opts: { v2?: boolean; requirements?: number } = {}): string {
  const reqs = Array.from({ length: opts.requirements ?? 4 }, (_, i) => `- FR-${String(i + 1).padStart(3, "0")}  THE SYSTEM SHALL do ${i + 1}.`).join("\n");
  if (opts.v2) {
    return `---\nformat: 2\nfeature: ${feature}\ntitle: ${feature}\nstatus: ${status}\nstories:\n  - id: US-1\n    priority: P1\n    status: ${status === "done" ? "done" : "draft"}\n---\n\n# Spec\n\n### US-1 — One\n\n## Requirements (EARS)\n\n${reqs}\n`;
  }
  return `---\nfeature: ${feature}\ntitle: ${feature}\nstatus: ${status}\n---\n\n# Spec\n\n### US-1 — One  (priority: P1)\n\n- **status:** ${status === "done" ? "done" : "draft"}\n\n## Requirements (EARS)\n\n${reqs}\n`;
}

/** A tasks.md with `done` of `total` ordinary tasks checked, plus gap tasks (each checked when `gaps.done`). */
export function tasksText(done: number, total: number, gaps: { count: number; done?: boolean } = { count: 0 }): string {
  const lines = Array.from({ length: total }, (_, i) => `- [${i < done ? "x" : " "}] [T${String(i + 1).padStart(3, "0")}] task ${i + 1} (src/f${i + 1}.ts)`);
  const conv = gaps.count
    ? ["", "## Convergence", "", ...Array.from({ length: gaps.count }, (_, i) => `- [${gaps.done ? "x" : " "}] [T${String(900 + i)}] close gap ${i + 1} (closes FR-00${i + 1}) (src/g${i + 1}.ts)`)]
    : [];
  return `# Tasks\n\n## Phase 1 — Build\n\n${lines.join("\n")}\n${conv.join("\n")}\n`;
}

/** Build the repo: returns its root. Steps are committed in the order given, each at `T0 + at`. */
export function metricsRepo(feature: string, steps: ScriptStep[]): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-metrics-"));
  run(root, ["init", "-q", "-b", "main"]);
  for (const [k, v] of [["user.email", "t@example.com"], ["user.name", "Test"], ["commit.gpgsign", "false"]] as const) run(root, ["config", k, v]);
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: ["claude"] }) + "\n");
  for (const s of steps) {
    const dir = join(root, "specs", s.feature ?? feature);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, s.file), s.text);
    run(root, ["add", "-A"]);
    const when = `${T0 + s.at} +0000`;
    run(root, ["commit", "-q", "--allow-empty", "-m", s.message ?? s.file], { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when });
  }
  return root;
}

/** A complete feature history: spec drafted, marked ready, plan, tasks, check-offs, converge appends gaps and closes them. */
export function fullHistory(feature: string, start: number, opts: { v2?: boolean; gaps?: number } = {}): ScriptStep[] {
  const f = feature;
  const v2 = opts.v2 ?? false;
  const g = opts.gaps ?? 2;
  return [
    { at: start, file: "spec.md", feature: f, text: specText(f, "draft", { v2 }) },
    { at: start + 2 * HOUR, file: "spec.md", feature: f, text: specText(f, "ready", { v2 }) },
    { at: start + 3 * HOUR, file: "plan.md", feature: f, text: "# Plan\n" },
    { at: start + 4 * HOUR, file: "tasks.md", feature: f, text: tasksText(0, 4) },
    { at: start + 8 * HOUR, file: "tasks.md", feature: f, text: tasksText(4, 4) },
    { at: start + 9 * HOUR, file: "tasks.md", feature: f, text: tasksText(4, 4, { count: g }) },
    { at: start + 12 * HOUR, file: "tasks.md", feature: f, text: tasksText(4, 4, { count: g, done: true }) },
  ];
}

/** Turn scripted steps into an in-memory history (no git), oldest first. */
export function historyOf(feature: string, steps: ScriptStep[]): FeatureHistory {
  const h: FeatureHistory = { feature, spec: [], plan: [], tasks: [] };
  steps.forEach((s, i) => {
    const commit = `c${i}`;
    const time = T0 + s.at;
    if (s.file === "spec.md") h.spec.push({ commit, time, text: s.text });
    else if (s.file === "tasks.md") h.tasks.push({ commit, time, text: s.text });
    else h.plan.push({ commit, time });
  });
  return h;
}
