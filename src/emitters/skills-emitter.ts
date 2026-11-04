import { join } from "node:path/posix";
import type { CommandSpec } from "../core/types.js";
import { BaseEmitter } from "./base-emitter.js";

/** Skill id: lowercase-hyphen, e.g. `amby.specify` → `amby-specify` (dots are not valid in every host). */
export function skillName(spec: CommandSpec): string {
  return spec.name.replace(/\./g, "-").toLowerCase();
}

/** `<dir>/<skill name>/SKILL.md` — the skills layout shared by Codex, Copilot CLI and Kiro. */
export function skillPath(dir: string, spec: CommandSpec): string {
  return join(dir, skillName(spec), "SKILL.md");
}

/** Documented skill frontmatter: just `name` and `description`. */
export function skillFrontmatter(spec: CommandSpec, quote: (value: string) => string): Array<[string, string]> {
  return [
    ["name", skillName(spec)],
    ["description", quote(spec.description)],
  ];
}

/**
 * Base for hosts whose file-based command surface is **skills** (feature 016): one directory per
 * phase holding `SKILL.md` with `name` + `description`. Skills have no `$ARGUMENTS` substitution, so
 * the token becomes an instruction. A target that must inherit from another emitter (Copilot CLI)
 * reuses the exported helpers instead of this class.
 */
export abstract class SkillsEmitter extends BaseEmitter {
  readonly commandSurface = "skills" as const;

  protected override commandFilePath(spec: CommandSpec): string {
    return skillPath(this.commandDir, spec);
  }

  protected override commandFrontmatter(spec: CommandSpec): Array<[string, string]> {
    return skillFrontmatter(spec, (v) => this.yamlQuote(v));
  }

  protected override transformBody(spec: CommandSpec): string {
    return spec.body.replaceAll("$ARGUMENTS", "the user's request that followed this skill invocation");
  }
}
