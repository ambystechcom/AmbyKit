import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalStoryId, featureRefOf } from "./dashboard.js";
import { readSpec, readTasks } from "./spec-format/dispatch.js";
import { releaseTaskClaims } from "./fleet/claims.js";
import { withLock, writeFileAtomic } from "./fleet/lock.js";
import { featureIds } from "./worktree.js";

/**
 * Validated one-line edits to `tasks.md` and `spec.md` (feature 025, US-2). Each edit reads the file under
 * a per-file lock, changes exactly one line in place, re-parses the result with the same parsers every
 * other tool uses, and only then writes it atomically — so no call can leave a file existing tooling cannot
 * read (SC-002), and writers in one checkout never lose each other's lines (FR-005). Across lane worktrees
 * the existing check-off merge unions the ticks.
 */

export const STORY_STATUSES = ["draft", "ready", "in-progress", "blocked", "done"] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

export type EditResult<T> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** The feature directory for a number (`025`) or name, among this checkout's `specs/`. */
export function featureDirOf(root: string, ref: string): string | null {
  const ids = featureIds(root);
  return ids.find((id) => id === ref) ?? ids.find((id) => featureRefOf(id) === ref) ?? null;
}

/** Keep the file's line endings: split on `\n`, remember whether it was CRLF. */
function lines(text: string): { rows: string[]; eol: string } {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return { rows: text.split(/\r?\n/), eol };
}

export interface TickResult {
  ticked: string;
  feature: string;
}

/**
 * Check off one task: flips `[ ]` to `[x]` on that task's line and nothing else. Unknown and already-checked
 * tasks are refused (FR-003). Once the write has landed, the task's file claims are released in the feature's
 * unfinished runs (FR-015); that never fails the tick.
 */
export function tickTask(root: string, featureRef: string, taskId: string): EditResult<TickResult> {
  const feature = featureDirOf(root, featureRef);
  if (!feature) return fail(`feature '${featureRef}' not found`);
  const file = join(root, "specs", feature, "tasks.md");
  if (!existsSync(file)) return fail(`${feature} has no tasks.md`);
  const id = taskId.trim().toUpperCase();

  const locked = withLock(root, `tasks-${feature}`, (): EditResult<TickResult> => {
    const text = readFileSync(file, "utf8");
    const before = readTasks(text).tasks;
    const target = before.find((t) => t.id === id);
    if (!target) return fail(`task '${taskId}' not found in ${feature}${before.length ? `; it has ${before[0]!.id}..${before[before.length - 1]!.id}` : ""}`);
    if (target.done) return fail(`task ${id} is already checked`);

    const { rows, eol } = lines(text);
    const re = new RegExp(`^(\\s*-\\s*\\[)[ ](\\]\\s*\\[${id}\\])`);
    const at = rows.findIndex((r) => re.test(r));
    if (at < 0) return fail(`task ${id} has no editable checkbox line`);
    rows[at] = rows[at]!.replace(re, "$1x$2");
    const next = rows.join(eol);

    // Re-parse: the target is now checked and every other task reads exactly as before (SC-002).
    const after = readTasks(next).tasks;
    const same =
      after.length === before.length &&
      after.every((t, i) => (t.id === id ? t.done && JSON.stringify({ ...t, done: false }) === JSON.stringify(before[i]) : JSON.stringify(t) === JSON.stringify(before[i])));
    if (!same) return fail(`refused: ticking ${id} would change how ${feature}/tasks.md parses`);

    writeFileAtomic(file, next);
    releaseTaskClaims(root, feature, id);
    return { ok: true, ticked: id, feature };
  });
  return locked.ok ? locked.value : fail(locked.warning);
}

export interface StatusResult {
  story: string;
  status: StoryStatus;
  feature: string;
}

/** Set one story's `**status:**`; only that story's status value changes (FR-004). */
export function setStoryStatus(root: string, featureRef: string, storyRef: string, status: string): EditResult<StatusResult> {
  if (!(STORY_STATUSES as readonly string[]).includes(status)) {
    return fail(`invalid status '${status}'; allowed: ${STORY_STATUSES.join(", ")}`);
  }
  const feature = featureDirOf(root, featureRef);
  if (!feature) return fail(`feature '${featureRef}' not found`);
  const file = join(root, "specs", feature, "spec.md");
  if (!existsSync(file)) return fail(`${feature} has no spec.md`);
  const wanted = canonicalStoryId(storyRef.includes(":") ? storyRef.slice(storyRef.lastIndexOf(":") + 1) : storyRef);

  const locked = withLock(root, `spec-${feature}`, (): EditResult<StatusResult> => {
    const text = readFileSync(file, "utf8");
    const before = readSpec(feature, text).stories;
    const target = before.find((s) => s.id === wanted);
    if (!target) return fail(`story '${storyRef}' not found in ${feature}${before.length ? `; stories: ${before.map((s) => s.displayId).join(", ")}` : ""}`);

    const { rows, eol } = lines(text);
    const heading = /^#{2,4}\s+(US-?\d+)\s*[—–-]\s*/;
    let start = -1;
    for (let i = 0; i < rows.length; i++) {
      const m = heading.exec(rows[i]!);
      if (m && canonicalStoryId(m[1]!) === wanted) {
        start = i;
        break;
      }
    }
    let at = -1;
    for (let i = start + 1; i < rows.length && !/^#{2,4}\s/.test(rows[i]!); i++) {
      if (/\*\*status:\*\*\s*[a-z-]+/i.test(rows[i]!)) {
        at = i;
        break;
      }
    }
    if (start < 0 || at < 0) return fail(`story ${target.displayId} has no **status:** line to change`);
    rows[at] = rows[at]!.replace(/(\*\*status:\*\*\s*)[a-z-]+/i, `$1${status}`);
    const next = rows.join(eol);

    const after = readSpec(feature, next).stories;
    const same =
      after.length === before.length &&
      after.every((s, i) => (s.id === wanted ? s.status === status && JSON.stringify({ ...s, status: "" }) === JSON.stringify({ ...before[i], status: "" }) : JSON.stringify(s) === JSON.stringify(before[i])));
    if (!same) return fail(`refused: that edit would change how ${feature}/spec.md parses`);

    writeFileAtomic(file, next);
    return { ok: true, story: target.displayId, status: status as StoryStatus, feature };
  });
  return locked.ok ? locked.value : fail(locked.warning);
}
