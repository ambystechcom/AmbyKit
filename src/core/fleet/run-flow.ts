import { shortLane } from "../activity.js";
import type { LaneOverlap, RunLane, RunRecord, RunStage } from "./types.js";

/**
 * Pure run-flow helpers for `/amby.run` (feature 019). Everything here maps values to values: no file, no
 * process, no clock. Reading and writing run state, claims, notes and directives belongs to spec 025's modules
 * (`./runs.js`, `./claims.js`, `./notes.js`, `./directives.js`, `./lane-status.js`); the `ambykit fleet` wrapper
 * only calls them. The run record's shape is defined once, in `specs/025-mcp-server/data-model.md`.
 */

// --- Input ----------------------------------------------------------------

/** One task line, as far as the run needs it (a subset of the dashboard's `TaskLine`). */
export interface FlowTask {
  id: string;
  done: boolean;
  /** Phase number, numbered exactly as `parseTasks` does. */
  phase: number;
  /** Feature 020: BLOCKED reason; `""` = blocked without a reason; absent = not blocked. */
  blocked?: string;
}

/** One phase's Verify line (a subset of 020's `PhaseVerify`). */
export interface FlowPhase {
  phase: number;
  title?: string;
  /** The check, without its result; absent = the phase has no Verify line. */
  check?: string;
  result?: "passed" | "failed" | "unverified";
}

/** What `/amby.run` reads about a feature: its artifacts and its task state. */
export interface FlowInput {
  feature: string;
  /** The spec's `status:` frontmatter value; `null` = there is no `spec.md`. */
  specStatus: string | null;
  hasPlan: boolean;
  hasTasks: boolean;
  tasks: FlowTask[];
  phases: FlowPhase[];
}

// --- US-1: where does the run continue? (FR-001..FR-003) -------------------

export type MissingArtifact = "spec.md" | "plan.md" | "tasks.md";

export type FlowStep =
  /** FR-002: an artifact is missing or not approved; the run stops before the phase and names it. */
  | { kind: "stop"; missing: MissingArtifact; reason: "missing" | "not-approved"; command: string; message: string }
  /** FR-003: nothing left to do. `needsConverge` is true when every phase is done but the spec is not marked done. */
  | { kind: "done"; needsConverge: boolean }
  /** The state could not be read as a feature in a known shape. */
  | { kind: "unknown"; message: string }
  /** FR-001: the first incomplete phase. */
  | { kind: "phase"; phase: number; stage: Extract<RunStage, "working" | "qa">; pending: string[]; blocked: string[] };

const SPEC_STATUSES = ["draft", "ready", "in-progress", "blocked", "done"];

/** A phase is complete when all its tasks are checked and a recorded Verify has passed (no Verify line: just checked). */
function phaseComplete(tasks: FlowTask[], verify: FlowPhase | undefined): boolean {
  if (!tasks.every((t) => t.done)) return false;
  if (!verify || verify.check === undefined) return true;
  return verify.result === "passed";
}

/**
 * The first incomplete phase of a feature, or why the run cannot continue. Spec status `draft` is "not approved";
 * every other known status counts as approved for the run. A phase with every task checked but no passing Verify
 * continues at the QA stage (FR-009); a phase with open tasks continues at the working stage.
 */
export function determinePhase(input: FlowInput): FlowStep {
  if (input.specStatus === null) {
    return { kind: "stop", missing: "spec.md", reason: "missing", command: "/amby.specify", message: `${input.feature} has no spec.md; run /amby.specify first.` };
  }
  if (!SPEC_STATUSES.includes(input.specStatus)) {
    return { kind: "unknown", message: `spec status '${input.specStatus}' is not one of ${SPEC_STATUSES.join(", ")}` };
  }
  if (input.specStatus === "draft") {
    return { kind: "stop", missing: "spec.md", reason: "not-approved", command: "/amby.clarify", message: `${input.feature}/spec.md is still draft; clarify and approve it (status: ready) first.` };
  }
  if (!input.hasPlan) {
    return { kind: "stop", missing: "plan.md", reason: "missing", command: "/amby.plan", message: `${input.feature} has no plan.md; run /amby.plan first.` };
  }
  if (!input.hasTasks) {
    return { kind: "stop", missing: "tasks.md", reason: "missing", command: "/amby.tasks", message: `${input.feature} has no tasks.md; run /amby.tasks first.` };
  }
  if (input.tasks.length === 0) {
    return { kind: "unknown", message: `${input.feature}/tasks.md has no task lines` };
  }

  const numbers = [...new Set(input.tasks.map((t) => t.phase))].sort((a, b) => a - b);
  for (const n of numbers) {
    const tasks = input.tasks.filter((t) => t.phase === n);
    const verify = input.phases.find((p) => p.phase === n);
    if (phaseComplete(tasks, verify)) continue;
    const open = tasks.filter((t) => !t.done);
    if (open.length === 0) return { kind: "phase", phase: n, stage: "qa", pending: [], blocked: [] };
    const blocked = open.filter((t) => t.blocked !== undefined).map((t) => t.id);
    return { kind: "phase", phase: n, stage: "working", pending: open.filter((t) => t.blocked === undefined).map((t) => t.id), blocked };
  }
  return { kind: "done", needsConverge: input.specStatus !== "done" };
}

