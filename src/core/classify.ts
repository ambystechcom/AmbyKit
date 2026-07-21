import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ProjectClassification, ProjectSignals } from "./types.js";

/**
 * Classify a project as greenfield or brownfield (feature 008 / FR-008). A project is brownfield when
 * ANY signal fires — an existing supported rules file, non-AmbyKit source files, or a VCS history with
 * commits — otherwise greenfield. Detection is only informational: the write path is always
 * non-destructive, so an uncertain read still lands on the safe behavior (FR-009).
 */

/** Supported rules files whose presence marks an existing agent-docs setup. */
const RULES_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  join(".github", "copilot-instructions.md"),
  join(".cursor", "rules", "ambykit.mdc"),
];

/** Entries that don't count as "source": AmbyKit's own output, VCS, tool dirs, and common noise. */
const IGNORED_ENTRIES = new Set([
  ".amby",
  ".git",
  ".github",
  ".claude",
  ".cursor",
  ".opencode",
  ".agents",
  "node_modules",
  "dist",
  "build",
  ...RULES_FILES,
]);

function hasRulesFile(root: string): boolean {
  return RULES_FILES.some((rel) => existsSync(join(root, rel)));
}

/** Any tracked-looking file that AmbyKit did not create → treat as an existing codebase. */
function hasSourceFiles(root: string): boolean {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return false;
  }
  return entries.some((name) => {
    if (IGNORED_ENTRIES.has(name)) return false;
    if (name.startsWith(".")) return false; // dotfiles (configs) are not "source"
    return true;
  });
}

/** True when `root` is a git repo with at least one commit. Guarded — never throws (R-4). */
function hasGitHistory(root: string): boolean {
  if (!existsSync(join(root, ".git"))) return false;
  try {
    const res = spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: root,
      stdio: "ignore",
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

export function classifyProject(root: string): ProjectClassification {
  const signals: ProjectSignals = {
    rulesFile: hasRulesFile(root),
    sourceFiles: hasSourceFiles(root),
    gitHistory: hasGitHistory(root),
  };
  const brownfield = signals.rulesFile || signals.sourceFiles || signals.gitHistory;
  return { mode: brownfield ? "brownfield" : "greenfield", signals };
}

/** Human-readable list of the signals that fired, for CLI reporting. */
export function describeSignals(signals: ProjectSignals): string {
  const parts: string[] = [];
  if (signals.rulesFile) parts.push("existing agent docs");
  if (signals.sourceFiles) parts.push("existing source files");
  if (signals.gitHistory) parts.push("git history");
  return parts.join(", ");
}
