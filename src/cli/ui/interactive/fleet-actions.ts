import { approveGate } from "../../../core/run-gate-actions.js";
import { writeDirective, type WriteDirectiveResult } from "../../../core/fleet/directives.js";
import type { DirectiveAction } from "../../../core/fleet/types.js";
import type { FleetView } from "../../../core/fleet-view/types.js";
import type { FleetIntent } from "./fleet.js";

/**
 * The effect edge of the Fleet view (feature 029, FR-006/FR-009). Directives are written only through spec 025's
 * `writeDirective` (the single writer; the short lane form and the lock are its business), approvals only through
 * spec 028's `approveGate` (the function `ambykit run approve` calls) and never as a `continue` directive. The
 * writers are injectable so tests drive this with fakes.
 */

export interface FleetActionDeps {
  writeDirective: typeof writeDirective;
  approveGate: typeof approveGate;
}

export const realFleetActions: FleetActionDeps = { writeDirective, approveGate };

export interface FleetActionResult {
  ok: boolean;
  /** Short lane names a directive was written for. */
  lanes: string[];
  /** One line for the person (what was done, or why not). */
  message: string;
}

const ACTION: Record<"pause" | "resume" | "stop", DirectiveAction> = { pause: "pause", resume: "continue", stop: "stop" };
const WORD: Record<"pause" | "resume" | "stop", string> = { pause: "pause", resume: "continue", stop: "stop" };

/** Perform one confirmed intent. A lane directive failing never stops the others of a whole-run action. */
export function performFleetIntent(root: string, view: FleetView, intent: FleetIntent, deps: FleetActionDeps = realFleetActions): FleetActionResult {
  if (intent.kind === "approve") {
    const out = deps.approveGate(root, intent.run, { gate: intent.gate, by: "person (dashboard)" });
    return out.ok
      ? { ok: true, lanes: [], message: `Approved ${intent.gate}.` }
      : { ok: false, lanes: [], message: out.error };
  }
  const lanes = intent.target.kind === "lane" ? [intent.target.lane] : view.lanes.map((l) => l.lane);
  const action = ACTION[intent.kind];
  const wrote: string[] = [];
  const failures: string[] = [];
  for (const lane of lanes) {
    const r: WriteDirectiveResult = deps.writeDirective(root, { feature: view.run.feature, lane, action, run: view.run.run });
    if (r.ok) wrote.push(r.lane);
    else failures.push(`${lane}: ${r.error}`);
  }
  if (failures.length === 0) {
    return { ok: true, lanes: wrote, message: wrote.length === 1 ? `Wrote ${WORD[intent.kind]} for ${wrote[0]}.` : `Wrote ${WORD[intent.kind]} for ${wrote.length} lanes.` };
  }
  return { ok: wrote.length > 0, lanes: wrote, message: `${failures.length} of ${lanes.length} failed: ${failures[0]}` };
}
