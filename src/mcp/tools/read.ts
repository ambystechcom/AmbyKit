import { z } from "zod";
import { laneStatus } from "../../core/fleet/lane-status.js";
import { featureDirOf } from "../../core/tasks-edit.js";
import { analyzeSlice, laneTasks, nextTask, storyStatus } from "../../core/query.js";
import type { ToolRegistry } from "../registry.js";
import { feature, lane, rootOf, run } from "./common.js";

/**
 * Read tools (feature 025, US-1): small answers by stable ID, so an assistant never reads a whole
 * `tasks.md` or spec to learn what is next. All read-only.
 */
export function registerReadTools(registry: ToolRegistry): void {
  registry.register({
    name: "next_task",
    description:
      "The next unchecked task whose story is not blocked and that is not marked BLOCKED: its id, text, file paths and story. Pass lane to limit it to that lane's tasks. Answers { none } when everything is done or blocked.",
    input: z.object({ feature, lane }),
    handler: (args, ctx) => {
      const r = rootOf(ctx);
      return "error" in r ? r : nextTask(r.root, args.feature, args.lane);
    },
  });

  registry.register({
    name: "story_status",
    description: "A story's status and priority and its unmet blockers (qualified story ids), from the dependency graph.",
    input: z.object({ feature, story: z.string().min(1).describe("Story id: US-1, US1 or 025:US-1") }),
    handler: (args, ctx) => {
      const r = rootOf(ctx);
      return "error" in r ? r : storyStatus(r.root, args.feature, args.story);
    },
  });

  registry.register({
    name: "lane_tasks",
    description: "A lane's tasks with their checked state (capped at 40; truncated:true when sliced). Without a lane, the feature's tasks.",
    input: z.object({ feature, lane }),
    handler: (args, ctx) => {
      const r = rootOf(ctx);
      return "error" in r ? r : laneTasks(r.root, args.feature, args.lane);
    },
  });

  registry.register({
    name: "lane_status",
    description:
      "A lane's state (working, waiting, blocked, paused, done, or unreported), whether it has stalled (working with no report and no tasks.md change for the fleet's stall limit, 15 minutes by default), and its directive with that directive's status.",
    input: z.object({ feature, lane, run }),
    handler: (args, ctx) => {
      const r = rootOf(ctx);
      if ("error" in r) return r;
      const dir = featureDirOf(r.root, args.feature);
      if (!dir) return { error: `feature '${args.feature}' not found` };
      return laneStatus(r.root, { feature: dir, ...(args.lane ? { lane: args.lane } : {}), ...(args.run ? { run: args.run } : {}) });
    },
  });

  registry.register({
    name: "analyze_report",
    description:
      "The findings of `ambykit analyze`, sliced to one feature when given: dependency issues, blocked and buildable stories, BLOCKED tasks, deviations, Verify issues, lane conflicts. Each list is capped.",
    input: z.object({ feature: feature.optional() }),
    handler: (args, ctx) => {
      const r = rootOf(ctx);
      return "error" in r ? r : analyzeSlice(r.root, args.feature);
    },
  });
}
