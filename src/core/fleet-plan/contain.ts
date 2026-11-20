import type { FleetFeature } from "./types.js";

/**
 * Failure containment (feature 031, FR-009, FR-013). Pure. A paused feature holds every feature that waits for it,
 * directly or through a chain; independent features are untouched. The result is recomputed from the paused set on
 * every tick, so resuming a feature releases its dependents without any extra bookkeeping.
 */

/** Held feature -> the paused feature that holds it (the nearest paused one up its chain, ties by plan order). */
export function heldFeatures(features: readonly FleetFeature[], paused: ReadonlySet<string>): Map<string, string> {
  const byName = new Map(features.map((f) => [f.feature, f]));
  const held = new Map<string, string>();
  const cause = (name: string, seen: Set<string>): string | undefined => {
    if (seen.has(name)) return undefined;
    seen.add(name);
    for (const w of byName.get(name)?.waitsFor ?? []) {
      if (paused.has(w.feature)) return w.feature;
      const up = cause(w.feature, seen);
      if (up) return up;
    }
    return undefined;
  };
  for (const f of features) {
    if (paused.has(f.feature) || f.state === "done" || f.state === "skipped") continue;
    const c = cause(f.feature, new Set());
    if (c) held.set(f.feature, c);
  }
  return held;
}

/** Features affected by a pause: the paused one and everything it holds, for the status view (US-4 last scenario). */
export function affectedBy(features: readonly FleetFeature[], paused: string): string[] {
  const held = heldFeatures(features, new Set([paused]));
  return [paused, ...features.filter((f) => held.get(f.feature) !== undefined).map((f) => f.feature)];
}
