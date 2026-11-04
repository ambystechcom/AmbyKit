import { basename } from "node:path";
import type { AmbyConfig, EmittedFile } from "./types.js";
import { loadCommandSpecs } from "./command-spec.js";
import { buildAgentsMd } from "./rules.js";
import { loadRoles } from "./roles.js";
import { emittersForTargets } from "../emitters/index.js";

/**
 * Build the full set of files to emit for a project's configured tools. The shared AGENTS.md is
 * added once here; each emitter contributes its own commands and tool-specific rules (e.g. Claude's
 * CLAUDE.md bridge). When `manageRules` is false, only command files are produced.
 */
export function buildEmittedFiles(projectRoot: string, config: AmbyConfig): EmittedFile[] {
  const specs = loadCommandSpecs();
  const manageRules = config.manageRules !== false;
  const projectName = basename(projectRoot);
  const ctx = { projectName, specs, manageRules, roles: loadRoles(projectRoot) };

  const files: EmittedFile[] = [];
  if (manageRules) {
    files.push({
      path: "AGENTS.md",
      contents: buildAgentsMd(projectName, specs),
      scope: "project",
      merge: "region", // preserve any user-authored AGENTS.md content (feature 008 / FR-001)
    });
  }
  // Two targets can write one path (FR-007). Identical bytes are written once. Bytes that differ only
  // in the `--agent=<id>` self-report (Antigravity IDE and CLI share `.agents/workflows/`) keep the
  // long-standing behavior, where the later target in config order wins. Any other difference is a
  // real conflict and fails loudly, naming both tools.
  const owners = new Map<string, { owner: string; index: number }>();
  files.forEach((f, index) => owners.set(f.path, { owner: "rules", index }));
  for (const emitter of emittersForTargets(config.tools)) {
    for (const file of emitter.emit(specs, ctx)) {
      const seen = owners.get(file.path);
      if (!seen) {
        owners.set(file.path, { owner: emitter.toolId, index: files.length });
        files.push(file);
        continue;
      }
      const earlier = files[seen.index]!;
      if (sameOutput(earlier, file)) continue;
      if (sameOutput(earlier, file, [seen.owner, emitter.toolId])) {
        files[seen.index] = file;
        owners.set(file.path, { owner: emitter.toolId, index: seen.index });
        continue;
      }
      throw new Error(
        `Output collision at ${file.path}: '${seen.owner}' and '${emitter.toolId}' emit different contents.`,
      );
    }
  }
  return files;
}

/** Same file, byte for byte; with `ids`, ignoring the `--agent=<id>` self-report of those two tools. */
function sameOutput(a: EmittedFile, b: EmittedFile, ids?: [string, string]): boolean {
  if (a.scope !== b.scope || a.merge !== b.merge || a.requiredPrefix !== b.requiredPrefix) return false;
  if (!ids) return a.contents === b.contents;
  const longestFirst = [...ids].sort((x, y) => y.length - x.length); // `antigravity-cli` before `antigravity`
  const strip = (text: string): string => longestFirst.reduce((t, id) => t.replaceAll(`--agent=${id}`, "--agent=@"), text);
  return strip(a.contents) === strip(b.contents);
}
