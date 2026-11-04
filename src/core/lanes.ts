import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TaskLine } from "./dashboard.js";

/**
 * Lane analysis (feature 015) — decisions as pure functions over parsed `tasks.md`. No git, no
 * model tokens (FR-013); worktree side effects live in `cli/lane.ts`. Only the manifest helpers at
 * the bottom touch the filesystem.
 */

/** Normalize a declared path: `\` → `/`, collapse `//`, drop leading `./` and trailing `/`, lower-case. */
export function normalizePath(raw: string): string {
  return raw
    .trim()
    .replace(/[\\]/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^(\.\/)+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/** Two normalized paths overlap when equal or one is a `/`-prefix of the other (FR-005). */
export function overlaps(a: string, b: string): boolean {
  return a === b || b.startsWith(`${a}/`) || a.startsWith(`${b}/`);
}

/** Lane `k` of phase `p` for feature `NNN-slug` → `NNN-slug.lane-p-k` (directory and branch). */
export function laneName(feature: string, phase: number, index: number): string {
  return `${feature}.lane-${phase}-${index}`;
}

const LANE_NAME = /^(\d{3}-[a-z0-9][a-z0-9-]*)\.lane-(\d+)-(\d+)$/;

/** Inverse of `laneName`; null when `name` is not a lane name. */
export function parseLaneName(name: string): { feature: string; phase: number; index: number } | null {
  const m = LANE_NAME.exec(name);
  if (!m) return null;
  return { feature: m[1] ?? "", phase: Number(m[2]), index: Number(m[3]) };
}

// ── Declarations & conflicts ────────────────────────────────────────────────────────────────────

export interface Declaration {
  feature: string;
  task: string;
  issue: "missing" | "glob";
}

export interface LaneConflict {
  feature: string;
  phase: number;
  /** The shortest overlapping path. */
  path: string;
  /** Sorted task ids (≥ 2, at least one `[P]`). */
  tasks: string[];
}

/** Open tasks that declare no usable path, or declare a glob (FR-002/015/016). A warning, never an error. */
export function declarations(feature: string, tasks: TaskLine[]): Declaration[] {
  return tasks
    .filter((t) => !t.done && t.pathIssue !== undefined)
    .map((t) => ({ feature, task: t.id, issue: t.pathIssue! }));
}

/** The shortest overlapping path between two tasks' declarations, or null when they are disjoint. */
function sharedPath(a: TaskLine, b: TaskLine): string | null {
  let best: string | null = null;
  for (const pa of a.paths) {
    for (const pb of b.paths) {
      if (!overlaps(pa, pb)) continue;
      const shorter = pa.length <= pb.length ? pa : pb;
      if (best === null || shorter.length < best.length || (shorter.length === best.length && shorter < best)) {
        best = shorter;
      }
    }
  }
  return best;
}

/**
 * Conflicts among open tasks of the same phase where at least one of the pair is `[P]`
 * (FR-004/005/006/015). Findings are grouped per overlapping path: a path claimed by N tasks is one
 * finding listing all N ids.
 */
export function laneConflicts(feature: string, tasks: TaskLine[]): LaneConflict[] {
  const byPhase = new Map<number, TaskLine[]>();
  for (const t of tasks) {
    if (t.done || t.paths.length === 0) continue;
    const list = byPhase.get(t.phase);
    if (list) list.push(t);
    else byPhase.set(t.phase, [t]);
  }
  const out: LaneConflict[] = [];
  for (const [phase, list] of [...byPhase].sort((x, y) => x[0] - y[0])) {
    const byPath = new Map<string, Set<string>>();
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        if (!a.parallel && !b.parallel) continue;
        const path = sharedPath(a, b);
        if (path === null) continue;
        const ids = byPath.get(path) ?? new Set<string>();
        ids.add(a.id).add(b.id);
        byPath.set(path, ids);
      }
    }
    for (const [path, ids] of [...byPath].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
      out.push({ feature, phase, path, tasks: [...ids].sort() });
    }
  }
  return out;
}

