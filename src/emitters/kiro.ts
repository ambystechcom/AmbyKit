import { join } from "node:path/posix";
import { SkillsEmitter } from "./skills-emitter.js";

/**
 * Kiro (IDE and `kiro-cli`) emitter. Commands are skills at `.kiro/skills/<name>/SKILL.md`; `name`
 * must equal the directory and use only lowercase letters, digits and hyphens (so `amby-specify`,
 * never `amby.specify`). `$ARGUMENTS` is substituted by the CLI only, so the shared skills rewording
 * to prose is used. Kiro reads AGENTS.md, so no tool-specific rules file is emitted.
 */
export class KiroEmitter extends SkillsEmitter {
  readonly toolId = "kiro";
  readonly displayName = "Kiro";
  readonly commandDir = join(".kiro", "skills");
}
