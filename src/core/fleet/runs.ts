import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { primaryRoot } from "../checkouts.js";
import { fleetSettings, loadConfig } from "../config.js";
import { withLock, writeFileAtomic } from "./lock.js";
import { RUN_STAGES, RUN_STATUSES, UNFINISHED, type RunRecord } from "./types.js";

/**
 * The run record and fleet directory (feature 025, T012; batch B step 1). Fleet state lives in the
 * primary checkout under `.amby/fleet/<run>/` so every lane worktree sees the same files (FR-010). A run
 * is created only on explicit request, as `<feature>.<n>`; there is no implicit run (FR-024).
 */

export const FLEET_DIR = join(".amby", "fleet");

/** `<primary checkout>/.amby/fleet`, found from any checkout or lane worktree. */
export function fleetRoot(root: string): string {
  return join(primaryRoot(root), FLEET_DIR);
}

/** A fleet directory name (feature 031): `fleet-<n>`. Never a run id (a run id ends in `.<n>`). */
const FLEET_ID = /^fleet-\d+$/;

export function isFleetId(s: string): boolean {
  return FLEET_ID.test(s);
}

/** `.amby/fleet/<fleet>/`: where a fleet's record and its per-feature runs live (031 D1). */
export function fleetDir(root: string, fleet: string): string {
  return join(fleetRoot(root), fleet);
}

/** The fleet directories that exist, oldest first. */
export function fleetIds(root: string): string[] {
  const dir = fleetRoot(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isFleetId(e.name))
    .map((e) => e.name)
    .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));
}

/**
 * A run's directory. A flat single run is `.amby/fleet/<run>/`; a run made by a fleet is nested one level down,
 * `.amby/fleet/fleet-<n>/<run>/`. Every reader and writer goes through here, so a nested run is found by the same
 * calls as a flat one (031 FR-021, D1).
 */
export function runDir(root: string, run: string): string {
  const flat = join(fleetRoot(root), run);
  if (existsSync(flat)) return flat;
  for (const id of fleetIds(root)) {
    const nested = join(fleetDir(root, id), run);
    if (existsSync(nested)) return nested;
  }
  return flat;
}

/** The run directory relative to the primary checkout, `/`-separated: what a prompt tells an assistant to write into. */
export function runDirRel(root: string, run: string): string {
  return relative(primaryRoot(root), runDir(root, run)).split(sep).join("/");
}

/** The fleet a run belongs to, or undefined for a flat single run. */
export function fleetOfRun(root: string, run: string): string | undefined {
  if (existsSync(join(fleetRoot(root), run))) return undefined;
  return fleetIds(root).find((id) => existsSync(join(fleetDir(root, id), run)));
}

const RUN_ID = /^[a-z0-9][a-z0-9-]*\.\d+$/i;

export function isRunId(s: string): boolean {
  return RUN_ID.test(s);
}

/** Create `.amby/fleet/` with its self-ignoring `.gitignore` (the same convention as activity markers). */
export function ensureFleetRoot(root: string): string {
  const dir = fleetRoot(root);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, "# AmbyKit fleet state (local only)\n*\n", "utf8");
  return dir;
}

/** The run record, or null when it is missing or unreadable (a missing record means "no run"). */
export function readRun(root: string, run: string): RunRecord | null {
  try {
    const raw = JSON.parse(readFileSync(join(runDir(root, run), "run.json"), "utf8")) as Partial<RunRecord>;
    if (!raw || typeof raw !== "object" || typeof raw.run !== "string" || typeof raw.feature !== "string") return null;
    if (!(RUN_STATUSES as readonly string[]).includes(raw.status as string)) return null;
    return {
      run: raw.run,
      feature: raw.feature,
      status: raw.status as RunRecord["status"],
      phase: typeof raw.phase === "number" ? raw.phase : 0,
      stage: (RUN_STAGES as readonly string[]).includes(raw.stage as string) ? (raw.stage as RunRecord["stage"]) : "working",
      round: typeof raw.round === "number" ? raw.round : 0,
      limit: typeof raw.limit === "number" ? raw.limit : 0,
      needsDecision: raw.needsDecision === true,
      gates: Array.isArray(raw.gates) ? raw.gates : [],
      lanes: Array.isArray(raw.lanes) ? raw.lanes : [],
      approvals: Array.isArray(raw.approvals) ? raw.approvals : [],
      escalations: Array.isArray(raw.escalations) ? raw.escalations : [],
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    };
  } catch {
    return null;
  }
}

function runNumber(run: string): number {
  return Number(run.slice(run.lastIndexOf(".") + 1));
}

/** Run directory names under `.amby/fleet/` and under each `fleet-<n>/` (031: nested runs). */
function runNames(root: string): string[] {
  const dir = fleetRoot(root);
  if (!existsSync(dir)) return [];
  const names: string[] = [];
  const scan = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory() && isRunId(e.name)) names.push(e.name);
  };
  scan(dir);
  for (const id of fleetIds(root)) scan(fleetDir(root, id));
  return names;
}

