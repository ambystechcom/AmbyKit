// The per-file reader dispatcher (030:FR-021, 026:D-9). Every reader of a spec.md or tasks.md goes through here, so
// history readers (burndown blobs, `git show <branch>:…`) see the right format per revision. Format is decided from the
// content of each file, never from the project.
import { parseStories, parseTasks } from "../dashboard.js";
import { parsePhases } from "../markers.js";
import type { FormatIssue, ReadCtx, SpecRead, TasksRead } from "./model.js";
import { readSpecMeta } from "./meta.js";

const fileOf = (ctx: ReadCtx | undefined, fallback: string): string => ctx?.file ?? fallback;

/** Read a spec.md: stories, feature meta, feature-level depends-on and the issues found. */
export function readSpec(feature: string, text: string, ctx?: ReadCtx): SpecRead {
  const issues: FormatIssue[] = [];
  const out: SpecRead = {
    format: 1,
    stories: parseStories(text, feature),
    meta: readSpecMeta(text),
    dependsOn: [],
    issues,
  };
  ctx?.tally?.record(fileOf(ctx, `${feature}/spec.md`), out.format);
  return out;
}

/** Read a tasks.md: task lines, phase Verify data and the issues found. */
export function readTasks(text: string, ctx?: ReadCtx): TasksRead {
  const issues: FormatIssue[] = [];
  const out: TasksRead = { format: 1, tasks: parseTasks(text), phases: parsePhases(text), issues };
  ctx?.tally?.record(fileOf(ctx, "tasks.md"), out.format);
  return out;
}

/** Convenience for callers that only need the phases. */
export function readPhases(text: string, ctx?: ReadCtx): TasksRead["phases"] {
  return readTasks(text, ctx).phases;
}
