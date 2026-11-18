import { mkdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeMarker, type LaneState } from "../../src/core/activity.js";
import { directivePath } from "../../src/core/fleet/directives.js";
import { createRun, runDir, updateRun } from "../../src/core/fleet/runs.js";
import type { FleetView, LaneViewState, RunView } from "../../src/core/fleet-view/types.js";
import type { DirectiveAction, DirectiveStatus, RunGate, RunLane, RunRecord, RunStage, RunStatus } from "../../src/core/fleet/types.js";
import { addLaneCheckout, project, tasksMd } from "../mcp/fixture.js";

/**
 * A fleet fixture (feature 029): a temp project with one feature, N lane checkouts, spec 025's markers and
 * directives, and a `run.json` written by 025's own `createRun`/`updateRun`, so its shape is exactly
 * 025's `data-model.md` schema and never a private one (plan D4).
 */

export const FEATURE = "001-alpha";
export const NOW = Date.parse("2026-11-16T12:00:00.000Z");
export const ago = (min: number): Date => new Date(NOW - min * 60_000);

export interface FleetLaneFx {
  /** Lane index in phase 1: `lane-1-<k>`. */
  k: number;
  assistant?: string;
  /** Latest report, minutes before NOW; omit for a lane that has not reported. */
  reportMinutesAgo?: number;
  state?: LaneState;
  /** `tasks.md` mtime, minutes before NOW (defaults to the report time, or 600). */
  tasksMinutesAgo?: number;
  /** Directive written minutes before NOW. */
  directive?: { action: DirectiveAction; minutesAgo: number };
}

export interface FleetFixture {
  root: string;
  feature: string;
  run: string;
  laneRoots: Record<string, string>;
}

export function fleetProject(
  lanes: FleetLaneFx[],
  opts: { status?: RunStatus; stage?: RunStage; round?: number; limit?: number; needsDecision?: boolean; gates?: RunGate[]; config?: Record<string, unknown>; noRun?: boolean; now?: number } = {},
): FleetFixture {
  // Report and directive times are minutes before `opts.now` (default NOW); CLI tests that read with the real clock pass Date.now().
  const agoAt = (min: number): Date => new Date((opts.now ?? NOW) - min * 60_000);
  const phases = [{ title: "Work", tasks: lanes.map((l) => ({ id: `T${String(l.k).padStart(3, "0")}`, story: 1 })) }];
  const root = project([{ dir: FEATURE, stories: [{ n: 1 }], phases }], opts.config ?? {});
  const laneRoots: Record<string, string> = {};
  const runLanes: RunLane[] = [];
  for (const l of lanes) {
    const id = `T${String(l.k).padStart(3, "0")}`;
    const laneRoot = addLaneCheckout(root, FEATURE, 1, l.k, [id], tasksMd(FEATURE, [{ title: "Work", tasks: [{ id, story: 1 }] }]));
    const short = `lane-1-${l.k}`;
    laneRoots[short] = laneRoot;
    runLanes.push({ lane: `${FEATURE}.${short}`, assistant: l.assistant ?? "claude", tasks: [id] });
    const mtime = agoAt(l.tasksMinutesAgo ?? l.reportMinutesAgo ?? 600);
    utimesSync(join(laneRoot, "specs", FEATURE, "tasks.md"), mtime, mtime);
    if (l.reportMinutesAgo !== undefined) {
      writeMarker(laneRoot, {
        feature: FEATURE,
        agent: l.assistant ?? "claude",
        phase: "implement",
        at: agoAt(l.reportMinutesAgo).toISOString(),
        lane: `${FEATURE}.${short}`,
        ...(l.state ? { state: l.state } : {}),
      });
    }
  }
  if (opts.noRun) return { root, feature: FEATURE, run: "", laneRoots };
  const created = createRun(root, FEATURE, { lanes: runLanes, ...(opts.limit !== undefined ? { limit: opts.limit } : {}), ...(opts.gates ? { gates: opts.gates } : {}) });
  if (!created.ok) throw new Error(created.warning);
  const run = created.run.run;
  const patch: Partial<RunRecord> = {
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.stage ? { stage: opts.stage } : {}),
    ...(opts.round !== undefined ? { round: opts.round } : {}),
    ...(opts.needsDecision !== undefined ? { needsDecision: opts.needsDecision } : {}),
  };
  if (Object.keys(patch).length) updateRun(root, run, patch);
  for (const l of lanes) {
    if (!l.directive) continue;
    const path = directivePath(root, run, `lane-1-${l.k}`);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, JSON.stringify({ action: l.directive.action, at: agoAt(l.directive.minutesAgo).toISOString() }) + "\n");
  }
  return { root, feature: FEATURE, run, laneRoots };
}

/** Overwrite a run's `run.json` with arbitrary text (corrupt-file cases). */
export function writeRunJson(f: FleetFixture, text: string): void {
  writeFileSync(join(runDir(f.root, f.run), "run.json"), text);
}

/** An in-memory `FleetView` (no files) for reducer, action and renderer tests. */
export function fleetView(
  lanes: { lane?: string; assistant?: string; state?: LaneViewState; stalled?: boolean; idle?: number; directive?: { action: DirectiveAction; status: DirectiveStatus } }[],
  run: Partial<RunView> = {},
): FleetView {
  return {
    now: NOW,
    others: [],
    run: { run: "001-alpha.1", feature: FEATURE, status: "active", phase: 1, stage: "working", round: 0, limit: 3, needsDecision: false, gates: [], ...run },
    lanes: lanes.map((l, i) => ({
      lane: l.lane ?? `lane-1-${i + 1}`,
      assistant: l.assistant ?? "claude",
      state: l.state ?? "working",
      stalled: l.stalled ?? false,
      ...(l.idle !== undefined ? { idleMinutes: l.idle } : {}),
      directive: l.directive ?? { action: "continue", status: "none" },
      tasks: [],
    })),
  };
}
