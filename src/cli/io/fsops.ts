import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { mergeRegion } from "../../core/merge.js";
import type { EmittedFile } from "../../core/types.js";
import type { ChangeSummary } from "../ui/types.js";

/** Directory (project-relative) that holds pre-modification backups of merged rules files (FR-008c). */
export const BACKUP_DIR = join(".amby", "backups");

export interface WriteResult {
  written: string[]; // created ∪ updated (kept for existing callers)
  created: string[]; // written and did not previously exist
  updated: string[]; // written over an existing, differing file
  unchanged: string[];
  wouldChange: string[];
  skipped: string[]; // user-scope files skipped without consent (needs --include-user)
  skippedRegions: string[]; // a hand-edited AmbyKit region left untouched (FR-008a)
  aborted: string[]; // a region merge that could not proceed safely (FR-007)
  backedUp: string[]; // pre-modification backups written under .amby/backups/ (FR-008c)
}

export interface ApplyOptions {
  dryRun: boolean;
  /** Include user-scope (out-of-tree) files, e.g. ~/.copilot/mcp-config.json. Off by default. */
  includeUser: boolean;
}

/**
 * Compare contents ignoring CRLF/LF differences: git `core.autocrlf` may check generated files out
 * with CRLF on Windows, and that alone must not count as drift (it would make `check`/`sync` churn).
 */
function sameContents(a: string, b: string): boolean {
  return a.replaceAll("\r\n", "\n") === b.replaceAll("\r\n", "\n");
}

/** Write a set of emitted files, reporting what changed. Idempotent: unchanged files are untouched. */
export function applyFiles(
  projectRoot: string,
  files: EmittedFile[],
  opts: ApplyOptions,
): WriteResult {
  const result: WriteResult = {
    written: [],
    created: [],
    updated: [],
    unchanged: [],
    wouldChange: [],
    skipped: [],
    skippedRegions: [],
    aborted: [],
    backedUp: [],
  };
  for (const file of files) {
    if (file.scope === "user" && !opts.includeUser) {
      result.skipped.push(file.path);
      continue;
    }
    const base = file.scope === "user" ? homedir() : projectRoot;
    const abs = join(base, file.path);

    if (file.merge === "region") {
      applyRegionFile(projectRoot, abs, file, opts, result);
      continue;
    }

    const existed = existsSync(abs);
    const current = existed ? readFileSync(abs, "utf8") : null;
    if (current !== null && sameContents(current, file.contents)) {
      result.unchanged.push(file.path);
      continue;
    }
    if (opts.dryRun) {
      result.wouldChange.push(file.path);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, file.contents, "utf8");
    result.written.push(file.path);
    (existed ? result.updated : result.created).push(file.path);
  }
  return result;
}

/**
 * Reconcile a `merge: "region"` file: splice the AmbyKit region into any existing file rather than
 * overwriting it (feature 008). Backs up an existing file before modifying it (FR-008c) and never
 * writes partially — a failed read/parse/write aborts just this file (FR-007).
 */
function applyRegionFile(
  projectRoot: string,
  abs: string,
  file: EmittedFile,
  opts: ApplyOptions,
  result: WriteResult,
): void {
  let existing: string | null;
  try {
    existing = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  } catch {
    result.aborted.push(file.path);
    return;
  }

  const plan = mergeRegion(existing, file.contents, { requiredPrefix: file.requiredPrefix });

  switch (plan.action) {
    case "unchanged":
      result.unchanged.push(file.path);
      return;
    case "skipped": // hand-edited region left untouched (FR-008a)
      result.skippedRegions.push(file.path);
      return;
    case "aborted": // unreadable/malformed — no partial write (FR-007)
      result.aborted.push(file.path);
      return;
    case "created":
    case "updated": {
      if (opts.dryRun) {
        result.wouldChange.push(file.path);
        return;
      }
      try {
        if (plan.action === "updated") {
          const backup = backupFile(projectRoot, abs, file.path);
          if (backup) result.backedUp.push(backup);
        }
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, plan.contents!, "utf8");
      } catch {
        result.aborted.push(file.path);
        return;
      }
      result.written.push(file.path);
      (plan.action === "updated" ? result.updated : result.created).push(file.path);
      return;
    }
  }
}

/** Copy an about-to-be-modified file into `.amby/backups/` with a timestamp. Returns the backup path. */
function backupFile(projectRoot: string, abs: string, relPath: string): string | null {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const flat = relPath.replace(/[\\/]/g, "__");
  const backupRel = join(BACKUP_DIR, `${flat}.${stamp}.bak`);
  const backupAbs = join(projectRoot, backupRel);
  try {
    mkdirSync(dirname(backupAbs), { recursive: true });
    copyFileSync(abs, backupAbs);
    return backupRel;
  } catch {
    return null;
  }
}

/** Project a write result into the change-summary shape the UI layer renders (US-3). */
export function toChangeSummary(r: WriteResult, dryRun: boolean): ChangeSummary {
  return {
    created: r.created,
    updated: r.updated,
    unchanged: r.unchanged,
    skipped: r.skipped,
    wouldChange: r.wouldChange,
    dryRun,
  };
}

/** A pre-modification backup discovered under `.amby/backups/`. */
export interface BackupEntry {
  /** Project-relative path of the file this backup was taken from. */
  original: string;
  /** Project-relative path of the backup file. */
  backup: string;
  /** Timestamp segment (sorts lexicographically = chronologically). */
  stamp: string;
}

const BACKUP_NAME_RE = /^(.*)\.(\d{4}-\d{2}-\d{2}T[0-9-]+Z)\.bak$/;

/** List every backup under `.amby/backups/`, newest first (FR-008c / US-4). */
export function listBackups(projectRoot: string): BackupEntry[] {
  const dir = join(projectRoot, BACKUP_DIR);
  if (!existsSync(dir)) return [];
  const entries: BackupEntry[] = [];
  for (const name of readdirSync(dir)) {
    const m = BACKUP_NAME_RE.exec(name);
    if (!m) continue;
    entries.push({
      original: m[1]!.replace(/__/g, "/"),
      backup: join(BACKUP_DIR, name),
      stamp: m[2]!,
    });
  }
  return entries.sort((a, b) => b.stamp.localeCompare(a.stamp));
}

/**
 * Restore the most recent backup of `originalRel` back to its original path (US-4 / SC-005).
 * Returns the backup that was restored, or null when none exists.
 */
export function restoreLatestBackup(projectRoot: string, originalRel: string): BackupEntry | null {
  const normalized = originalRel.replace(/\\/g, "/");
  const latest = listBackups(projectRoot).find((b) => b.original === normalized);
  if (!latest) return null;
  const src = join(projectRoot, latest.backup);
  const dest = join(projectRoot, originalRel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return latest;
}

/** Copy a template file into the project if it does not already exist. Returns true if written. */
export function writeIfAbsent(projectRoot: string, relPath: string, contents: string): boolean {
  const abs = join(projectRoot, relPath);
  if (existsSync(abs)) return false;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, contents, "utf8");
  return true;
}
