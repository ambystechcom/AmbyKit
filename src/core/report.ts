import { shortLane, writeMarker, LANE_STATES, type ActivityMarker, type LaneState } from "./activity.js";
import { directiveAction, directiveStatus, readDirective } from "./fleet/directives.js";
import { resolveRun } from "./fleet/runs.js";
import type { DirectiveAction, DirectiveStatus } from "./fleet/types.js";

/**
 * The one core writer behind `report_activity` and `ambykit activity` (feature 025, FR-007): record the
 * marker, resolve the run, read the lane's directive. It never throws and never fails the agent: every
 * problem is a `warning` on an otherwise normal result (FR-012). A report needs no progress figure; the
 * marker stays a superset of 017's (FR-006, FR-007).
 */

export interface ReportInput {
  /** Feature directory name (`025-mcp-server`). */
  feature: string;
  agent: string;
  phase: string;
  task?: string;
  /** `lane-1-2`, `1-2` or the full name. */
  lane?: string;
  state?: string;
  /** Run id; omitted means the feature's single unfinished run. */
  run?: string;
  /** Recorded as `pid` when given (the CLI passes its parent's pid, as 017 does). */
  pid?: number;
  /** Look up the run and the directive. Off for a plain `ambykit activity` call, which stays as it was. */
  fleet?: boolean;
  now?: Date;
}

export interface ReportResult {
  ack: boolean;
  directive: DirectiveAction;
  /** Derived status of the lane's directive (FR-022); only when a lane's run was resolved and a directive exists. */
  directiveStatus?: DirectiveStatus;
  /** The run this report was filed under, when one was resolved. */
  run?: string;
  warning?: string;
}

const ID = /^[a-z0-9][a-z0-9.-]*$/i;

/** `1-2` / `lane-1-2` / `NNN-slug.lane-1-2` → the full lane name for the body of the marker. */
export function fullLaneName(feature: string, lane: string): string {
  const short = shortLane(lane);
  return `${feature}.${short.startsWith("lane-") ? short : `lane-${short}`}`;
}

export function reportActivity(root: string, input: ReportInput): ReportResult {
  const warnings: string[] = [];
  const result: ReportResult = { ack: false, directive: "continue" };
  try {
    if (!ID.test(input.agent)) return { ...result, warning: `invalid agent id '${input.agent}'` };
    if (input.state !== undefined && !(LANE_STATES as readonly string[]).includes(input.state)) {
      return { ...result, warning: `invalid state '${input.state}'; allowed: ${LANE_STATES.join(", ")}` };
    }
    const lane = input.lane ? fullLaneName(input.feature, input.lane) : undefined;

    let run = input.run;
    let runFound = false;
    if (input.fleet) {
      const resolved = resolveRun(root, input.feature, input.run);
      if (resolved.ok) {
        run = resolved.run.run;
        runFound = true;
      } else warnings.push(resolved.warning);
    }

    const marker: ActivityMarker = {
      feature: input.feature,
      agent: input.agent,
      phase: input.phase,
      ...(input.task ? { task: input.task } : {}),
      at: (input.now ?? new Date()).toISOString(),
      ...(input.pid !== undefined ? { pid: input.pid } : {}),
      ...(lane ? { lane } : {}),
      ...(input.state ? { state: input.state as LaneState } : {}),
      ...(run ? { run } : {}),
    };
    writeMarker(root, marker);
    result.ack = true;

    if (runFound && run && lane) {
      const directive = readDirective(root, run, lane);
      result.directive = directiveAction(directive);
      // The report just written is "the lane's latest report", so a directive older than it reads obeyed/paused.
      const status = directiveStatus(directive, { at: marker.at, state: marker.state });
      if (status !== "none") result.directiveStatus = status;
    }
    if (run) result.run = run;
  } catch (err) {
    warnings.push(`activity not recorded: ${(err as Error).message.split("\n")[0]}`);
  }
  if (warnings.length > 0) result.warning = warnings.join("; ");
  return result;
}
