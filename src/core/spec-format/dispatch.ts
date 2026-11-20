// The per-file reader dispatcher (030:FR-021, 026:D-9). Every reader of a spec.md or tasks.md goes through here, so
// history readers (burndown blobs, `git show <branch>:…`) see the right format per revision. Format is decided from the
// content of each file, never from the project.
import { parseStories, parseTasks } from "../dashboard.js";
import { parsePhases } from "../markers.js";
import { packageVersion } from "../paths.js";
import { detectSpecFormat, detectTasksFormat } from "./detect.js";
import { LEGACY_REFUSED_KIND, activeTally, legacyRefusedMessage, refuseLegacy } from "./legacy.js";
import type { Format, FormatIssue, ReadCtx, SpecRead, TasksRead } from "./model.js";
import { readSpecMeta } from "./meta.js";
import { readSpecV2 } from "./read-spec.js";
import { readTasksV2 } from "./read-tasks.js";

let installed: boolean | null = null;

/** Whether this version refuses 1.x files (memoized for the installed version; an injected version is evaluated each time). */
function refusesLegacy(ctx: ReadCtx | undefined): boolean {
  if (ctx?.version !== undefined) return refuseLegacy(ctx.version);
  if (installed === null) installed = refuseLegacy(packageVersion());
  return installed;
}

/** Record the format of a read file, when the caller named it, in the explicit or the running command's tally. */
function tally(ctx: ReadCtx | undefined, format: Format): void {
  if (!ctx?.file) return;
  (ctx.tally ?? activeTally())?.record(ctx.file, format);
}

const refused = (file: string): FormatIssue => ({ file, line: 1, severity: "error", kind: LEGACY_REFUSED_KIND, message: legacyRefusedMessage(file) });

/** Read a spec.md: stories, feature meta, feature-level depends-on and the issues found. */
export function readSpec(feature: string, text: string, ctx?: ReadCtx): SpecRead {
  const detected = detectSpecFormat(text);
  if (detected.format === 2) {
    const v2 = readSpecV2(feature, text, ctx?.file ?? "spec.md", detected.marker);
    tally(ctx, 2);
    return v2;
  }
  tally(ctx, 1);
  if (refusesLegacy(ctx)) return { format: 1, stories: [], meta: {}, dependsOn: [], issues: [refused(ctx?.file ?? "spec.md")] };
  const issues: FormatIssue[] = [];
  return { format: 1, stories: parseStories(text, feature), meta: readSpecMeta(text), dependsOn: [], issues };
}

/** Read a tasks.md: task lines, phase Verify data and the issues found. */
export function readTasks(text: string, ctx?: ReadCtx): TasksRead {
  const detected = detectTasksFormat(text);
  if (detected.format === 2) {
    const v2 = readTasksV2(text, ctx?.file ?? "tasks.md", detected.marker);
    tally(ctx, 2);
    return v2;
  }
  tally(ctx, 1);
  if (refusesLegacy(ctx)) return { format: 1, tasks: [], phases: [], issues: [refused(ctx?.file ?? "tasks.md")] };
  const issues: FormatIssue[] = [];
  return { format: 1, tasks: parseTasks(text), phases: parsePhases(text), issues };
}

/**
 * The 1.x readers, forced: what the shipped parsers return whatever the file contains. `migrate` uses them to compute the
 * "before" model it must reproduce (030:FR-024); nothing else should.
 */
export function readSpecV1(feature: string, text: string): SpecRead["stories"] {
  return parseStories(text, feature);
}
export function readTasksV1(text: string): Pick<TasksRead, "tasks" | "phases"> {
  return { tasks: parseTasks(text), phases: parsePhases(text) };
}

/** Convenience for callers that only need the phases. */
export function readPhases(text: string, ctx?: ReadCtx): TasksRead["phases"] {
  return readTasks(text, ctx).phases;
}
