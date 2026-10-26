import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentMatch } from "./agents.js";
import type { Checkout, FeatureSnapshot } from "./overview-types.js";

/**
 * Agent activity markers and presence (feature 017, US-3). An assistant records
 * `<checkout>/.amby/activity/<feature>.<agent>.json` when a phase starts (FR-018); the dashboard turns
 * markers — plus detected processes as a fallback — into an active/idle/stale presence per feature
 * (FR-021/022). Parsing and classification are pure; the read/write helpers are thin fs edges.
 */

export const ACTIVITY_DIR = join(".amby", "activity");

export interface ActivityMarker {
  feature: string;
  agent: string;
  phase: string;
  task?: string;
  at: string; // ISO-8601
  pid?: number;
}

export type PresenceState = "active" | "idle" | "stale";

export interface Presence {
  agent: string;
  source: "reported" | "detected";
  phase?: string;
  task?: string;
  state: PresenceState;
  since: number; // epoch ms, never in the future
  /** Other agents that reported on the same feature, most recent first (spec edge case). */
  others: Presence[];
}

export interface Thresholds {
  activeMinutes: number;
  idleMinutes: number;
}

const ID = /^[a-z0-9][a-z0-9.-]*$/i;

/** Parse one marker file body; anything malformed or partial yields null (spec edge case). */
export function parseMarker(text: string, feature: string): ActivityMarker | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m["agent"] !== "string" || !ID.test(m["agent"])) return null;
  if (typeof m["phase"] !== "string" || typeof m["at"] !== "string" || Number.isNaN(Date.parse(m["at"]))) return null;
  const marker: ActivityMarker = { feature, agent: m["agent"], phase: m["phase"], at: m["at"] };
  if (typeof m["task"] === "string") marker.task = m["task"];
  if (typeof m["pid"] === "number") marker.pid = m["pid"];
  return marker;
}

/** `<feature>.<agent>.json`, the marker file name. */
export function markerFile(feature: string, agent: string): string {
  return `${feature}.${agent}.json`;
}

export function classify(ageMs: number, t: Thresholds): PresenceState {
  if (ageMs < t.activeMinutes * 60_000) return "active";
  if (ageMs < t.idleMinutes * 60_000) return "idle";
  return "stale";
}

/**
 * A feature's presence from its markers: the most recent agent leads, the rest are `others`. The
 * leader's activity time is the newer of its marker and the feature's last task change (FR-021);
 * future timestamps (clock skew) are clamped to `now`.
 */
export function presenceOf(markers: ActivityMarker[], tasksMtime: number | null, now: number, t: Thresholds): Presence | null {
  const timed = markers
    .map((m) => ({ m, at: Math.min(Date.parse(m.at), now) }))
    .sort((a, b) => b.at - a.at);
  if (timed.length === 0) return null;
  const toPresence = ({ m, at }: { m: ActivityMarker; at: number }, since = at): Presence => {
    const p: Presence = { agent: m.agent, source: "reported", phase: m.phase, state: classify(now - since, t), since, others: [] };
    if (m.task) p.task = m.task;
    return p;
  };
  const [lead, ...rest] = timed;
  const since = Math.max(lead!.at, Math.min(tasksMtime ?? 0, now));
  return { ...toPresence(lead!, since), others: rest.map((x) => toPresence(x)) };
}

/** A detected process counts as active right now (FR-022). */
export function detectedPresence(agent: string, now: number): Presence {
  return { agent, source: "detected", state: "active", since: now, others: [] };
}

/** Where an unattributed agent runs: the primary checkout (feature unknown) or nowhere we can tell. */
export interface UnlocatedAgent {
  agent: string;
  where: "main" | "unknown";
}

export interface ProjectPresence {
  byFeature: Map<string, Presence>;
  unlocated: UnlocatedAgent[];
}

/**
 * Combine markers and detections into per-feature presence. A fresh (non-stale) marker wins; a
 * detection fills in only when there is none (FR-022). Detections in the primary checkout cannot be
 * tied to one feature, and unknown-cwd detections never are (FR-023).
 */
