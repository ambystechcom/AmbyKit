import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { EmittedFile } from "../core/types.js";

export interface WriteResult {
  written: string[];
  unchanged: string[];
  wouldChange: string[];
  skipped: string[]; // user-scope files skipped without consent
}

export interface ApplyOptions {
  dryRun: boolean;
  /** Include user-scope (out-of-tree) files, e.g. ~/.copilot/mcp-config.json. Off by default. */
  includeUser: boolean;
}

/** Write a set of emitted files, reporting what changed. Idempotent: unchanged files are untouched. */
export function applyFiles(
  projectRoot: string,
  files: EmittedFile[],
  opts: ApplyOptions,
): WriteResult {
  const result: WriteResult = { written: [], unchanged: [], wouldChange: [], skipped: [] };
  for (const file of files) {
    if (file.scope === "user" && !opts.includeUser) {
      result.skipped.push(file.path);
      continue;
    }
    const base = file.scope === "user" ? homedir() : projectRoot;
    const abs = join(base, file.path);
    const current = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    if (current === file.contents) {
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
  }
  return result;
}

/** Copy a template file into the project if it does not already exist. Returns true if written. */
export function writeIfAbsent(projectRoot: string, relPath: string, contents: string): boolean {
  const abs = join(projectRoot, relPath);
  if (existsSync(abs)) return false;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, contents, "utf8");
  return true;
}
