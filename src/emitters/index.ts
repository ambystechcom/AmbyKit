import type { BaseEmitter } from "./base-emitter.js";
import { ClaudeEmitter } from "./claude.js";
import { CopilotEmitter } from "./copilot.js";
import { CopilotCliEmitter } from "./copilot-cli.js";
import { OpenCodeEmitter } from "./opencode.js";
import { CursorEmitter } from "./cursor.js";
import { CursorCliEmitter } from "./cursor-cli.js";
import { AntigravityEmitter } from "./antigravity.js";
import { AntigravityCliEmitter } from "./antigravity-cli.js";
import { CodexEmitter } from "./codex.js";
import { GeminiEmitter } from "./gemini.js";
import { LlxprtEmitter } from "./llxprt.js";
import { QwenEmitter } from "./qwen.js";
import { KiloEmitter } from "./kilo.js";
import { AugmentEmitter } from "./augment.js";
import { WindsurfEmitter } from "./windsurf.js";
import { KiroEmitter } from "./kiro.js";

export { BaseEmitter } from "./base-emitter.js";
export { ClaudeEmitter } from "./claude.js";
export { CopilotEmitter } from "./copilot.js";
export { CopilotCliEmitter } from "./copilot-cli.js";
export { OpenCodeEmitter } from "./opencode.js";
export { CursorEmitter } from "./cursor.js";
export { CursorCliEmitter } from "./cursor-cli.js";
export { AntigravityEmitter } from "./antigravity.js";
export { AntigravityCliEmitter } from "./antigravity-cli.js";
export { CodexEmitter } from "./codex.js";
export { GeminiEmitter } from "./gemini.js";
export { LlxprtEmitter } from "./llxprt.js";
export { QwenEmitter } from "./qwen.js";
export { KiloEmitter } from "./kilo.js";
export { AugmentEmitter } from "./augment.js";
export { WindsurfEmitter } from "./windsurf.js";
export { KiroEmitter } from "./kiro.js";
export { TomlCommandEmitter } from "./toml-command-emitter.js";
export { SkillsEmitter } from "./skills-emitter.js";

/** A user-selectable target and the emitter it resolves to. */
export interface TargetDef {
  /** Selectable id used on the CLI and in config. */
  id: string;
  displayName: string;
  /** Emitter instance that produces this target's files. */
  emitter: BaseEmitter;
  /** True for targets that reuse another target's emitter output (e.g. VS Code extensions). */
  alias?: boolean;
}

const claude = new ClaudeEmitter();
const copilot = new CopilotEmitter();
const copilotCli = new CopilotCliEmitter();
const opencode = new OpenCodeEmitter();
const cursor = new CursorEmitter();
const cursorCli = new CursorCliEmitter();
const antigravity = new AntigravityEmitter();
const antigravityCli = new AntigravityCliEmitter();
const codex = new CodexEmitter();
const gemini = new GeminiEmitter();
const llxprt = new LlxprtEmitter();
const qwen = new QwenEmitter();
const kilo = new KiloEmitter();
const augment = new AugmentEmitter();
const windsurf = new WindsurfEmitter();
const kiro = new KiroEmitter();

/**
 * Registry of selectable targets → emitters. Several targets can share one emitter (VS Code
 * extensions, CLIs that reuse a sibling's output). Adding a tool is a new emitter + entries here.
 */
export const TARGETS: TargetDef[] = [
  { id: "claude", displayName: "Claude Code (CLI)", emitter: claude },
  { id: "claude-vscode", displayName: "Claude Code (VS Code)", emitter: claude, alias: true },
  { id: "copilot", displayName: "GitHub Copilot (VS Code)", emitter: copilot },
  { id: "copilot-cli", displayName: "GitHub Copilot CLI", emitter: copilotCli },
  { id: "opencode", displayName: "OpenCode", emitter: opencode },
  { id: "cursor", displayName: "Cursor", emitter: cursor },
  { id: "cursor-cli", displayName: "Cursor CLI", emitter: cursorCli },
  { id: "antigravity", displayName: "Antigravity (IDE)", emitter: antigravity },
  { id: "antigravity-cli", displayName: "Antigravity CLI", emitter: antigravityCli },
  { id: "codex", displayName: "Codex CLI", emitter: codex },
  { id: "gemini", displayName: "Gemini CLI", emitter: gemini },
  { id: "llxprt", displayName: "LLxprt Code", emitter: llxprt },
  { id: "qwen", displayName: "Qwen Code", emitter: qwen },
  { id: "kilo", displayName: "Kilo Code", emitter: kilo },
  { id: "augment", displayName: "Augment Code", emitter: augment },
  { id: "windsurf", displayName: "Windsurf", emitter: windsurf },
  { id: "kiro", displayName: "Kiro", emitter: kiro },
  { id: "pi", displayName: "Pi", emitter: codex, alias: true },
];

export function getTarget(id: string): TargetDef | undefined {
  return TARGETS.find((t) => t.id === id);
}

/**
 * Targets that resolve to the same emitter and so share its output files (feature 016, FR-007):
 * one entry per emitter with two or more configured owners, e.g. `pi` + `codex` → `.agents/skills`.
 * Files are written once; removing one owner leaves them for the rest.
 */
export function sharedOutputs(ids: string[]): { dir: string; owners: string[] }[] {
  const byEmitter = new Map<string, { dir: string; owners: string[] }>();
  for (const id of ids) {
    const target = getTarget(id);
    if (!target) continue;
    const entry = byEmitter.get(target.emitter.toolId) ?? { dir: target.emitter.commandDir, owners: [] };
    if (!entry.owners.includes(id)) entry.owners.push(id);
    byEmitter.set(target.emitter.toolId, entry);
  }
  return [...byEmitter.values()].filter((e) => e.owners.length > 1);
}

/** Distinct emitters for a set of target ids (deduped, so shared emitters emit once). */
export function emittersForTargets(ids: string[]): BaseEmitter[] {
  const seen = new Set<string>();
  const out: BaseEmitter[] = [];
  for (const id of ids) {
    const target = getTarget(id);
    if (!target) continue;
    if (seen.has(target.emitter.toolId)) continue;
    seen.add(target.emitter.toolId);
    out.push(target.emitter);
  }
  return out;
}
