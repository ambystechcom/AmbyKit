import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { shortLane, type ActivityMarker } from "../activity.js";
import { runDir } from "./runs.js";
import { DIRECTIVE_ACTIONS, type Directive, type DirectiveStatus } from "./types.js";

/**
 * Directives (feature 025, US-3 and US-7): one per lane at `.amby/fleet/<run>/directives/<lane>.json`
 * in the primary checkout, `{ action, at }`. The last write wins and a missing file means continue
 * (FR-010, FR-011). The file name uses the short lane form `lane-<p>-<k>`. The reader and the derived
 * status live here; the single writer, `writeDirective`, is added by T050 in this same module.
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
