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
  /** File contents. For `merge: "region"` this is the AmbyKit-owned region, not the whole file. */
  contents: string;
  /** Where the path is rooted. */
  scope: FileScope;
  /**
   * How the writer reconciles `contents` with any existing file. Default `"overwrite"` (generated
   * files AmbyKit fully owns, e.g. `amby.*` commands). `"region"` splices `contents` into the
   * AmbyKit-owned region of an existing file, preserving everything else (feature 008 / FR-001..004).
   */
  merge?: MergeStrategy;
  /**
   * A line that must be present at the top of the file even when merging (e.g. Claude's `@AGENTS.md`
   * bridge import). Ensured on both create and merge; never duplicated (FR-011).
   */
  requiredPrefix?: string;
}

export type MergeStrategy = "overwrite" | "region";

export type FileScope = "project" | "user";

/** The AmbyKit-owned span located inside a rules file (feature 008; see data-model.md). */
export interface RulesRegion {
  /** 0-based index of the `### AmbyKit usage` heading line. */
  startLine: number;
  /** 0-based index of the first line after the region (next same/higher heading, or EOF). */
  endLine: number;
  /** Raw text between the bounds (heading through last region line). */
  body: string;
  /** Fingerprint parsed from the region footer, or null if absent. */
  fingerprint: string | null;
}

/** Signals that classify a project as brownfield (feature 008 / FR-008). */
export interface ProjectSignals {
  /** A supported rules file (AGENTS.md, CLAUDE.md, …) already exists. */
  rulesFile: boolean;
  /** Non-AmbyKit source files are present. */
  sourceFiles: boolean;
  /** A VCS history with at least one commit exists. */
  gitHistory: boolean;
}

/** Whether a project is greenfield or brownfield, and why (FR-008). */
export interface ProjectClassification {
  mode: "greenfield" | "brownfield";
  signals: ProjectSignals;
}

/** Result of planning a single region merge (pure; no I/O). See data-model.md transitions. */
export interface MergePlan {
  action: "created" | "updated" | "unchanged" | "skipped" | "aborted";
  /** Merged file text; absent for `unchanged`/`skipped`/`aborted`. */
  contents?: string;
  /** Explanation for `skipped` (hand-edited) or `aborted` (unreadable/malformed). */
  reason?: string;
}

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
