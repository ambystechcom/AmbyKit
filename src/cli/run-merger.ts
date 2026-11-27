import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { git, isDirty } from "../core/git.js";
import { mergeLanes } from "../core/lane-merge.js";
import { escalate } from "../core/run-gate-actions.js";
import { readPhases } from "../core/spec-format/dispatch.js";
import { event, save, type LaneRuntime, type Session } from "./run-session.js";

/**
 * The merger (feature 028, FR-011, FR-012). A lane that is ready (its tasks are all checked off and its reviews
 * passed) merges with the check-off-aware core merge, one lane at a time in name order (phase, then lane
 * index). A real conflict aborts that merge, leaves the lane intact, and holds every later merge until a
 * person resolves it; the lane is retried each tick, so merging it by hand lets the run carry on. A lane with
 * open or blocked tasks, or whose phase's Verify line failed, is never merged (SC-009).
 */

/** Why this lane must not merge even though it is done, or null when nothing stops it. */
export function mergeBlocker(rt: LaneRuntime): string | null {
  const file = join(rt.ref.root, "specs", rt.ref.manifest.feature, "tasks.md");
  if (!existsSync(file)) return null;
  const phase = readPhases(readFileSync(file, "utf8")).find((p) => p.phase === rt.ref.manifest.phase);
  if (phase?.result === "failed") return `the phase ${phase.phase} Verify line failed${phase.why ? `: ${phase.why}` : ""}`;
  return null;
}

/** Merge ready lanes serially. Returns the lanes merged this tick. */
export function mergeReady(s: Session): string[] {
  const merged: string[] = [];
  const ordered = [...s.lanes].sort((a, b) => a.ref.name.localeCompare(b.ref.name, undefined, { numeric: true }));
  for (const rt of ordered) {
    // a lane already in conflict blocks the merges after it until it is resolved
    if (rt.file.status === "conflict") {
      if (!retry(s, rt)) break;
      merged.push(rt.file.lane);
      continue;
    }
    if (rt.file.status !== "ready") continue;
    const blocker = mergeBlocker(rt);
    if (blocker) {
      rt.file.status = "unfinished";
      rt.file.reason = `not merged: ${blocker}`;
      save(s, rt);
      event(s, "not-merged", rt, rt.file.reason);
      s.say(`${rt.file.lane}: ${rt.file.reason}`);
      continue;
    }
    if (!attempt(s, rt)) break;
    merged.push(rt.file.lane);
  }
  return merged;
}

/**
 * Workers edit and tick but never commit (they may run only `ambykit` and the allowed check commands), so a ready
 * lane's work is still uncommitted. The run commits it in the lane, once its reviews passed, before merging; the
 * message names the run, the lane and its tasks. A lane with nothing to commit is left as it is.
 */
export function commitLaneWork(s: Session, rt: LaneRuntime): void {
  const dir = rt.ref.root;
  if (!existsSync(dir) || !isDirty(dir)) return;
  git(dir, ["add", "-A"]);
  const tasks = rt.ref.manifest.tasks.map((t) => t.id).join(", ");
  git(dir, ["commit", "-q", "-m", `${s.feature} ${rt.file.lane}: ${tasks} (ambykit run ${s.run})`]);
  event(s, "committed", rt, tasks);
}

/** One merge attempt. False = stopped on a conflict (later lanes wait). */
function attempt(s: Session, rt: LaneRuntime): boolean {
  try {
    commitLaneWork(s, rt);
  } catch (err) {
    const detail = `could not commit the lane's work: ${(err as Error).message.split("\n")[0]}`;
    rt.file.status = "conflict";
    rt.file.reason = detail;
    save(s, rt);
    event(s, "conflict", rt, detail);
    escalate(s.root, s.run, { kind: "merge-conflict", lane: rt.file.lane, detail });
    s.say(`${rt.file.lane}: merge paused — ${detail}. The lane is intact; commit it by hand and the run carries on.`);
    return false;
  }
  const out = mergeLanes(s.root, s.feature, rt.ref.name);
  const result = out.ok ? out.lanes[0] : undefined;
  if (out.ok && result && (result.result === "merged" || result.result === "nothing")) {
    rt.file.status = "merged";
    delete rt.file.reason;
    save(s, rt);
    event(s, "merged", rt, result.result);
    s.say(`${rt.file.lane}: merged`);
    return true;
  }
  const detail = !out.ok ? out.error : (result?.detail ?? "merge failed");
  rt.file.status = "conflict";
  rt.file.reason = detail;
  save(s, rt);
  event(s, "conflict", rt, detail);
  escalate(s.root, s.run, { kind: "merge-conflict", lane: rt.file.lane, detail });
  s.say(`${rt.file.lane}: merge paused — ${detail}. The lane is intact; resolve it by hand and the run carries on.`);
  return false;
}

/** A conflicting lane is tried again each tick, quietly: only a different outcome is reported. */
function retry(s: Session, rt: LaneRuntime): boolean {
  try {
    commitLaneWork(s, rt);
  } catch {
    return false;
  }
  const out = mergeLanes(s.root, s.feature, rt.ref.name);
  const result = out.ok ? out.lanes[0] : undefined;
  if (out.ok && result && (result.result === "merged" || result.result === "nothing")) {
    rt.file.status = "merged";
    delete rt.file.reason;
    save(s, rt);
    event(s, "merged", rt, "after the conflict was resolved");
    s.say(`${rt.file.lane}: merged (conflict resolved)`);
    return true;
  }
  return false;
}