/** One-line human message for a conflict, ending with the fix. */
export function describeConflict(c: LaneConflict): string {
  return (
    `${c.feature} phase ${c.phase}: ${c.tasks.join(", ")} both touch \`${c.path}\` — ` +
    "sequence them (drop `[P]` or move one to a later phase)"
  );
}

// ── Lane planning ───────────────────────────────────────────────────────────────────────────────

export interface PlannedLane {
  name: string;
  index: number;
  tasks: { id: string; paths: string[] }[];
}

export interface LanePlan {
  feature: string;
  phase: number;
  status: "planned" | "complete" | "conflict" | "no-parallel";
  lanes: PlannedLane[];
  /** Open non-`[P]` task ids of the phase — they stay in the feature checkout. */
  stays: string[];
  conflicts: LaneConflict[];
}

/**
 * Deal a phase's open `[P]` tasks round-robin into `min(lanes, count)` lanes (FR-008/017). Refuses
 * (`conflict`) when the phase has path conflicts (FR-009). `phase` defaults to the first phase with
 * open `[P]` tasks; `lanes` defaults to 2.
 */
export function planLanes(
  feature: string,
  tasks: TaskLine[],
  opts: { phase?: number; lanes?: number } = {},
): LanePlan {
  const wanted = Math.max(1, Math.floor(opts.lanes ?? 2));
  const openParallel = tasks.filter((t) => !t.done && t.parallel);
  const anyParallel = tasks.filter((t) => t.parallel);

  let phase: number;
  if (opts.phase !== undefined) phase = opts.phase;
  else if (openParallel.length > 0) phase = Math.min(...openParallel.map((t) => t.phase));
  else phase = anyParallel.length > 0 ? Math.max(...anyParallel.map((t) => t.phase)) : 0;

  const base = { feature, phase, lanes: [] as PlannedLane[], stays: [] as string[], conflicts: [] as LaneConflict[] };
  const inPhase = tasks.filter((t) => t.phase === phase);
  const open = inPhase.filter((t) => !t.done && t.parallel);
  if (open.length === 0) {
    return { ...base, status: inPhase.some((t) => t.parallel) ? "complete" : "no-parallel" };
  }
  const conflicts = laneConflicts(feature, tasks).filter((c) => c.phase === phase);
  if (conflicts.length > 0) return { ...base, status: "conflict", conflicts };

  const n = Math.min(wanted, open.length);
  const lanes: PlannedLane[] = Array.from({ length: n }, (_, i) => ({
    name: laneName(feature, phase, i + 1),
    index: i + 1,
    tasks: [],
  }));
  open.forEach((t, i) => lanes[i % n]!.tasks.push({ id: t.id, paths: t.paths }));
  const stays = inPhase.filter((t) => !t.done && !t.parallel).map((t) => t.id);
  return { ...base, status: "planned", lanes, stays };
}

// ── Check-off merge ─────────────────────────────────────────────────────────────────────────────

const CHECKBOX = /^(\s*-\s*)\[[ xX]\]/;
const stripBox = (line: string): string => line.replace(/\r$/, "").replace(CHECKBOX, "$1[ ]");
const isTicked = (line: string): boolean => /^\s*-\s*\[[xX]\]/.test(line);

/**
 * Resolve a `tasks.md` conflict that is only about check-offs (FR-019): returns `ours` with every
 * task ticked that either side ticked, preserving ours' line endings. Returns null when `ours` and
 * `theirs` differ in anything but checkbox state (the caller then aborts the merge). `base` is
 * accepted for the 3-way call shape; the union rule does not need it.
 */