// --- US-4: the review loop (FR-012, SC-003) ---------------------------------

export type RoundAction = "retry" | "escalate";

/**
 * What the lead does after a review round failed. `failedRounds` is how many rounds of this phase have failed
 * so far; at or over the limit the lead stops, summarizes and asks a person (FR-012). A limit below 1 is read as
 * "never loop", the safe side, so a damaged record can never loop for ever.
 */
export function nextRoundAction(failedRounds: number, limit: number): RoundAction {
  if (!Number.isFinite(limit) || limit < 1) return "escalate";
  return failedRounds >= limit ? "escalate" : "retry";
}

// --- US-3: the verdict contract (FR-010, FR-011) -----------------------------

export const REVIEW_ROLES = ["qa", "architect"] as const;
export type ReviewRole = (typeof REVIEW_ROLES)[number];

export interface Finding {
  id: string;
  severity: string;
  finding: string;
  fix: string;
}

export interface Verdict {
  verdict: "pass" | "fail";
  findings: Finding[];
}

export type VerdictResult =
  | { ok: true; verdict: Verdict; /** The finding IDs the lead returns to the worker; empty for a pass. */ failingIds: string[] }
  | { ok: false; error: string };

/**
 * `verdicts/<lane>.<role>.<round>.json` under the run directory: one file per lane, role and round, the lane in
 * its short form `lane-<p>-<k>` (data-model "Review verdicts"). Throws on a role or round that cannot be a name.
 */
export function verdictPath(lane: string, role: ReviewRole, round: number): string {
  if (!(REVIEW_ROLES as readonly string[]).includes(role)) throw new Error(`review role must be one of ${REVIEW_ROLES.join(", ")}`);
  if (!Number.isInteger(round) || round < 1) throw new Error("round must be a whole number from 1");
  return `verdicts/${shortLane(lane)}.${role}.${round}.json`;
}

/** Parse and validate a verdict file. A `fail` must carry at least one finding with an id and text. */
export function parseVerdict(text: string): VerdictResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "verdict is not valid JSON" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "verdict must be a JSON object" };
  const o = raw as Record<string, unknown>;
  if (o["verdict"] !== "pass" && o["verdict"] !== "fail") return { ok: false, error: "verdict must be \"pass\" or \"fail\"" };
  const list = o["findings"] === undefined ? [] : o["findings"];
  if (!Array.isArray(list)) return { ok: false, error: "findings must be a list" };
  const findings: Finding[] = [];
  for (const [i, item] of list.entries()) {
    if (!item || typeof item !== "object") return { ok: false, error: `finding ${i + 1} must be an object` };
    const f = item as Record<string, unknown>;
    if (typeof f["id"] !== "string" || f["id"].trim() === "") return { ok: false, error: `finding ${i + 1} needs an id` };
    if (typeof f["finding"] !== "string" || f["finding"].trim() === "") return { ok: false, error: `finding ${f["id"]} needs text` };
    findings.push({
      id: f["id"].trim(),
      severity: typeof f["severity"] === "string" ? f["severity"] : "",
      finding: f["finding"],
      fix: typeof f["fix"] === "string" ? f["fix"] : "",
    });
  }
  const ids = findings.map((f) => f.id);
  if (new Set(ids).size !== ids.length) return { ok: false, error: "finding ids must be unique" };
  if (o["verdict"] === "fail" && findings.length === 0) return { ok: false, error: "a failing verdict needs at least one finding" };
  return { ok: true, verdict: { verdict: o["verdict"], findings }, failingIds: o["verdict"] === "fail" ? ids : [] };
}

// --- US-5: rebuilding state from tasks.md (FR-015) -----------------------------

/**
 * A run record rebuilt from `tasks.md` alone, in 025's schema, for a run whose state is missing or corrupt. The
 * phase and stage come from `determinePhase`, so every checked task stays checked (completed work is never
 * discarded) and only the lead's bookkeeping (round, lanes, gates, decisions) starts over, except for what the
 * damaged record still gave: `keep` carries any readable arrays. The status is `done` when nothing is left.
 */
