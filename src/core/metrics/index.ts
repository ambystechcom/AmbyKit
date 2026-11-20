import { gitAvailable, isRepo } from "../git.js";
import { phaseCycles } from "./cycle.js";
import { gapPoints } from "./gap.js";
import { modelHistory, readRevisionModel, type Reader } from "./model.js";
import { DEFAULT_COMMIT_CAP, readHistories, readHistoriesAsync } from "./revisions.js";
import type { FeatureHistory, GapPoint, MetricPhase, Metrics, PhaseCycle, PhaseSummary } from "./types.js";

export type { GapPoint, MetricPhase, Metrics, PhaseCycle, PhaseSummary } from "./types.js";
export { phaseCycles } from "./cycle.js";
export { gapPoints } from "./gap.js";
export { readRevisionModel } from "./model.js";

/** Fewer completed features than this, or no converge run, is "not enough data" (FR-008). */
export const MIN_FEATURES = 3;

const PHASES: MetricPhase[] = ["spec", "plan", "tasks", "converge"];

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export interface MetricsOptions {
  /** Commit cap for the history walk. */
  cap?: number;
  /** The per-revision reader; defaults to spec 030's per-file reader (T051). */
  read?: Reader;
}

/** Compute metrics from already-read histories (pure given `read`). */
export function computeMetrics(histories: FeatureHistory[], read: Reader = readRevisionModel): Metrics {
  let skipped = 0;
  const cycles: PhaseCycle[] = [];
  const gap: GapPoint[] = [];
  for (const h of histories) {
    const m = modelHistory(h, read);
    skipped += m.skipped;
    cycles.push(...phaseCycles(m));
    gap.push(...gapPoints(m));
  }
  gap.sort((a, b) => a.time - b.time);
  const phases: PhaseSummary[] = PHASES.map((phase) => {
    const perFeature = cycles.filter((c) => c.phase === phase);
    return { phase, perFeature, typicalMs: median(perFeature.flatMap((c) => (c.ms === null ? [] : [c.ms]))) };
  });
  const completedFeatures = new Set(cycles.filter((c) => c.ms !== null).map((c) => c.feature));
  const enough = completedFeatures.size >= MIN_FEATURES && gap.length > 0;
  return enough ? { phases, gap, skipped, enough } : { phases, gap, skipped, enough, reason: "too-little-history" };
}

/** Read git history and compute metrics. Never throws; any failure is "not enough data" (FR-008). */
export function readMetrics(root: string, opts: MetricsOptions = {}): Metrics {
  const empty = (reason: NonNullable<Metrics["reason"]>): Metrics => ({ phases: PHASES.map((phase) => ({ phase, perFeature: [], typicalMs: null })), gap: [], skipped: 0, enough: false, reason });
  if (!gitAvailable()) return empty("git-missing");
  if (!isRepo(root)) return empty("not-a-repo");
  try {
    return computeMetrics(readHistories(root, opts.cap ?? DEFAULT_COMMIT_CAP), opts.read);
  } catch {
    return empty("too-little-history");
  }
}

/** `readMetrics` without blocking the event loop, for the interactive dashboard (US-4: load without blocking the rest). */
export async function readMetricsAsync(root: string, opts: MetricsOptions = {}): Promise<Metrics> {
  const empty = (reason: NonNullable<Metrics["reason"]>): Metrics => ({ phases: PHASES.map((phase) => ({ phase, perFeature: [], typicalMs: null })), gap: [], skipped: 0, enough: false, reason });
  if (!gitAvailable()) return empty("git-missing");
  if (!isRepo(root)) return empty("not-a-repo");
  try {
    return computeMetrics(await readHistoriesAsync(root, opts.cap ?? DEFAULT_COMMIT_CAP), opts.read);
  } catch {
    return empty("too-little-history");
  }
}
