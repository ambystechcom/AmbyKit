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
  /** Default role id this phase acts as, if any (feature 013). */
  role?: string;
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
  /**
   * Never overwrite an existing file that lacks AmbyKit's generated notice (feature 018, FR-016): a
   * user's own skill with the same name is left alone and reported instead.
   */
  protectForeign?: boolean;
}

/** `"json"` splices one named server entry into a JSON file's top-level object (feature 025); see `merge-json.ts`. */
export type MergeStrategy = "overwrite" | "region" | "json";

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

/** A role definition from `.amby/roles/<id>.md` (feature 013). */
export interface Role {
  id: string;
  name: string;
  /** Phases this role owns by default (informational; the binding lives on the CommandSpec). */
  phases: string[];
  /** Markdown body — mission, focus checklist, hand-off. */
  body: string;
  words: number;
  /** Project-relative source path, for messages. */
  source: string;
}

/** Context an emitter needs to render rules/config for a project. */
export interface RulesContext {
  /** Human project name. */
  projectName: string;
  /** The command specs being emitted (for a workflow summary in the rules file). */
  specs: CommandSpec[];
  /** Whether the emitter should also emit the shared rules file(s). */
  manageRules: boolean;
  /** Roles installed in the project; empty/absent means phases run without a role (feature 013). */
  roles?: Role[];
  /** The write-capable fleet worker persona (feature 019); emitted only by targets with a verified agent format. */
  worker?: { id: string; name: string; description: string; body: string };
  /** `fleet.workerModel` from the project config; applied only where the target documents a `model` key. */
  workerModel?: string;
}

/** Persisted project configuration at .amby/config.json. */
export interface AmbyConfig {
  version: string;
  /** Enabled target ids (see emitter registry). */
  tools: string[];
  /** When false, `sync` regenerates commands only, not AGENTS.md/CLAUDE.md. Default true. */
  manageRules?: boolean;
  /** When true, `/amby.specify` creates a `.worktrees/<feature>` worktree for each new feature (feature 012). */
  worktrees?: boolean;
  /** Dashboard tuning (feature 017): agent-presence thresholds in minutes. */
  dashboard?: { activeMinutes?: number; idleMinutes?: number };
  /** Requirement traceability (feature 024): where to look for tests, and extra directory names to skip. */
  trace?: { roots?: string[]; ignore?: string[] };
  /** MCP server setup (feature 025): opt-in; `sync` writes each verified target's MCP config only when enabled. */
  mcp?: { enabled: boolean };
  /** Fleet settings (features 019, 025, 028): one object for the whole family; defaults in `fleetSettings`. */
  fleet?: FleetConfig;
}

/** Every key optional; `fleetSettings` fills the defaults. 025 owns the schema, 028 extends it. */
export interface FleetConfig {
  /** Minutes without a report or a `tasks.md` change before a working lane counts as stalled. Default 15. */
  stallMinutes?: number;
  /** Automatic restarts of a stalled lane before it pauses. Default 2. */
  restartLimit?: number;
  concurrency?: { total?: number; perType?: number };
  /** Review rounds before a person must decide. Default 3. */
  roundLimit?: number;
  /** Seconds between supervisor ticks. Default 30. */
  tickSeconds?: number;
  /** Per-run limits, keyed by name (028 defines the keys). */
  budgets?: Record<string, number>;
  /** Model a worker runs with, when the host lets the run choose. */
  workerModel?: string;
}

/** How a tool materializes phase prompts. */
export type CommandSurface = "commands" | "skills" | "workflows" | "none";
