import type { DependencyGraph } from "./graph-types.js";
import { blockersOf } from "./graph-paths.js";

/**
 * Which queued lanes start now (feature 028, FR-005). Pure: the total cap and the per-type cap come from
 * `fleet.concurrency`; order is the queue's order, which is stable (phase, then lane index). A lane in `held`
 * waits (an unfinished cross-story dependency, or a gate), and a lane whose assistant is at its per-type cap
 * is skipped without blocking later lanes of another type.
 */
export interface QueuedLane {
  lane: string;
  assistant: string;
}

export function nextToStart(
  queue: QueuedLane[],
  running: QueuedLane[],
  caps: { total: number; perType: number },
  held: ReadonlySet<string> = new Set(),
): QueuedLane[] {
  const perType = new Map<string, number>();
  for (const r of running) perType.set(r.assistant, (perType.get(r.assistant) ?? 0) + 1);
  let total = running.length;
  const start: QueuedLane[] = [];
  for (const q of queue) {
    if (total >= caps.total) break;
    if (held.has(q.lane)) continue;
    const n = perType.get(q.assistant) ?? 0;
    if (n >= caps.perType) continue;
    start.push(q);
    perType.set(q.assistant, n + 1);
    total += 1;
  }
  return start;
}

/**
 * Lanes held because a story they build has an unmet blocker in another feature (spec 023's graph). Within a
 * feature the phase order already sequences work, so only cross-feature blockers hold a lane here.
 */
export function heldByDependencies(
  graph: DependencyGraph,
  feature: string,
  lanes: { lane: string; stories: string[] }[],
): Set<string> {
  const held = new Set<string>();
  for (const l of lanes) {
    for (const story of l.stories) {
      const key = `${feature}:${story}`;
      const crossFeature = blockersOf(graph, key).some((b) => !b.key.startsWith(`${feature}:`));
      if (crossFeature) {
        held.add(l.lane);
        break;
      }
    }
  }
  return held;
}
