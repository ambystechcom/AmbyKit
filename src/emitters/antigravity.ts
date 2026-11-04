import { join } from "node:path/posix";
import { SkillsEmitter } from "./skills-emitter.js";

/**
 * Google Antigravity (IDE) emitter. Antigravity retired **workflows** on 2026-10-19 and replaced them
 * with **skills** (feature 018): one directory per phase at `.agents/skills/<name>/SKILL.md` with
 * `name` + `description`, the same layout Codex and Pi write. The CLI turns each skill into a slash
 * command named after the skill (`/amby-specify`). Antigravity reads AGENTS.md natively, so no
 * tool-specific rules file is emitted. There is no file-based agent format (SDK only). The `agy` CLI
 * shares these workspace files (see AntigravityCliEmitter).
 */
export class AntigravityEmitter extends SkillsEmitter {
  readonly toolId: string = "antigravity";
  readonly displayName: string = "Antigravity (IDE)";
  readonly commandDir: string = join(".agents", "skills");
}
