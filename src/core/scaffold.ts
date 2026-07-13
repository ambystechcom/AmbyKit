import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { referenceDir, templatesDir } from "./paths.js";

/** Artifact templates installed into a consumer's `.amby/templates/` (referenced by the prompts). */
export const ARTIFACT_TEMPLATES = [
  "constitution.md",
  "spec.md",
  "ui.md",
  "design-tokens.json",
  "plan.md",
  "tasks.md",
] as const;

/** On-demand reference docs installed into a consumer's `.amby/reference/`. */
export const REFERENCE_DOCS = ["design-conventions.md"] as const;

export interface InstallResult {
  created: string[];
  present: string[]; // already existed — left untouched (project owns its templates)
}

/**
 * Install the artifact templates and reference docs into a project's `.amby/`. Uses
 * write-if-absent semantics: existing files are never overwritten, so a project can customize its
 * templates and `sync`/`upgrade` will only add newly-introduced ones. The prompts reference these by
 * `@.amby/templates/…` / `@.amby/reference/…`, so installing them wires the workflow.
 */
export function installArtifactTemplates(projectRoot: string, dryRun = false): InstallResult {
  const result: InstallResult = { created: [], present: [] };

  const copy = (srcAbs: string, destRel: string) => {
    const destAbs = join(projectRoot, destRel);
    if (existsSync(destAbs)) {
      result.present.push(destRel);
      return;
    }
    if (!dryRun) {
      mkdirSync(dirname(destAbs), { recursive: true });
      writeFileSync(destAbs, readFileSync(srcAbs, "utf8"), "utf8");
    }
    result.created.push(destRel);
  };

  for (const name of ARTIFACT_TEMPLATES) {
    copy(join(templatesDir(), name), posix.join(".amby", "templates", name));
  }
  for (const name of REFERENCE_DOCS) {
    copy(join(referenceDir(), name), posix.join(".amby", "reference", name));
  }
  return result;
}
