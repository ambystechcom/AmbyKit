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
  const owners = new Map<string, { owner: string; file: EmittedFile }>();
  for (const f of files) owners.set(f.path, { owner: "rules", file: f });
  for (const emitter of emittersForTargets(config.tools)) {
    for (const file of emitter.emit(specs, ctx)) {
      const seen = owners.get(file.path);
      if (seen) {
        // Two targets writing one path is fine only when the bytes agree (FR-007); it is written once.
        if (!sameOutput(seen.file, file)) {
          throw new Error(
            `Output collision at ${file.path}: '${seen.owner}' and '${emitter.toolId}' emit different contents.`,
          );
        }
        continue;
      }
      owners.set(file.path, { owner: emitter.toolId, file });
      files.push(file);
    }
  }
  return files;
}

function sameOutput(a: EmittedFile, b: EmittedFile): boolean {
  return a.contents === b.contents && a.scope === b.scope && a.merge === b.merge && a.requiredPrefix === b.requiredPrefix;
}
