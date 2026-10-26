import { describe, expect, it } from "vitest";
import { AGENTS, agentOfProcess, matchAgents, type ProcessInfo } from "../../src/core/agents.js";
import type { Checkout } from "../../src/core/overview-types.js";
import { TARGETS } from "../../src/emitters/index.js";
import { LIVE_TOKENS } from "../../src/cli/ui/dashboard/live-tokens.js";

describe("AGENTS table (feature 017, FR-024)", () => {
  it("covers every emit target id, and every id has badge tokens", () => {
    for (const t of TARGETS) {
      expect(AGENTS[t.id], t.id).toBeDefined();
      expect((LIVE_TOKENS.component.agent as Record<string, unknown>)[t.id], `tokens for ${t.id}`).toBeDefined();
    }
  });
});

describe("agentOfProcess (C-2 executables)", () => {
  it.each([
    ["C:\\Users\\me\\.local\\bin\\claude.exe", "claude"],
    ["/home/me/.local/bin/claude --resume", "claude"],
    ["codex", "codex"],
    ["/usr/local/bin/opencode run", "opencode"],
    ["node /usr/lib/node_modules/opencode-ai/bin/opencode.js", "opencode"],
    ["copilot", "copilot-cli"],
    ['"C:\\Program Files\\nodejs\\node.exe" C:\\npm\\node_modules\\@github\\copilot\\index.js', "copilot-cli"],
    ["/home/me/.local/bin/cursor-agent", "cursor-cli"],
    ["/home/me/.local/share/cursor-agent/versions/1/agent", "cursor-cli"],
  ])("%s → %s", (cmd, id) => {
    expect(agentOfProcess(cmd)).toBe(id);
  });

  it.each([
    ["/usr/bin/agent"], // generic name without a cursor path
    ["C:\\Users\\me\\AppData\\Local\\AnthropicClaude\\Claude.exe"], // desktop app, not the CLI
    ["node /srv/app/claude-helper.js"],
    ["vim notes-about-codex.md"],
  ])("ignores %s", (cmd) => {
    expect(agentOfProcess(cmd)).toBeNull();
  });
});

describe("matchAgents (FR-022/FR-023)", () => {
  const main: Checkout = { root: "/repo", kind: "main" };
  const wt: Checkout = { root: "/repo/.worktrees/017-live", kind: "worktree", branch: "017-live" };
  const proc = (pid: number, command: string, cwd: string | null): ProcessInfo => ({ pid, command, cwd });

  it("attributes to the deepest checkout containing the cwd", () => {
    const m = matchAgents([proc(1, "claude", "/repo/.worktrees/017-live/src"), proc(2, "codex", "/repo")], [main, wt]);
    expect(m).toEqual([
      { agent: "claude", pid: 1, checkout: wt },
      { agent: "codex", pid: 2, checkout: main },
    ]);
  });

  it("unknown cwd ⇒ unlocated; other projects are dropped; self pid excluded; duplicates collapse", () => {
    const m = matchAgents(
      [proc(1, "claude", null), proc(2, "claude", "/elsewhere"), proc(3, "codex", "/repo"), proc(4, "codex", "/repo/x"), proc(9, "claude", "/repo")],
      [main, wt],
      9,
    );
    expect(m).toEqual([
      { agent: "claude", pid: 1, checkout: null },
      { agent: "codex", pid: 3, checkout: main },
    ]);
  });

  it("is case-insensitive on Windows-style paths", () => {
    const w: Checkout = { root: "C:/Repo/.worktrees/017-live", kind: "worktree" };
    expect(matchAgents([proc(1, "claude.exe", "c:\\repo\\.worktrees\\017-live")], [w])[0]?.checkout).toBe(w);
  });
});
