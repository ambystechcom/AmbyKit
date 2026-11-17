// Dispatcher (T021): detects v1 or v2 PER FILE, reports mixed features, never guesses.
import { readV1, makeModel, dashboard, markers } from "./model.mjs";
import { isV2Spec, readSpecV2, hasV2TaskData, readTasksV2 } from "./read-v2.mjs";

export function detectSpec(text) {
  if (text == null) return "none";
  if (isV2Spec(text)) return "v2";
  return dashboard.parseStories(text, "x").length ? "v1" : "none";
}

export function detectTasks(text) {
  if (text == null) return "none";
  if (hasV2TaskData(text)) return "v2";
  const any = dashboard.parseTasks(text).length > 0 || markers.parsePhases(text).some((p) => p.check !== undefined);
  return any ? "v1" : "none";
}

/** Read one feature's spec.md / tasks.md text (either may be null) into the model. */
export function readFeature(feature, specText, tasksText) {
  const errors = [];
  const warnings = [];
  const fs = detectSpec(specText);
  const ft = detectTasks(tasksText);
  const v1 = readV1(feature, specText, tasksText);
  let { meta, stories, tasks, phases } = v1;
  if (fs === "v2") ({ meta, stories } = readSpecV2(feature, specText, errors, warnings));
  if (ft === "v2") ({ tasks, phases } = readTasksV2(tasksText, errors, warnings));
  const formats = { spec: fs, tasks: ft };
  const used = [fs, ft].filter((x) => x === "v1" || x === "v2");
  const mixed = used.length === 2 && used[0] !== used[1];
  return { model: makeModel(feature, { meta, stories, tasks, phases, formats }), errors, warnings, mixed, formats };
}

export const describeFormats = (r) => `spec.md=${r.formats.spec}, tasks.md=${r.formats.tasks}${r.mixed ? "  (MIXED feature)" : ""}`;
