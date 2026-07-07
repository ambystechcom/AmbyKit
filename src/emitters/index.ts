import type { BaseEmitter } from "./base-emitter.js";
import { ClaudeEmitter } from "./claude.js";

export { BaseEmitter } from "./base-emitter.js";
export { ClaudeEmitter } from "./claude.js";

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

/**
 * Registry of selectable targets → emitters. Several targets can share one emitter (VS Code
 * extensions, CLIs that reuse a sibling's output). M1 ships Claude Code; later milestones add the
 * rest without touching this shape.
 */
export const TARGETS: TargetDef[] = [
  { id: "claude", displayName: "Claude Code (CLI)", emitter: claude },
  { id: "claude-vscode", displayName: "Claude Code (VS Code)", emitter: claude, alias: true },
];

export function getTarget(id: string): TargetDef | undefined {
  return TARGETS.find((t) => t.id === id);
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
