import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildEmittedFiles } from "../../src/core/emit.js";
import type { EmittedFile } from "../../src/core/types.js";

/** Two fixed roles so persona files are covered too (feature 013). */
const ROLES: Record<string, string> = {
  "architect.md": "---\nid: architect\nname: Architect\nphases: [plan]\n---\nOwn the HOW.\n",
  "developer.md": "---\nid: developer\nname: Developer\nphases: [implement]\n---\nOwn the code.\n",
};

export interface EmitOptions {
  /** Install the fixed roles under `.amby/roles/` (default false). */
  roles?: boolean;
  /** Emit AGENTS.md and per-tool rules (default true). */
  manageRules?: boolean;
}

/** A throwaway project dir with a stable name (AGENTS.md embeds the project name). */
export function tempProject(opts: EmitOptions = {}): string {
  const root = join(mkdtempSync(join(tmpdir(), "ambykit-emit-")), "demo");
  mkdirSync(join(root, ".amby", "roles"), { recursive: true });
  if (opts.roles) for (const [name, body] of Object.entries(ROLES)) writeFileSync(join(root, ".amby", "roles", name), body);
  return root;
}

/** The files emitted for `tools`, as a path → contents map (insertion order = emit order). */
export function emitFiles(tools: string[], opts: EmitOptions = {}): EmittedFile[] {
  const root = tempProject(opts);
  return buildEmittedFiles(root, { version: "0.0.0", tools, manageRules: opts.manageRules ?? true });
}

/** `emitFiles` as a path → contents record, sorted by path for stable comparison. */
export function emitTarget(tools: string | string[], opts: EmitOptions = {}): Record<string, string> {
  const files = emitFiles(Array.isArray(tools) ? tools : [tools], opts);
  return Object.fromEntries(files.map((f) => [f.path, f.contents]).sort(([a], [b]) => String(a).localeCompare(String(b))));
}