/** Every readable run, optionally one feature's, oldest first (by run number). A fleet's nested runs are included. */
export function listRuns(root: string, feature?: string): RunRecord[] {
  const runs: RunRecord[] = [];
  for (const name of runNames(root)) {
    const rec = readRun(root, name);
    if (rec && (!feature || rec.feature === feature)) runs.push(rec);
  }
  return runs.sort((a, b) => runNumber(a.run) - runNumber(b.run) || a.run.localeCompare(b.run));
}

export type RunResult = { ok: true; run: RunRecord } | { ok: false; warning: string };

/**
 * Create run `<feature>.<n>` on explicit request (019 FR-014). `n` is one past the highest existing number
 * for the feature, finished runs included, so an id is never reused.
 */
export function createRun(
  root: string,
  feature: string,
  init: Partial<Pick<RunRecord, "phase" | "stage" | "limit" | "lanes" | "gates">> & { fleet?: string } = {},
): RunResult {
  const primary = primaryRoot(root);
  ensureFleetRoot(root);
  const locked = withLock(primary, "fleet-runs", () => {
    const n = Math.max(0, ...listRuns(root, feature).map((r) => runNumber(r.run))) + 1;
    const record: RunRecord = {
      run: `${feature}.${n}`,
      feature,
      status: "active",
      phase: init.phase ?? 0,
      stage: init.stage ?? "working",
      round: 0,
      limit: init.limit ?? fleetSettings(loadConfig(primary)).roundLimit,
      needsDecision: false,
      gates: init.gates ?? [],
      lanes: init.lanes ?? [],
      approvals: [],
      escalations: [],
      createdAt: new Date().toISOString(),
    };
    const where = init.fleet ? join(fleetDir(root, init.fleet), record.run) : runDir(root, record.run);
    writeFileAtomic(join(where, "run.json"), JSON.stringify(record, null, 2) + "\n");
    return record;
  });
  return locked.ok ? { ok: true, run: locked.value } : { ok: false, warning: locked.warning };
}

/** Merge `patch` into a run record under the lock; the id, feature and creation time never change. */
export function updateRun(root: string, run: string, patch: Partial<Omit<RunRecord, "run" | "feature" | "createdAt">>): RunResult {
  const locked = withLock(primaryRoot(root), "fleet-runs", () => {
    const current = readRun(root, run);
    if (!current) return null;
    const next: RunRecord = { ...current, ...patch, run: current.run, feature: current.feature, createdAt: current.createdAt };
    writeFileAtomic(join(runDir(root, run), "run.json"), JSON.stringify(next, null, 2) + "\n");
    return next;
  });
  if (!locked.ok) return { ok: false, warning: locked.warning };
  if (!locked.value) return { ok: false, warning: `run '${run}' not found` };
  return { ok: true, run: locked.value };
}

/**
 * The run a report belongs to (FR-024): the requested one, else the feature's single unfinished run. With
 * none, or several, a warning is returned (naming the several); nothing is ever created and nothing throws.
 */
export function resolveRun(root: string, feature: string, requested?: string): RunResult {
  try {
    if (requested) {
      const rec = readRun(root, requested);
      return rec ? { ok: true, run: rec } : { ok: false, warning: `run '${requested}' not found` };
    }
    const open = listRuns(root, feature).filter((r) => UNFINISHED.includes(r.status));
    if (open.length === 1) return { ok: true, run: open[0]! };
    if (open.length === 0) return { ok: false, warning: `no unfinished run for ${feature}; nothing recorded in a run` };
    return { ok: false, warning: `several unfinished runs for ${feature} (${open.map((r) => r.run).join(", ")}); pass run` };
  } catch (err) {
    return { ok: false, warning: `could not resolve a run: ${(err as Error).message}` };
  }
}

/**
 * Run directories of a feature whose `run.json` is missing or unreadable (019 FR-015). `readRun` and `listRuns`
 * skip them, so this is how a damaged run is found. Ids come from the directory name.
 */
export function damagedRuns(root: string, feature: string): string[] {
  const out: string[] = [];
  for (const name of runNames(root)) {
    if (name.slice(0, name.lastIndexOf(".")) !== feature) continue;
    if (!readRun(root, name)) out.push(name);
  }
  return out.sort();
}

/**
 * Write a rebuilt record over a damaged run (019 FR-015). Refuses when the run is readable, so a healthy run is
 * never overwritten; `updateRun` is the only way to change one. The record's run id must be a run id.
 */
export function restoreRun(root: string, record: RunRecord): RunResult {
  if (!isRunId(record.run)) return { ok: false, warning: `'${record.run}' is not a run id` };
  const locked = withLock(primaryRoot(root), "fleet-runs", () => {
    if (readRun(root, record.run)) return false;
    ensureFleetRoot(root);
    writeFileAtomic(join(runDir(root, record.run), "run.json"), JSON.stringify(record, null, 2) + "\n");
    return true;
  });
  if (!locked.ok) return { ok: false, warning: locked.warning };
  if (!locked.value) return { ok: false, warning: `run '${record.run}' is readable; nothing to restore` };
  return { ok: true, run: record };
}
