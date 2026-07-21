import { basename } from "node:path";
import type { AmbyConfig, EmittedFile } from "../core/types.js";
import { loadCommandSpecs } from "../core/command-spec.js";
import { buildAgentsMd } from "../core/rules.js";
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
  const ctx = { projectName, specs, manageRules };

  const files: EmittedFile[] = [];
  if (manageRules) {
    files.push({
      path: "AGENTS.md",
      contents: buildAgentsMd(projectName, specs),
      scope: "project",
      merge: "region", // preserve any user-authored AGENTS.md content (feature 008 / FR-001)
    });
  }
  for (const emitter of emittersForTargets(config.tools)) {
    files.push(...emitter.emit(specs, ctx));
  }
  return files;
}
