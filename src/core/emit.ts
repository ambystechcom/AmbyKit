import { basename } from "node:path";
import type { AmbyConfig, EmittedFile } from "./types.js";
import { loadCommandSpecs } from "./command-spec.js";
import { buildAgentsMd } from "./rules.js";
import { loadRoles } from "./roles.js";
import { loadWorkerAgent } from "./subagents.js";
import { emittersForTargets, type TargetSource } from "../emitters/index.js";
import type { TargetRegistry } from "../plugins/registry.js";
import { escapesProject } from "./path-guard.js";

/**
 * Build the full set of files to emit for a project's configured tools. The shared AGENTS.md is
 * added once here; each emitter contributes its own commands and tool-specific rules (e.g. Claude's
 * CLAUDE.md bridge). When `manageRules` is false, only command files are produced.
 */
export function buildEmittedFiles(projectRoot: string, config: AmbyConfig, registry?: TargetRegistry): EmittedFile[] {
  const specs = loadCommandSpecs();
  const manageRules = config.manageRules !== false;
  const projectName = basename(projectRoot);
  const worker = loadWorkerAgent();
  const ctx = {
    projectName,
    specs,
    manageRules,
    roles: loadRoles(projectRoot),
    worker,
    ...(config.fleet?.workerModel ? { workerModel: config.fleet.workerModel } : {}),
  };

  const files: EmittedFile[] = [];
  if (manageRules) {
    files.push({
      path: "AGENTS.md",
      contents: buildAgentsMd(projectName, specs),
      scope: "project",
      merge: "region", // preserve any user-authored AGENTS.md content (feature 008 / FR-001)
    });
  }
  // Two targets can write one path (FR-007). Identical bytes are written once. Bytes that differ only
  // in the `--agent=<id>` self-report (Antigravity IDE and CLI share `.agents/workflows/`) keep the
  // long-standing behavior, where the later target in config order wins. Any other difference is a
  // real conflict and fails loudly, naming both tools.
  const owners = new Map<string, { owner: string; index: number }>();
  files.forEach((f, index) => owners.set(f.path, { owner: "rules", index }));
  for (const emitter of emittersForTargets(config.tools, registry)) {
    // MCP setup is opt-in (feature 025): without `mcp.enabled` nothing is asked of the emitter, so output is unchanged.
    const emitted = config.mcp?.enabled && typeof emitter.mcpFiles === "function" ? [...emitter.emit(specs, ctx), ...emitter.mcpFiles(ctx)] : emitter.emit(specs, ctx);
    for (const file of emitted) {
      assertInsideProject(file, emitter.toolId, registry);
      const seen = owners.get(file.path);
      if (!seen) {
        owners.set(file.path, { owner: emitter.toolId, index: files.length });
        files.push(file);
        continue;
      }
      const earlier = files[seen.index]!;
      if (sameOutput(earlier, file)) continue;
      if (sameOutput(earlier, file, [seen.owner, emitter.toolId])) {
        // Only the self-report id differs: keep the higher-ranked tool's file, whatever the config
        // order (feature 018, FR-010). Unranked ids keep the long-standing "later wins".
        if (selfReportRank(emitter.toolId) <= selfReportRank(seen.owner)) {
          files[seen.index] = file;
          owners.set(file.path, { owner: emitter.toolId, index: seen.index });
        }
        continue;
      }
      throw new Error(
        `Output collision at ${file.path}: ${label(seen.owner, registry)} and ${label(emitter.toolId, registry)} emit different contents.`,
      );
    }
  }
  return files;
}

/**
 * Enabled targets that get no MCP config, and why (feature 025, FR-018). Empty unless `mcp.enabled`.
 * `sync` prints these so a missing config is never silent.
 */
export function mcpUnwritten(config: AmbyConfig, registry?: TargetSource): { tool: string; reason: string }[] {
  if (!config.mcp?.enabled) return [];
  const out: { tool: string; reason: string }[] = [];
  for (const emitter of emittersForTargets(config.tools, registry)) {
    const reason = typeof emitter.mcpSkipReason === "function" ? emitter.mcpSkipReason() : "no verified MCP config format (plugin target)";
    if (reason) out.push({ tool: emitter.toolId, reason });
  }
  return out;
}

/**
 * Which tool's `--agent=<id>` a shared file carries when targets differ only in that id (feature 018,
 * FR-010). Earlier = wins. Codex stays byte-identical, and the Antigravity IDE beats its CLI.
 */
export const SELF_REPORT_PRIORITY = ["codex", "antigravity", "antigravity-cli"] as const;

function selfReportRank(toolId: string): number {
  const i = (SELF_REPORT_PRIORITY as readonly string[]).indexOf(toolId);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

/** Same file, byte for byte; with `ids`, ignoring the `--agent=<id>` self-report of those two tools. */
function sameOutput(a: EmittedFile, b: EmittedFile, ids?: [string, string]): boolean {
  if (a.scope !== b.scope || a.merge !== b.merge || a.requiredPrefix !== b.requiredPrefix) return false;
  if (!ids) return a.contents === b.contents;
  const longestFirst = [...ids].sort((x, y) => y.length - x.length); // `antigravity-cli` before `antigravity`
  const strip = (text: string): string => longestFirst.reduce((t, id) => t.replaceAll(`--agent=${id}`, "--agent=@"), text);
  return strip(a.contents) === strip(b.contents);
}

/** `'id'`, or `'id' (plugin name@version)` when a plugin owns the emitter, so a collision or escape is traceable. */
function label(toolId: string, registry?: TargetRegistry): string {
  const plugin = registry?.pluginOfTool(toolId);
  return plugin ? `'${toolId}' (plugin ${plugin.name}@${plugin.version})` : `'${toolId}'`;
}

/**
 * A project-scope file must stay inside the project root (feature 027, FR-007): no absolute path, no drive
 * letter, no `..` segment. User-scope files are rooted at the home directory and need `--include-user`.
 */
export function assertInsideProject(file: EmittedFile, toolId: string, registry?: TargetRegistry): void {
  if (file.scope !== "project") return;
  if (escapesProject(file.path)) {
    throw new Error(`${label(toolId, registry)} tried to write outside the project: ${file.path}. Project-scope paths must be relative and stay inside the project.`);
  }
}
