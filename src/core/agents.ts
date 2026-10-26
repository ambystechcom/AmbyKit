import { basename } from "node:path";
import type { Checkout } from "./overview-types.js";

/**
 * Agent identities for presence (feature 017). Keyed by the **emit-target id** (`src/emitters/index.ts`
 * `TARGETS`), so self-reported markers and detected processes speak the same ids (FR-024). Pure: the
 * process scan itself lives at the CLI edge. Presentation (glyph, color, name) comes from LIVE_TOKENS.
 *
 * Executable names are the documented ones only (spec C-2, Principle 4). IDE-hosted agents run inside
 * the editor process and cannot be told apart, so they have no matchers — self-report only.
 */

export type AgentFamily = "claude" | "codex" | "opencode" | "copilot" | "cursor" | "antigravity";

export interface AgentDef {
  family: AgentFamily;
  /** Exact, case-sensitive executable basenames (without `.exe`). */
  executables?: string[];
  /** Path fragments of documented npm packages, for node-hosted installs. */
  packages?: string[];
  /** Generic executable names that count only when the full path contains `pathHint`. */
  generic?: { name: string; pathHint: string }[];
}

export const AGENTS: Record<string, AgentDef> = {
  claude: { family: "claude", executables: ["claude"] },
  "claude-vscode": { family: "claude" },
  codex: { family: "codex", executables: ["codex"] },
  opencode: { family: "opencode", executables: ["opencode"], packages: ["opencode-ai"] },
  copilot: { family: "copilot" },
  "copilot-cli": { family: "copilot", executables: ["copilot"], packages: ["@github/copilot"] },
  cursor: { family: "cursor" },
  "cursor-cli": { family: "cursor", executables: ["cursor-agent"], generic: [{ name: "agent", pathHint: "cursor" }] },
  antigravity: { family: "antigravity" },
  "antigravity-cli": { family: "antigravity" },
};

/** One running process, as listed by the platform scanner. */
export interface ProcessInfo {
  pid: number;
  /** Full command line (or at least the executable path). */
  command: string;
  /** Working directory when the platform exposes it cheaply; null otherwise (FR-023). */
  cwd: string | null;
}

/** A detected agent process, attributed to a checkout when its cwd lies inside one. */
export interface AgentMatch {
  agent: string;
  pid: number;
  checkout: Checkout | null;
}

const EXE_SUFFIX = /\.(exe|cmd|bat|js|mjs|cjs)$/i;

/** Executable-ish tokens of a command line: argv[0] and the script a runtime (node, bun) was given. */
function leadingTokens(command: string): string[] {
  const tokens = command.match(/"[^"]+"|\S+/g) ?? [];
  return tokens.slice(0, 2).map((t) => t.replace(/^"|"$/g, ""));
}

/** The target id a process belongs to, or null. Pure; exported for tests. */
export function agentOfProcess(command: string): string | null {
  const tokens = leadingTokens(command);
  const names = tokens.map((t) => basename(t.replace(/\\/g, "/")).replace(EXE_SUFFIX, ""));
  const normalized = command.replace(/\\/g, "/");
  for (const [id, def] of Object.entries(AGENTS)) {
    if (def.executables?.some((e) => names.includes(e))) return id;
    if (def.packages?.some((p) => normalized.includes(`/${p}/`))) return id;
    const first = tokens[0]?.replace(/\\/g, "/").toLowerCase() ?? "";
    if (def.generic?.some((g) => names[0] === g.name && first.includes(g.pathHint))) return id;
  }
  return null;
}

function inside(dir: string, root: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const d = norm(dir);
  const r = norm(root);
  return d === r || d.startsWith(`${r}/`);
}

/**
 * Match processes to agents and attribute each to the **deepest** checkout containing its cwd (a
 * worktree lives inside the primary checkout's `.worktrees/`). One match per (agent, checkout); the
 * scanner's own pid is excluded. Unknown cwd ⇒ `checkout: null` (FR-022/FR-023).
 */
export function matchAgents(procs: ProcessInfo[], checkouts: Checkout[], selfPid = -1): AgentMatch[] {
  const byDepth = [...checkouts].sort((a, b) => b.root.length - a.root.length);
  const out: AgentMatch[] = [];
  const seen = new Set<string>();
  for (const p of procs) {
    if (p.pid === selfPid) continue;
    const agent = agentOfProcess(p.command);
    if (!agent) continue;
    const checkout = p.cwd ? (byDepth.find((c) => inside(p.cwd!, c.root)) ?? null) : null;
    // A cwd outside every checkout is another project: not ours to show.
    if (p.cwd && !checkout) continue;
    const key = `${agent}@${checkout?.root ?? "?"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ agent, pid: p.pid, checkout });
  }
  return out;
}
