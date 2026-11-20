import { gapPoints } from "./gap.js";
import type { ModelledHistory } from "./model.js";
import type { PhaseCycle } from "./types.js";

/**
 * Cycle time per phase (feature 032, FR-007): the elapsed time from the first commit touching a phase's artifact to
 * the first commit that sets it to its completed state, from git history alone.
 *
 * - spec: first spec.md commit → first revision with status `ready` (or later: `in-progress`, `done`).
 * - plan: first plan.md commit → the first tasks.md commit (a plan is done when it has been broken into tasks).
 * - tasks: first tasks.md commit → first revision with every ordinary task checked.
 * - converge: the first converge run (gap tasks appended) → first revision with every gap task checked.
 *
 * A phase still in progress yields a cycle with no end, and rewritten history only yields fewer points.
 */
const SPEC_DONE = new Set(["ready", "in-progress", "done"]);

const cycle = (feature: string, phase: PhaseCycle["phase"], start: number, end: number | null): PhaseCycle => ({
  feature,
  phase,
  startedAt: start * 1000,
  completedAt: end === null ? null : end * 1000,
  ms: end === null ? null : Math.max(0, (end - start) * 1000),
});

export function phaseCycles(h: ModelledHistory): PhaseCycle[] {
  const out: PhaseCycle[] = [];
  const f = h.feature;

  const specStart = h.spec[0];
  if (specStart) out.push(cycle(f, "spec", specStart.time, h.spec.find((r) => SPEC_DONE.has(r.model.status ?? ""))?.time ?? null));

  const planStart = h.plan[0];
  if (planStart) out.push(cycle(f, "plan", planStart.time, h.tasks.find((r) => r.time >= planStart.time)?.time ?? null));

  const tasksStart = h.tasks[0];
  if (tasksStart) {
    const complete = h.tasks.find((r) => {
      const t = r.model.tasks;
      const g = r.model.gap ?? { total: 0, done: 0 };
      return t !== undefined && t.total - g.total > 0 && t.done - g.done === t.total - g.total;
    });
    out.push(cycle(f, "tasks", tasksStart.time, complete?.time ?? null));
  }

  const first = gapPoints(h)[0];
  if (first) {
    const startSec = first.time / 1000;
    const closed = h.tasks.find((r) => r.time >= startSec && (r.model.gap?.total ?? 0) > 0 && r.model.gap?.done === r.model.gap?.total);
    out.push(cycle(f, "converge", startSec, closed?.time ?? null));
  }
  return out;
}
