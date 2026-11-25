import { primaryRoot } from "../core/checkouts.js";
import { laneRefs } from "../core/query.js";
import { assignAssistants } from "../core/run-launch-plan.js";
import { createNextStage } from "./lane.js";
import type { NextStage } from "./run-session.js";

/**
 * Stage preparation for `ambykit run` (the 2.0 dogfood). A run used to cover only the `[P]` lanes prepared before it
 * started, so a feature's sequential tasks never ran. Now, whenever every lane has merged, the supervisor asks for the
 * next stage: `createNextStage` (the same code as `ambykit lane --next`) plans it from the feature branch's merged
 * `tasks.md` and creates its worktrees; the lanes are spread over the run's assistants round-robin.
 */
export function stagePreparer(root: string, feature: string, opts: { lanes: number; assistants: readonly string[] }): (merged?: ReadonlySet<string>) => NextStage {
  return (merged) => {
    const home = primaryRoot(root);
    let out: ReturnType<typeof createNextStage>;
    try {
      out = createNextStage(home, feature, { lanes: opts.lanes, ...(merged ? { done: merged } : {}) });
    } catch (err) {
      return { kind: "failed", reason: (err as Error).message.split("\n")[0] ?? "the next stage could not be prepared" };
    }
    if (!out.ok) return { kind: "failed", reason: out.error };
    if (out.status === "done") return { kind: "none" };
    const names = new Set(out.lanes.map((l) => l.name));
    const refs = laneRefs(home, feature)
      .filter((r) => names.has(r.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const assistants = opts.assistants.length > 0 ? [...opts.assistants] : ["claude"];
    const assign = assignAssistants(refs.map((r) => r.short), assistants);
    return { kind: "planned", phase: out.phase, stage: out.kind, lanes: refs.map((ref) => ({ ref, assistant: assign.get(ref.short) ?? assistants[0]! })) };
  };
}
