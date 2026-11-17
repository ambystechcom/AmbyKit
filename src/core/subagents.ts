import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { agentsDir } from "./paths.js";

/**
 * Per-target subagent support (feature 019, FR-021, FR-022). `confirmed` means a live install was seen running
 * emitted subagents (Principle 4); everything else is `unconfirmed` and `/amby.run` uses the sequential fallback,
 * so a wrong guess cannot break a host. `agentFile` is whether the target has a verified agent-file format the
 * worker persona can be emitted in (`docs/tool-compatibility.md`, Agents row).
 */
export type SubagentStatus = "confirmed" | "unconfirmed";

export interface SubagentSupport {
  status: SubagentStatus;
  /** A verified native agent-file format exists, so `amby-worker` is emitted for this target. */
  agentFile: boolean;
  /** Where the status comes from. */
  source: string;
}

const NONE = "no documented subagent file format; sequential fallback";

export const SUBAGENT_SUPPORT: Record<string, SubagentSupport> = {
  claude: {
    status: "confirmed",
    agentFile: true,
    source: "`.claude/agents/*.md` (docs, feature 013); the emitted `amby-*` agents are spawnable in a live Claude Code session (checked 2026-11-16)",
  },
  "claude-vscode": { status: "confirmed", agentFile: true, source: "same emitter output and agent engine as `claude`" },
  opencode: { status: "unconfirmed", agentFile: true, source: "`.opencode/agents/*.md` documented; no live run of an emitted subagent from a command yet" },
  copilot: { status: "unconfirmed", agentFile: true, source: "`.github/agents/*.agent.md` documented; no live run of an emitted subagent from a prompt yet" },
  "copilot-cli": { status: "unconfirmed", agentFile: true, source: "shares the Copilot agent files; not run live" },
  cursor: { status: "unconfirmed", agentFile: false, source: "modes are UI only (no file); " + NONE },
  "cursor-cli": { status: "unconfirmed", agentFile: false, source: NONE },
  antigravity: { status: "unconfirmed", agentFile: false, source: "agents are SDK only; " + NONE },
  "antigravity-cli": { status: "unconfirmed", agentFile: false, source: NONE },
  codex: { status: "unconfirmed", agentFile: false, source: "skills only; " + NONE },
  gemini: { status: "unconfirmed", agentFile: false, source: NONE },
  llxprt: { status: "unconfirmed", agentFile: false, source: "`/subagent save` only, no file format; " + NONE },
  qwen: { status: "unconfirmed", agentFile: false, source: NONE },
  kilo: { status: "unconfirmed", agentFile: false, source: NONE },
  augment: { status: "unconfirmed", agentFile: false, source: NONE },
  windsurf: { status: "unconfirmed", agentFile: false, source: NONE },
  kiro: { status: "unconfirmed", agentFile: false, source: NONE },
  pi: { status: "unconfirmed", agentFile: false, source: "shares the Codex output; " + NONE },
};

/** True only for a target confirmed on a live install (FR-022). Unknown ids use the fallback. */
export function supportsSubagents(toolId: string): boolean {
  return SUBAGENT_SUPPORT[toolId]?.status === "confirmed";
}

/** True when the target has a verified agent-file format, so the worker persona is emitted. */
export function hasWorkerFormat(toolId: string): boolean {
  return SUBAGENT_SUPPORT[toolId]?.agentFile === true;
}

/** The neutral worker persona (`src/agents/worker.md`), the write-capable counterpart of the review roles. */
export interface WorkerAgent {
  id: string;
  name: string;
  description: string;
  body: string;
}

export function parseWorkerAgent(raw: string, sourceName: string): WorkerAgent {
  const parsed = matter(raw);
  const d = parsed.data as Record<string, unknown>;
  const { id, name, description } = d;
  if (typeof id !== "string" || typeof name !== "string" || typeof description !== "string" || !id || !name || !description) {
    throw new Error(`Invalid agent frontmatter in ${sourceName}: id, name and description are required`);
  }
  return { id, name, description, body: parsed.content.trim() };
}

/** Load the shipped worker persona. */
export function loadWorkerAgent(dir: string = agentsDir()): WorkerAgent {
  const raw = readFileSync(join(dir, "worker.md"), "utf8");
  return parseWorkerAgent(raw, "worker.md");
}
