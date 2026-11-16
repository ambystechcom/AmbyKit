import { z } from "zod";
import { analyzeSlice, laneTasks, nextTask, storyStatus } from "../../core/query.js";
import type { ToolRegistry } from "../registry.js";
import { feature, lane, rootOf } from "./common.js";

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
