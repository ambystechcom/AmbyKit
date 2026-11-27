import { shortLane } from "../core/activity.js";
import { readFleetRecord, readRun, writeDirective, type DirectiveAction } from "../core/fleet/index.js";

/**
 * Pause, stop or resume a whole fleet (feature 031, FR-015, US-6). One directive per lane of every feature's run,
 * written only through spec 025's core writer (no new protocol, D7). Each worker finishes its current task and obeys
 * at its next report; the fleet's supervisors record the obeying exactly as 028 does for one run. Merged lanes get the
 * directive too: they have nothing left to obey, but a supervisor holds the whole run (no new worker, review or next
 * stage) only when every one of its lanes is paused or stopped, which includes a run between two stages whose lanes
 * have all merged (the 2.0 dogfood: a paused fleet still started work).
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
      const out = writeDirective(root, { feature: run.feature, lane: short, action: directive, run: run.run, now });
      if (!out.ok) return { ok: false, written, error: `${run.feature} ${short}: ${out.error}` };
      written.push(`${run.feature}:${short}`);
    }
  }
  return { ok: true, written };
}