export function combinePresence(input: {
  features: FeatureSnapshot[];
  markers: ActivityMarker[];
  tasksMtime: (f: FeatureSnapshot) => number | null;
  matches: AgentMatch[];
  worktreeFeature: (c: Checkout) => string | null;
  now: number;
  thresholds: Thresholds;
}): ProjectPresence {
  const { now, thresholds } = input;
  const byFeature = new Map<string, Presence>();
  for (const f of input.features) {
    const p = presenceOf(input.markers.filter((m) => m.feature === f.dir), input.tasksMtime(f), now, thresholds);
    if (p) byFeature.set(f.dir, p);
  }
  const unlocated: UnlocatedAgent[] = [];
  for (const m of input.matches) {
    const feature = m.checkout && m.checkout.kind === "worktree" ? input.worktreeFeature(m.checkout) : null;
    if (!feature) {
      unlocated.push({ agent: m.agent, where: m.checkout ? "main" : "unknown" });
      continue;
    }
    const current = byFeature.get(feature);
    if (!current || current.state === "stale") {
      const detected = detectedPresence(m.agent, now);
      byFeature.set(feature, current ? { ...detected, others: [current, ...current.others] } : detected);
    }
  }
  return { byFeature, unlocated };
}

// --- fs edges ---

/** Every readable marker in a checkout; unreadable or corrupt files are skipped. */
export function readMarkers(checkoutRoot: string): ActivityMarker[] {
  const dir = join(checkoutRoot, ACTIVITY_DIR);
  if (!existsSync(dir)) return [];
  const out: ActivityMarker[] = [];
  for (const name of readdirSync(dir)) {
    const m = /^(.+)\.([^.]+)\.json$/.exec(name);
    if (!m) continue;
    try {
      const marker = parseMarker(readFileSync(join(dir, name), "utf8"), m[1]!);
      if (marker) out.push(marker);
    } catch {
      /* unreadable: ignore */
    }
  }
  return out;
}

/**
 * Write a marker (FR-018). The activity directory carries its own `.gitignore` (`*`), so markers stay
 * out of version control without touching the project's root `.gitignore` (FR-019, Principle 7).
 */
export function writeMarker(checkoutRoot: string, marker: ActivityMarker): string {
  const dir = join(checkoutRoot, ACTIVITY_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, "# AmbyKit agent activity markers (local only)\n*\n", "utf8");
  const { feature, ...body } = marker;
  const path = join(dir, markerFile(feature, marker.agent));
  writeFileSync(path, JSON.stringify(body) + "\n", "utf8");
  return path;
}

/** Last-modified time of a feature's `tasks.md` in a checkout, or null. */
export function tasksMtime(checkoutRoot: string, dir: string): number | null {
  try {
    return statSync(join(checkoutRoot, "specs", dir, "tasks.md")).mtimeMs;
  } catch {
    return null;
  }
}

/** Thresholds from config (C-1), else the token defaults. */
export function thresholdsFrom(config: { dashboard?: { activeMinutes?: number; idleMinutes?: number } } | null, defaults: Thresholds): Thresholds {
  return {
    activeMinutes: config?.dashboard?.activeMinutes ?? defaults.activeMinutes,
    idleMinutes: config?.dashboard?.idleMinutes ?? defaults.idleMinutes,
  };
}

/** Markers from every checkout plus detected processes, combined per feature (FR-021–FR-023). */
export function readProjectPresence(input: {
  checkouts: { primary: Checkout; worktrees: { feature: string; checkout: Checkout }[] };
  features: FeatureSnapshot[];
  matches: AgentMatch[];
  now: number;
  thresholds: Thresholds;
}): ProjectPresence {
  const { checkouts } = input;
  const roots = [checkouts.primary, ...checkouts.worktrees.map((w) => w.checkout)];
  return combinePresence({
    features: input.features,
    markers: roots.flatMap((c) => readMarkers(c.root)),
    tasksMtime: (f) => tasksMtime(f.checkout?.root ?? checkouts.primary.root, f.dir),
    matches: input.matches,
    worktreeFeature: (c) => checkouts.worktrees.find((w) => w.checkout.root === c.root)?.feature ?? null,
    now: input.now,
    thresholds: input.thresholds,
  });
}
