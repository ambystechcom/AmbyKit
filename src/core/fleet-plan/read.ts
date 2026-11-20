import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readFeatures } from "../features.js";
import { buildGraph } from "../graph.js";
import { laneRefs } from "../query.js";
import { readSpec } from "../spec-format/dispatch.js";
import type { FeatureSnapshot } from "../overview-types.js";
import type { DepEdge, FeatureModel } from "./types.js";

/**
 * The one adapter between the fleet planner and the structured spec data (feature 031, FR-020, FR-022). It reads
 * features through spec 030's per-file reader (`readFeatures` -> `readSpec`/`readTasks`, 1.x and 2.x alike) and the
 * dependencies through spec 023's graph (feature-level `depends-on` and story edges). Nothing in `fleet-plan/`
 * parses markdown or YAML itself (a test scans the sources for it), so a migration needs no change here.
 */

export interface FleetInput {
  models: FeatureModel[];
  deps: DepEdge[];
  /** Features that are done: status `done`, or tasks all checked. */
  done: Set<string>;
}

const specStatus = (root: string, dir: string): string => {
  const file = join(root, "specs", dir, "spec.md");
  if (!existsSync(file)) return "";
  return readSpec(dir, readFileSync(file, "utf8"), { file: `specs/${dir}/spec.md` }).meta.status ?? "";
};

/** A snapshot as the planner sees it. Exported so tests can model features without files. */
export function toModel(root: string, f: FeatureSnapshot, status = specStatus(root, f.dir)): FeatureModel {
  return {
    dir: f.dir,
    ref: f.ref,
    status,
    tasks: f.tasks ?? [],
    artifacts: { spec: f.artifacts.spec, plan: f.artifacts.plan, tasks: f.artifacts.tasks },
    lanes: laneRefs(root, f.dir).length,
  };
}

export function isDone(m: Pick<FeatureModel, "status" | "tasks">): boolean {
  return m.status === "done" || (m.tasks.length > 0 && m.tasks.every((t) => t.done));
}

/** Every feature of the project as a model, the dependency edges among them, and which are done. */
export function readFleetInput(root: string): FleetInput {
  const { features } = readFeatures(root);
  const graph = buildGraph(features);
  const models = features.map((f) => toModel(root, f));
  const deps: DepEdge[] = graph.featureEdges.map((e) => ({ feature: e.from, on: e.to, why: e.declared ? "depends-on" : "story-edge" }));
  return { models, deps, done: new Set(models.filter(isDone).map((m) => m.dir)) };
}
