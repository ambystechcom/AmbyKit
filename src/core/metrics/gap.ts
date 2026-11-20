import type { ModelledHistory } from "./model.js";
import type { GapPoint } from "./types.js";

/**
 * Converge gap rate (feature 032, FR-007): per converge run, the gap tasks it appended divided by the feature's
 * requirement count. A converge run is a tasks.md revision whose gap-task count (task lines closing a requirement)
 * rose above the previous revision's; the rise is the number appended. Heuristic by design (plan R2): it reads only
 * what `/amby.converge` writes, and a history without such commits yields no points rather than a guess.
 */
export function gapPoints(h: ModelledHistory): GapPoint[] {
  const out: GapPoint[] = [];
  let prev = 0;
  for (const rev of h.tasks) {
    const total = rev.model.gap?.total ?? 0;
    if (total > prev) {
      const requirements = requirementsAt(h, rev.time);
      out.push({
        feature: h.feature,
        commit: rev.commit,
        time: rev.time * 1000,
        gapTasks: total - prev,
        requirements,
        rate: requirements > 0 ? (total - prev) / requirements : null,
      });
    }
    prev = total;
  }
  return out;
}

/** The requirement count of the latest spec revision at or before `time` (else the first revision, else 0). */
function requirementsAt(h: ModelledHistory, time: number): number {
  let pick = h.spec[0];
  for (const s of h.spec) if (s.time <= time) pick = s;
  return pick?.model.requirements ?? 0;
}
