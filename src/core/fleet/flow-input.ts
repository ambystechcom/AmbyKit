import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { parseTasks } from "../dashboard.js";
import { parsePhases } from "../markers.js";
import type { FlowInput } from "./run-flow.js";

/**
 * Read a feature's artifacts into the pure `FlowInput` (feature 019). The only file access of the run-flow
 * family besides 025's store; `run-flow.ts` itself stays pure. `root` is the checkout whose `specs/` is read.
 */
export function readFlowInput(root: string, feature: string): FlowInput {
  const dir = join(root, "specs", feature);
  const specFile = join(dir, "spec.md");
  let specStatus: string | null = null;
  if (existsSync(specFile)) {
    const status = (matter(readFileSync(specFile, "utf8")).data as { status?: unknown }).status;
    specStatus = typeof status === "string" && status.trim() !== "" ? status.trim() : "draft";
  }
  const tasksFile = join(dir, "tasks.md");
  const hasTasks = existsSync(tasksFile);
  const text = hasTasks ? readFileSync(tasksFile, "utf8") : "";
  return {
    feature,
    specStatus,
    hasPlan: existsSync(join(dir, "plan.md")),
    hasTasks,
    tasks: parseTasks(text).map((t) => ({ id: t.id, done: t.done, phase: t.phase, ...(t.blocked !== undefined ? { blocked: t.blocked } : {}) })),
    phases: parsePhases(text).map((p) => ({
      phase: p.phase,
      title: p.title,
      ...(p.check !== undefined ? { check: p.check } : {}),
      ...(p.result ? { result: p.result } : {}),
    })),
  };
}