export function rebuildFromTasks(
  input: FlowInput,
  run: { run: string; feature: string; limit: number; now?: Date },
  keep: Partial<Pick<RunRecord, "gates" | "lanes" | "approvals" | "escalations">> = {},
): RunRecord {
  const step = determinePhase(input);
  const done = step.kind === "done";
  const lastPhase = Math.max(0, ...input.tasks.map((t) => t.phase));
  return {
    run: run.run,
    feature: run.feature,
    status: done ? "done" : "active",
    phase: step.kind === "phase" ? step.phase : done ? lastPhase : 0,
    stage: step.kind === "phase" ? step.stage : "working",
    round: 0,
    limit: run.limit,
    needsDecision: false,
    gates: keep.gates ?? [],
    lanes: keep.lanes ?? [],
    approvals: keep.approvals ?? [],
    escalations: keep.escalations ?? [],
    createdAt: (run.now ?? new Date()).toISOString(),
  };
}

// --- US-2: caps (FR-027) -------------------------------------------------------

export interface Slots {
  /** Lanes counted as running. */
  running: number;
  /** Assistants that may still be started under the total cap. */
  free: number;
  /** Per assistant type: running now and how many more may start under the per-type cap. */
  perType: Record<string, { running: number; free: number }>;
}

/**
 * Free slots under `fleet.concurrency`. `running` is the assistant of every lane that is neither done nor paused,
 * one entry per lane. This is only arithmetic over the caps: which lanes are stalled is `laneStatus`'s call.
 */
export function freeSlots(running: string[], caps: { total: number; perType: number }): Slots {
  const perType: Slots["perType"] = {};
  for (const a of running) {
    const entry = perType[a] ?? { running: 0, free: caps.perType };
    entry.running += 1;
    entry.free = Math.max(0, caps.perType - entry.running);
    perType[a] = entry;
  }
  return { running: running.length, free: Math.max(0, caps.total - running.length), perType };
}

// --- US-7: overlap decisions (FR-019) -------------------------------------------

export interface OverlapDecision {
  mode: LaneOverlap["mode"];
  /** The overlapping lanes (short or full names). */
  lanes: string[];
  /** The shared paths a squad writes; every one needs a writer. Ignored for `serialized`. */
  shared?: string[];
  /** Squad: path to the lane that is its one writer. */
  writers?: Record<string, string>;
  /** The fixed order: serialized lanes run in it, squad branches merge in it. Must name every lane once. */
  mergeOrder: string[];
}

export type OverlapResult = { ok: true; lanes: RunLane[] } | { ok: false; error: string };

/**
 * Record the lead's overlap choice on the run's `lanes[]` (025's `overlap` record) before work starts: serialize,
 * or a squad with one writer per shared file and a fixed merge order. Pure: returns the new lane list; the caller
 * writes it through 025's `updateRun`. Every named lane must already be in the run.
 */
export function recordOverlap(lanes: RunLane[], decision: OverlapDecision): OverlapResult {
  const key = (name: string): string => {
    const short = shortLane(name);
    return short.startsWith("lane-") ? short : `lane-${short}`;
  };
  const involved = decision.lanes.map(key);
  if (involved.length < 2) return { ok: false, error: "an overlap involves at least two lanes" };
  if (new Set(involved).size !== involved.length) return { ok: false, error: "a lane is named twice" };
  const known = new Set(lanes.map((l) => key(l.lane)));
  const unknown = involved.filter((l) => !known.has(l));
  if (unknown.length) return { ok: false, error: `not lanes of this run: ${unknown.join(", ")}` };

  const order = decision.mergeOrder.map(key);
  if (order.length !== involved.length || !involved.every((l) => order.includes(l)) || new Set(order).size !== order.length) {
    return { ok: false, error: `the order must name each of ${involved.join(", ")} exactly once` };
  }

  let writers: Record<string, string> | undefined;
  if (decision.mode === "squad") {
    const shared = decision.shared ?? [];
    if (shared.length === 0) return { ok: false, error: "a squad needs the shared paths it writes" };
    writers = {};
    for (const path of shared) {
      const w = decision.writers?.[path];
      if (!w) return { ok: false, error: `no writer for ${path}: a squad has one writer per file` };
      if (!involved.includes(key(w))) return { ok: false, error: `the writer of ${path} (${w}) is not in the squad` };
      writers[path] = key(w);
    }
  }

  const next = lanes.map((l) => {
    const me = key(l.lane);
    if (!involved.includes(me)) return l;
    const overlap: LaneOverlap = {
      mode: decision.mode,
      with: involved.filter((x) => x !== me),
      ...(writers ? { writers } : {}),
      mergeOrder: order,
    };
    return { ...l, overlap };
  });
  return { ok: true, lanes: next };
}
