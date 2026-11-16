import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { shortLane, type ActivityMarker } from "../activity.js";
import { laneRefs } from "../query.js";
import { withLock, writeFileAtomic } from "./lock.js";
import { resolveRun, runDir } from "./runs.js";
import { DIRECTIVE_ACTIONS, type Directive, type DirectiveAction, type DirectiveStatus } from "./types.js";

/**
 * Directives (feature 025, US-3 and US-7): one per lane at `.amby/fleet/<run>/directives/<lane>.json`
 * in the primary checkout, `{ action, at }`. The last write wins and a missing file means continue
 * (FR-010, FR-011). The file name uses the short lane form `lane-<p>-<k>`. This module holds the reader, the
 * derived status and the single writer, `writeDirective`, that 019's wrapper, 028, 029 and `ambykit directive`
 * all call (FR-023).
 */

export function directivesDir(root: string, run: string): string {
  return join(runDir(root, run), "directives");
}

export function directivePath(root: string, run: string, lane: string): string {
  return join(directivesDir(root, run), `${shortLane(lane)}.json`);
}

/** The lane's directive, or null (missing, unreadable or malformed: all mean "continue"). */
export function readDirective(root: string, run: string, lane: string): Directive | null {
  const path = directivePath(root, run, lane);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<Directive>;
    if (!raw || typeof raw.at !== "string" || Number.isNaN(Date.parse(raw.at))) return null;
    if (!(DIRECTIVE_ACTIONS as readonly string[]).includes(raw.action as string)) return null;
    return { action: raw.action as Directive["action"], at: raw.at };
  } catch {
    return null;
  }
}

/** What a worker should do: the directive's action, `continue` when there is none. */
export function directiveAction(directive: Directive | null): Directive["action"] {
  return directive?.action ?? "continue";
}

/**
 * Derived directive status, never stored (FR-022), from the directive and the lane's latest report:
 *
 * - no directive → `none`;
 * - a `pause` directive: `paused` while the lane's state is paused, else `pause requested` (this also covers
 *   the moment before the lane's next report, when the directive has not been seen yet);
 * - any other directive: `pending` while it is newer than the lane's latest report (or there is none),
 *   then `obeyed` once the lane has reported after it.
 *
 * A report dated exactly at the directive counts as before it (the directive was written after the worker
 * last looked), so a tie reads `pending`.
 */
export function directiveStatus(directive: Directive | null, latest: Pick<ActivityMarker, "at" | "state"> | null): DirectiveStatus {
  if (!directive) return "none";
  const reportedAfter = latest !== null && Date.parse(latest.at) > Date.parse(directive.at);
  if (directive.action === "pause") {
    return latest?.state === "paused" ? "paused" : "pause requested";
  }
  return reportedAfter ? "obeyed" : "pending";
}

export type WriteDirectiveResult =
  | { ok: true; run: string; lane: string; directive: Directive }
  | { ok: false; error: string };

/**
 * The lanes a directive may name: the run's recorded lanes plus the lane checkouts that exist for the
 * feature. A lane in neither does not exist (FR-023).
 */
export function knownLanes(root: string, feature: string, runLanes: { lane: string }[]): string[] {
  const names = new Set<string>();
  for (const l of runLanes) names.add(shortLane(l.lane));
  for (const l of laneRefs(root, feature)) names.add(l.short);
  return [...names].sort();
}

/**
 * Write a lane's directive, the single writer (FR-023). Validates the lane against the run, writes
 * `{ action, at }` atomically under a lock, and the last write wins (FR-011). `resume` is not an action:
 * callers write `continue`.
 */
export function writeDirective(
  root: string,
  input: { feature: string; lane: string; action: DirectiveAction; run?: string; now?: Date },
): WriteDirectiveResult {
  if (!(DIRECTIVE_ACTIONS as readonly string[]).includes(input.action)) {
    return { ok: false, error: `invalid action '${input.action}'; allowed: ${DIRECTIVE_ACTIONS.join(", ")}` };
  }
  const resolved = resolveRun(root, input.feature, input.run);
  if (!resolved.ok) return { ok: false, error: resolved.warning };
  const run = resolved.run.run;
  const short = shortLane(input.lane.includes(".lane-") || input.lane.startsWith("lane-") ? input.lane : `lane-${input.lane}`);
  const known = knownLanes(root, input.feature, resolved.run.lanes);
  if (!known.includes(short)) {
    return { ok: false, error: `lane '${input.lane}' not found in run ${run}${known.length ? `; lanes: ${known.join(", ")}` : "; the run has no lanes"}` };
  }
  const directive: Directive = { action: input.action, at: (input.now ?? new Date()).toISOString() };
  const locked = withLock(root, `directive-${run}-${short}`, () => writeFileAtomic(directivePath(root, run, short), JSON.stringify(directive) + "\n"));
  if (!locked.ok) return { ok: false, error: locked.warning };
  return { ok: true, run, lane: short, directive };
}
