import { join } from "node:path/posix";
import { SkillsEmitter } from "./skills-emitter.js";

/**
 * OpenAI Codex CLI emitter. Its file-based command surface is **skills** — a directory per phase at
 * `.agents/skills/<name>/SKILL.md`, discovered from cwd up to the repo root. Documented frontmatter
 * is only `name` + `description`; there is no argument-placeholder convention (the deprecated,
 * user-level custom-prompts mechanism has one, but is out of scope — see spec 008 FR-003/FR-004).
 * Codex reads AGENTS.md natively, so no tool-specific rules file is emitted.
 */
export class CodexEmitter extends SkillsEmitter {
  readonly toolId = "codex";
  readonly displayName = "Codex CLI";
  readonly commandDir = join(".agents", "skills");
}
