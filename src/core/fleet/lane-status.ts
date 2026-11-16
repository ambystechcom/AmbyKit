import { join } from "node:path";
import { readMarkers, shortLane, tasksMtime, type ActivityMarker, type LaneState } from "../activity.js";
import { primaryRoot } from "../checkouts.js";
import { fleetSettings, loadConfig } from "../config.js";
import { failed, laneRefs, resolveLane, isFailed, type Failed } from "../query.js";
import { WORKTREES_DIR } from "../worktree.js";
import { directiveAction, directiveStatus, knownLanes, readDirective } from "./directives.js";
import { resolveRun } from "./runs.js";
import type { DirectiveAction, DirectiveStatus } from "./types.js";

/**
 * `laneStatus` — the single per-lane stall implementation (feature 025, US-5, batch B step 1). 019, 028 and
 * 029 call it and keep no stall logic of their own. A lane is **stalled** when its state is `working` and
 * neither a report nor a change to its `tasks.md` has happened for `fleet.stallMinutes` (default 15). The limit
 * is the fleet's, independent of the dashboard's idle limit (FR-014). Waiting, blocked, paused and done lanes
 * never stall: they are not supposed to be producing reports.
 */

export interface LaneStatus {
  /** Short lane name `lane-p-k`. */
  lane: string;
  /** The lane's last reported state; `unreported` when it has not reported at all. */
  state: LaneState | "unreported";
  stalled: boolean;
  /** ISO time of the lane's latest report. */
  lastReportAt?: string;
  /** Whole minutes since the later of the last report and the last `tasks.md` change; absent without either. */
  idleMinutes?: number;
  /** The stall limit in force, in minutes. */
  stallMinutes: number;
  directive: { action: DirectiveAction; status: DirectiveStatus };
  run?: string;
}

/** The latest marker of a lane, looked for in the lane's own checkout, the given checkout and the primary one. */
export function latestLaneMarker(root: string, feature: string, lane: string): { marker: ActivityMarker; at: number } | null {
  const short = shortLane(lane);
  const roots = new Set([root, primaryRoot(root), ...laneRefs(root, feature).filter((l) => l.short === short).map((l) => l.root)]);
  let best: { marker: ActivityMarker; at: number } | null = null;
  for (const r of roots) {
    for (const m of readMarkers(r)) {
      if (m.feature !== feature || !m.lane || shortLane(m.lane) !== short) continue;
      const at = Date.parse(m.at);
      if (!best || at > best.at) best = { marker: m, at };
    }
  }
  return best;
}

export function laneStatus(root: string, input: { feature: string; lane?: string; run?: string; now?: number }): LaneStatus | Failed {
  const now = input.now ?? Date.now();
  const settings = fleetSettings(loadConfig(primaryRoot(root)));
  const resolved = resolveLane(root, input.feature, input.lane);
  if (isFailed(resolved)) {
    // A lane with no checkout can still be a lane of the run (a worker not started yet): fall through when named.
    if (!input.lane) return resolved;
  }
  const lane = !isFailed(resolved) && resolved ? resolved.short : input.lane ? shortLane(input.lane.startsWith("lane-") || input.lane.includes(".lane-") ? input.lane : `lane-${input.lane}`) : null;
  if (!lane) return failed(`no lane given for ${input.feature} and this server is not running in a lane`);

  const run = resolveRun(root, input.feature, input.run);
  const known = knownLanes(root, input.feature, run.ok ? run.run.lanes : []);
  const found = latestLaneMarker(root, input.feature, lane);
  if (!known.includes(lane) && !found) {
    return failed(`lane '${input.lane ?? lane}' not found for ${input.feature}${known.length ? `; lanes: ${known.join(", ")}` : "; it has no lanes"}`);
  }

  const laneRoot = join(primaryRoot(root), WORKTREES_DIR, `${input.feature}.${lane}`);
  const touched = tasksMtime(laneRoot, input.feature);
  const lastReport = found?.at ?? null;
  const activity = Math.max(lastReport ?? 0, touched ?? 0, 0);
  const state: LaneStatus["state"] = found ? (found.marker.state ?? "working") : "unreported";
  const idleMs = activity > 0 ? Math.max(0, now - Math.min(activity, now)) : null;
  const stalled = state === "working" && idleMs !== null && idleMs > settings.stallMinutes * 60_000;

  const directive = run.ok ? readDirective(root, run.run.run, lane) : null;
  const status = directiveStatus(directive, found ? { at: found.marker.at, state: found.marker.state } : null);
  return {
    lane,
    state,
    stalled,
    ...(found ? { lastReportAt: found.marker.at } : {}),
    ...(idleMs !== null ? { idleMinutes: Math.floor(idleMs / 60_000) } : {}),
    stallMinutes: settings.stallMinutes,
    directive: { action: directiveAction(directive), status },
    ...(run.ok ? { run: run.run.run } : {}),
  };
}
