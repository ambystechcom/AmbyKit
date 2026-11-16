import { z } from "zod";
import { LANE_STATES } from "../../core/activity.js";
import { featureDirOf } from "../../core/tasks-edit.js";
import { claimFiles } from "../../core/fleet/claims.js";
import { postNote } from "../../core/fleet/notes.js";
import { resolveRun } from "../../core/fleet/runs.js";
import { reportActivity } from "../../core/report.js";
import type { ToolContext, ToolRegistry } from "../registry.js";
import { feature, lane, rootOf, run } from "./common.js";

/**
 * Fleet tools (feature 025): reporting, claims and notes. The protocol wording below is the same text spec
 * 019's worker prompt carries, and a test pins it, so the two cannot drift (FR-013, FR-020).
 */

/** FR-013: when a worker reports. */
export const REPORT_CADENCE =
  "Report at the start of a task, at the end of a task, and whenever you are blocked or waiting. Never report on a timer and never report progress.";

/** FR-020: what a worker does with a directive. */
export const DIRECTIVE_PROTOCOL =
  "The reply carries a directive: continue, pause or stop. On pause or stop, finish the task you are on, then obey it at your next report: do not start another task.";

export function registerFleetTools(registry: ToolRegistry): void {
  registry.register({
    name: "report_activity",
    description: `Tell AmbyKit what you are doing so the dashboard and the fleet lead can see it. ${REPORT_CADENCE} ${DIRECTIVE_PROTOCOL} It never fails: a problem comes back as a warning.`,
    input: z
      .object({
        feature,
        agent: z.string().min(1).describe("Your tool id, e.g. claude or codex"),
        phase: z.string().min(1).describe("Workflow phase, e.g. implement"),
        state: z.enum(LANE_STATES).describe("working, waiting, blocked, paused or done"),
        task: z.string().min(1).optional().describe("Task id you are on, e.g. T012"),
        lane,
        run,
      })
      .strict(),
    handler: (args, ctx) => {
      const r = rootOf(ctx);
      if ("error" in r) return { ack: false, directive: "continue", warning: r.error };
      const dir = featureDirOf(r.root, args.feature);
      if (!dir) return { ack: false, directive: "continue", warning: `feature '${args.feature}' not found` };
      return reportActivity(r.root, {
        feature: dir,
        agent: args.agent,
        phase: args.phase,
        state: args.state,
        ...(args.task ? { task: args.task } : {}),
        ...(args.lane ? { lane: args.lane } : {}),
        ...(args.run ? { run: args.run } : {}),
        pid: process.pid,
        fleet: true,
      });
    },
  });

  registry.register({
    name: "claim_file",
    description:
      "Claim the files a task will edit, so another worker does not edit them at the same time. A claim on a path that overlaps another worker's is refused, naming the owner: wait or pick another task. Ticking the task releases its claims.",
    input: z.object({
      feature,
      task: z.string().min(1).describe("Task id, e.g. T012"),
      files: z.array(z.string().min(1)).min(1).describe("Paths the task will edit"),
      worker: z.string().min(1).describe("Who is claiming: your lane or agent name"),
      run,
    }),
    handler: (args, ctx) => {
      const found = runFor(ctx, args.feature, args.run);
      if ("error" in found) return found;
      const out = claimFiles(found.root, found.run, { task: args.task, files: args.files, worker: args.worker });
      if (out.ok) return { claimed: out.claimed };
      return "refused" in out ? { refused: out.refused } : { error: out.error };
    },
  });

  registry.register({
    name: "post_note",
    description:
      "Leave a one-line note for the other workers on the board: the task id, the files it concerns and the text. A note with no task id, or with a newline, is refused.",
    input: z.object({
      feature,
      task: z.string().min(1).describe("Task id, e.g. T012"),
      files: z.array(z.string().min(1)).describe("Files the note is about; may be empty"),
      text: z.string().min(1).describe("One line, no newline"),
      run,
    }),
    handler: (args, ctx) => {
      const found = runFor(ctx, args.feature, args.run);
      if ("error" in found) return found;
      const out = postNote(found.root, found.run, { task: args.task, files: args.files, text: args.text });
      return out.ok ? { posted: out.line } : { error: out.error };
    },
  });
}

/** The project root and the run a claim or note belongs to; an error result when either cannot be found. */
function runFor(ctx: ToolContext, featureRef: string, requested?: string): { root: string; run: string } | { error: string } {
  const r = rootOf(ctx);
  if ("error" in r) return r;
  const dir = featureDirOf(r.root, featureRef);
  if (!dir) return { error: `feature '${featureRef}' not found` };
  const resolved = resolveRun(r.root, dir, requested);
  return resolved.ok ? { root: r.root, run: resolved.run.run } : { error: resolved.warning };
}