export function mergeCheckoffs(_base: string, ours: string, theirs: string): string | null {
  const o = ours.split("\n");
  const t = theirs.split("\n");
  if (o.length !== t.length) return null;
  for (let i = 0; i < o.length; i++) {
    if (stripBox(o[i]!) !== stripBox(t[i]!)) return null;
  }
  return o
    .map((line, i) => (isTicked(t[i]!) && !isTicked(line) ? line.replace(CHECKBOX, "$1[x]") : line))
    .join("\n");
}

// ── Manifest ────────────────────────────────────────────────────────────────────────────────────

export interface LaneManifest {
  version: 1;
  feature: string;
  phase: number;
  lane: string;
  /** The feature branch the lane was created from. */
  base: string;
  /** Feature-branch commit the lane started at; a lane still at this commit has no work to merge. */
  baseHead?: string;
  tasks: { id: string; paths: string[] }[];
}

/** `<lane checkout>/.amby/lane/lane.json` — in a self-ignoring directory. */
export function manifestPath(laneRoot: string): string {
  return join(laneRoot, ".amby", "lane", "lane.json");
}

export function writeManifest(laneRoot: string, manifest: LaneManifest): void {
  const file = manifestPath(laneRoot);
  const dir = join(laneRoot, ".amby", "lane");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".gitignore"), "*\n", "utf8");
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

/** Read a lane's manifest; null when absent or malformed. */
export function readManifest(laneRoot: string): LaneManifest | null {
  const file = manifestPath(laneRoot);
  if (!existsSync(file)) return null;
  try {
    const m = JSON.parse(readFileSync(file, "utf8")) as Partial<LaneManifest>;
    if (m.version !== 1 || !m.feature || !m.lane || !Array.isArray(m.tasks)) return null;
    return m as LaneManifest;
  } catch {
    return null;
  }
}

/** Manifest ids that are missing from the feature's current tasks, or whose paths changed (FR-020). */
export function manifestDrift(manifest: LaneManifest, current: TaskLine[]): string[] {
  const byId = new Map(current.map((t) => [t.id, t]));
  const key = (paths: string[]): string => [...paths].sort().join("|");
  return manifest.tasks
    .filter((m) => {
      const t = byId.get(m.id);
      return !t || key(t.paths) !== key(m.paths);
    })
    .map((m) => m.id);
}

/**
 * clean / dirty / merged for a lane (FR-010). `merged` needs the lane to have moved past where it
 * started — a fresh lane is trivially an ancestor of its feature branch but has nothing to merge.
 */
export function laneState(input: {
  dirty: boolean;
  tip: string;
  baseHead?: string;
  mergedIntoFeature: boolean;
}): "clean" | "dirty" | "merged" {
  if (input.dirty) return "dirty";
  if (input.mergedIntoFeature && input.baseHead !== undefined && input.tip !== input.baseHead) return "merged";
  return "clean";
}

/** Resolve `p-k`, `lane-p-k` or a full lane name against a feature's lane names; null when ambiguous/unknown. */
export function matchLane(feature: string, names: string[], arg: string): string | null {
  const wanted = arg.startsWith(`${feature}.`) ? arg : `${feature}.${arg.startsWith("lane-") ? arg : `lane-${arg}`}`;
  return names.includes(wanted) ? wanted : null;
}

/**
 * Feature progress with lane work folded in (decision D5): a task counts done when it is checked in
 * the feature's `tasks.md` or in the lane that owns it, so progress moves before lanes are merged.
 * Returns new task objects; the input is untouched.
 */
export function unionLaneDone(
  tasks: TaskLine[],
  lanes: { ids: string[]; tasks: TaskLine[] }[],
): TaskLine[] {
  const doneInLane = new Set<string>();
  for (const lane of lanes) {
    const owned = new Set(lane.ids);
    for (const t of lane.tasks) if (t.done && owned.has(t.id)) doneInLane.add(t.id);
  }
  return tasks.map((t) => (!t.done && doneInLane.has(t.id) ? { ...t, done: true } : t));
}
