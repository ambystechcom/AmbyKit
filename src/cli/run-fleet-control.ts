import { shortLane } from "../core/activity.js";
import { readFleetRecord, readRun, writeDirective, type DirectiveAction } from "../core/fleet/index.js";
import { readLaneFile } from "./run-files.js";

/**
 * Pause, stop or resume a whole fleet (feature 031, FR-015, US-6). One directive per lane of every feature's run,
 * written only through spec 025's core writer (no new protocol, D7). Each worker finishes its current task and obeys
 * at its next report; the fleet's supervisors record the obeying exactly as 028 does for one run. Lanes already
 * merged have nothing left to obey and get none.
 */

export type FleetAction = "pause" | "stop" | "resume";

export interface FleetControlResult {
  ok: boolean;
  /** `<feature>:<lane>` of every directive written. */
  written: string[];
  error?: string;
}

export function controlFleet(root: string, fleet: string, action: FleetAction, now: Date = new Date()): FleetControlResult {
  const record = readFleetRecord(root, fleet);
  if (!record) return { ok: false, written: [], error: `fleet '${fleet}' not found` };
  const directive: DirectiveAction = action === "resume" ? "continue" : action;
  const written: string[] = [];
  for (const f of record.features) {
    const run = f.run ? readRun(root, f.run) : null;
    if (!run) continue;
    for (const lane of run.lanes) {
      const short = shortLane(lane.lane);
      if (readLaneFile(root, run.run, short)?.status === "merged") continue;
      const out = writeDirective(root, { feature: run.feature, lane: short, action: directive, run: run.run, now });
      if (!out.ok) return { ok: false, written, error: `${run.feature} ${short}: ${out.error}` };
      written.push(`${run.feature}:${short}`);
    }
  }
  return { ok: true, written };
}
