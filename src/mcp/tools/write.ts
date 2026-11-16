import { z } from "zod";
import { setStoryStatus, STORY_STATUSES, tickTask } from "../../core/tasks-edit.js";
import type { ToolRegistry } from "../registry.js";
import { feature, rootOf } from "./common.js";

/**
 * Write tools (feature 025, US-2): the one validated path for changing state. Each edits a single line
 * of one file, in the checkout the server runs in, and refuses anything it cannot parse back.
 */
export function registerWriteTools(registry: ToolRegistry): void {
  registry.register({
    name: "tick_task",
    description:
      "Check off one task (changes only that task's checkbox) and release the file claims it held. Refuses unknown or already-checked tasks. Call it when the task is finished.",
    input: z.object({ feature, task: z.string().min(1).describe("Task id, e.g. T012") }),
    handler: (args, ctx) => {
      const r = rootOf(ctx);
      if ("error" in r) return r;
      const out = tickTask(r.root, args.feature, args.task);
      return out.ok ? { ticked: out.ticked } : { error: out.error };
    },
  });

  registry.register({
    name: "set_story_status",
    description: `Set one story's status (${STORY_STATUSES.join(" | ")}). Changes only that story's status line; refuses any other value and lists the allowed ones.`,
    input: z.object({ feature, story: z.string().min(1).describe("Story id: US-1, US1 or 025:US-1"), status: z.string().min(1) }),
    handler: (args, ctx) => {
      const r = rootOf(ctx);
      if ("error" in r) return r;
      const out = setStoryStatus(r.root, args.feature, args.story, args.status);
      return out.ok ? { story: out.story, status: out.status } : { error: out.error };
    },
  });
}
