import { compareFeatureDirs } from "../features.js";
import { conflicts, sharedFiles } from "./ownership.js";
import type { DepEdge, Ownership, PlanError, WaitsFor } from "./types.js";

/**
 * The fleet's order (feature 031, FR-004, FR-005, FR-007, FR-008). Pure. A feature waits for what it depends on
 * (feature-level `depends-on` and story edges, spec 023's graph) and, when two features share a file or either's
 * ownership is unknown, for the earlier one of the pair: earlier = dependency order, then feature number. The
 * wait is never added twice, and never creates a cycle (it always points at the earlier feature).
 */

export interface OrderInput {
  /** Features in the fleet, any order. */
  features: { feature: string; ownership: Ownership }[];
  /** Dependency edges of the fleet's features (from the graph); edges to features outside the fleet are checked below. */
  deps: DepEdge[];
  /** Features that are already done (a dependency on one is satisfied without being in the fleet). */
  done?: ReadonlySet<string>;
}

export interface OrderOutput {
  /** Planned start order. */
  order: string[];
  waitsFor: Map<string, WaitsFor[]>;
}

export function orderFleet(input: OrderInput): { ok: true; value: OrderOutput } | { ok: false; errors: PlanError[] } {
  const members = new Set(input.features.map((f) => f.feature));
  const done = input.done ?? new Set<string>();
  const errors: PlanError[] = [];

  const direct = new Map<string, WaitsFor[]>();
  for (const f of members) direct.set(f, []);
  const seen = new Set<string>();
  for (const d of [...input.deps].sort((a, b) => compareFeatureDirs(a.feature, b.feature) || compareFeatureDirs(a.on, b.on))) {
    if (!members.has(d.feature) || d.feature === d.on) continue;
    if (!members.has(d.on)) {
      if (!done.has(d.on)) {
        errors.push({ kind: "missing-dependency", feature: d.feature, on: d.on, message: `${d.feature} depends on ${d.on}, which is not in the fleet and not done. Add it to the fleet or finish it first.` });
      }
      continue;
    }
    const key = `${d.feature}>${d.on}`;
    if (seen.has(key)) continue; // a declared and a derived edge between the same two features count once
    seen.add(key);
    direct.get(d.feature)!.push({ feature: d.on, why: d.why });
  }

  const cycle = findCycle(members, direct);
  if (cycle) errors.push({ kind: "cycle", cycle, message: `Dependency cycle between features: ${cycle.join(" -> ")}.` });
  if (errors.length > 0) return { ok: false, errors };

  // Topological order, ties by feature number (dependency order first, then number).
  const order: string[] = [];
  const placed = new Set<string>();
  const remaining = [...members].sort(compareFeatureDirs);
  while (remaining.length > 0) {
    const i = remaining.findIndex((f) => direct.get(f)!.every((w) => placed.has(w.feature)));
    const next = remaining.splice(i, 1)[0]!;
    order.push(next);
    placed.add(next);
  }

  // Serialize features that share files, or whose ownership is unknown: the later waits for the earlier.
  const owner = new Map(input.features.map((f) => [f.feature, f.ownership]));
  const waitsFor = new Map<string, WaitsFor[]>(order.map((f) => [f, [...direct.get(f)!]]));
  const reach = (from: string): Set<string> => {
    const out = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
      for (const w of waitsFor.get(stack.pop()!) ?? []) if (!out.has(w.feature)) (out.add(w.feature), stack.push(w.feature));
    }
    return out;
  };
  for (let j = 0; j < order.length; j++) {
    for (let i = 0; i < j; i++) {
      const early = order[i]!;
      const late = order[j]!;
      const a = owner.get(early)!;
      const b = owner.get(late)!;
      if (!conflicts(a, b) || reach(late).has(early)) continue;
      const files = sharedFiles(a, b);
      waitsFor.get(late)!.push({ feature: early, why: "shared-files", files });
    }
  }
  return { ok: true, value: { order, waitsFor } };
}

function findCycle(members: Set<string>, edges: Map<string, WaitsFor[]>): string[] | null {
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (f: string): string[] | null => {
    state.set(f, 1);
    stack.push(f);
    for (const w of edges.get(f) ?? []) {
      if (state.get(w.feature) === 1) return [...stack.slice(stack.indexOf(w.feature)), w.feature];
      if (!state.has(w.feature)) {
        const c = visit(w.feature);
        if (c) return c;
      }
    }
    stack.pop();
    state.set(f, 2);
    return null;
  };
  for (const f of [...members].sort(compareFeatureDirs)) {
    if (!state.has(f)) {
      const c = visit(f);
      if (c) return c;
    }
  }
  return null;
}
