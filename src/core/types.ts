/** Core domain types shared across the CLI and emitters. */

/** The neutral, tool-agnostic definition of one workflow phase (loaded from src/prompts/*.md). */
export interface CommandSpec {
  /** Short id, e.g. "specify". */
  id: string;
  /** Namespaced command name, e.g. "amby.specify". */
  name: string;
  /** One-line description shown in the tool's command list. */
  description: string;
  /** Hint for the command's argument, e.g. "<feature description>". */
  argumentHint: string;
  /** Workflow phase this command belongs to. */
  phase: string;
  /** Artifacts this phase reads (paths, may include NNN-slug placeholders). */
  reads: string[];
  /** Artifacts this phase writes. */
  writes: string[];
  /** Abstract tool capabilities the phase needs. */
  allowedTools: AbstractTool[];
  /** The prompt body (Markdown), verbatim minus surrounding whitespace. */
  body: string;
}

/** Tool-agnostic capability names; emitters map these to each tool's concrete tool names. */
export type AbstractTool = "read" | "write" | "edit" | "bash";

/** A file an emitter wants to write, relative to a base directory. */
export interface EmittedFile {
  /** Path relative to the project root (or user home when scope is "user"). */
  path: string;
  /** File contents. */
  contents: string;
  /** Where the path is rooted. */
  scope: FileScope;
}

export type FileScope = "project" | "user";

/** Context an emitter needs to render rules/config for a project. */
export interface RulesContext {
  /** Human project name. */
  projectName: string;
  /** The command specs being emitted (for a workflow summary in the rules file). */
  specs: CommandSpec[];
  /** Whether the emitter should also emit the shared rules file(s). */
  manageRules: boolean;
}

/** Persisted project configuration at .amby/config.json. */
export interface AmbyConfig {
  version: string;
  /** Enabled target ids (see emitter registry). */
  tools: string[];
  /** When false, `sync` regenerates commands only, not AGENTS.md/CLAUDE.md. Default true. */
  manageRules?: boolean;
}

/** How a tool materializes phase prompts. */
export type CommandSurface = "commands" | "skills" | "workflows" | "none";
