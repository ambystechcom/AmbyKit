import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizePath, overlaps } from "../lanes.js";
import { withLock, writeFileAtomic } from "./lock.js";
import { listRuns, runDir } from "./runs.js";
import { UNFINISHED } from "./types.js";

/**
 * File claims (feature 025, US-4): `.amby/fleet/<run>/claims.json`, `{ "<normalized path>": { worker, task,
 * at } }`, in the primary checkout. A claim on a path that overlaps another worker's claim is refused, naming
 * the owner (FR-015); all of a task's claims are released together when the task is ticked. 019's
 * `fleet claim|release` wrap these functions and nothing else writes the file.
 */

export interface Claim {
  worker: string;
  task: string;
  at: string;
}
export type Claims = Record<string, Claim>;

export const TASK_ID = /^T\d+$/;

export function claimsPath(root: string, run: string): string {
  return join(runDir(root, run), "claims.json");
}

/** The run's claims; a missing or unreadable file means none. */
export function readClaims(root: string, run: string): Claims {
  const path = claimsPath(root, run);
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
    const out: Claims = {};
    for (const [file, c] of Object.entries(raw as Record<string, Partial<Claim>>)) {
      if (c && typeof c.worker === "string" && typeof c.task === "string" && typeof c.at === "string") out[file] = { worker: c.worker, task: c.task, at: c.at };
    }
    return out;
  } catch {
    return {};
  }
}

export type ClaimResult =
  | { ok: true; claimed: string[] }
  | { ok: false; refused: { file: string; owner: string; task: string } }
  | { ok: false; error: string };

/**
 * Claim `files` for a task. All or nothing: if any file overlaps a path another worker holds, nothing is
 * claimed and the refusal names that file and its owner. The same worker may re-claim (idempotent) and may
 * hold overlapping paths itself.
 */
export function claimFiles(root: string, run: string, input: { task: string; files: string[]; worker: string; now?: Date }): ClaimResult {
  if (!TASK_ID.test(input.task)) return { ok: false, error: `invalid task id '${input.task}'; expected T### (for example T012)` };
  if (input.files.length === 0) return { ok: false, error: "no files to claim" };
  const wanted = [...new Set(input.files.map(normalizePath).filter(Boolean))];
  if (wanted.length === 0) return { ok: false, error: "no usable file paths to claim" };
  const locked = withLock(root, `claims-${run}`, (): ClaimResult => {
    const claims = readClaims(root, run);
    for (const file of wanted) {
      for (const [held, c] of Object.entries(claims)) {
        if (c.worker !== input.worker && overlaps(file, held)) return { ok: false, refused: { file: held === file ? file : `${file} (overlaps ${held})`, owner: c.worker, task: c.task } };
      }
    }
    const at = (input.now ?? new Date()).toISOString();
    for (const file of wanted) claims[file] = { worker: input.worker, task: input.task, at };
    writeFileAtomic(claimsPath(root, run), JSON.stringify(claims, null, 2) + "\n");
    return { ok: true, claimed: wanted };
  });
  return locked.ok ? locked.value : { ok: false, error: locked.warning };
}

/** Release every claim a task holds in one run; returns the paths freed. */
export function releaseClaims(root: string, run: string, task: string): string[] {
  const locked = withLock(root, `claims-${run}`, () => {
    const claims = readClaims(root, run);
    const freed = Object.keys(claims).filter((f) => claims[f]!.task === task);
    if (freed.length === 0) return freed;
    for (const f of freed) delete claims[f];
    writeFileAtomic(claimsPath(root, run), JSON.stringify(claims, null, 2) + "\n");
    return freed;
  });
  return locked.ok ? locked.value : [];
}

/** Release a ticked task's claims in every unfinished run of its feature (FR-015). Never throws. */
export function releaseTaskClaims(root: string, feature: string, task: string): string[] {
  try {
    return listRuns(root, feature)
      .filter((r) => UNFINISHED.includes(r.status))
      .flatMap((r) => releaseClaims(root, r.run, task));
  } catch {
    return [];
  }
}
