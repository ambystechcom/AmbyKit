import { describe, expect, it } from "vitest";
import { REPORT_CADENCE, DIRECTIVE_PROTOCOL } from "../src/mcp/tools/fleet.js";
import { loadWorkerAgent } from "../src/core/subagents.js";
import { buildEmittedFiles } from "../src/core/emit.js";
import { emitFiles, emitTarget, tempProject } from "./helpers/emit-target.js";

const ALL = ["claude", "claude-vscode", "copilot", "copilot-cli", "opencode", "cursor", "cursor-cli", "antigravity", "antigravity-cli", "codex", "gemini", "llxprt", "qwen", "kilo", "augment", "windsurf", "kiro", "pi"];

describe("worker persona emission", () => {
  it("019:FR-004: Claude Code gets a write-capable amby-worker, apart from the read-only roles", () => {
    const files = emitTarget("claude", { roles: true });
    const worker = files[".claude/agents/amby-worker.md"]!;
    expect(worker).toMatch(/^---\nname: amby-worker\n/);
    expect(worker).toMatch(/tools: Read, Write, Edit, Bash, Grep, Glob\n/);
    for (const role of ["amby-architect", "amby-developer"]) expect(files[`.claude/agents/${role}.md`], role).toMatch(/tools: Read, Grep, Glob\n/);
  });

  it("019:FR-006: the seven review personas stay read-only, including security", () => {
    const root = tempProject({ roles: true });
    const files = buildEmittedFiles(root, { version: "0.0.0", tools: ["claude"], manageRules: false });
    const personas = files.filter((f) => f.path.startsWith(".claude/agents/") && f.path !== ".claude/agents/amby-worker.md");
    expect(personas.length).toBeGreaterThan(0);
    for (const f of personas) expect(f.contents, f.path).toMatch(/tools: Read, Grep, Glob\n/);
    expect(files.filter((f) => /worker/.test(f.path)).map((f) => f.path)).toEqual([".claude/agents/amby-worker.md"]);
  });

  it("019:FR-006: the shipped security role is read-only and has no write tool in any emitted persona", () => {
    const files = emitFiles(["claude"]).filter((f) => f.path.includes("amby-security"));
    for (const f of files) expect(f.contents).not.toMatch(/Write|Edit|Bash/);
  });

  it("019:FR-005: workerModel pins the Claude worker's model and nothing else", () => {
    const root = tempProject();
    const files = buildEmittedFiles(root, { version: "0.0.0", tools: ["claude", "opencode", "copilot"], manageRules: false, fleet: { workerModel: "claude-sonnet-5-5" } });
    expect(files.find((f) => f.path === ".claude/agents/amby-worker.md")!.contents).toContain('model: "claude-sonnet-5-5"');
    for (const f of files.filter((f) => /amby-worker/.test(f.path) && !f.path.startsWith(".claude/"))) expect(f.contents, f.path).not.toContain("claude-sonnet-5-5");
    const none = buildEmittedFiles(root, { version: "0.0.0", tools: ["claude"], manageRules: false });
    expect(none.find((f) => f.path === ".claude/agents/amby-worker.md")!.contents).not.toMatch(/^model:/m);
  });

  it("019:FR-025: OpenCode and both Copilot targets emit the same worker from the one neutral source", () => {
    const opencode = emitTarget("opencode")[".opencode/agents/amby-worker.md"]!;
    expect(opencode).toMatch(/^---\ndescription: .*\nmode: subagent\n---/);
    const copilot = emitTarget("copilot")[".github/agents/amby-worker.agent.md"]!;
    expect(copilot).toMatch(/^---\nname: amby-worker\ndescription: /);
    // Copilot CLI inherits the file; only the self-report id differs.
    expect(emitTarget("copilot-cli")[".github/agents/amby-worker.agent.md"]!.replaceAll("--agent=copilot-cli", "--agent=copilot")).toBe(copilot);
    const body = loadWorkerAgent().body.replaceAll("$AGENT", "opencode");
    expect(opencode).toContain(body);
  });

  it("019:FR-022: targets without a verified agent-file format emit no worker file", () => {
    for (const id of ALL.filter((t) => !["claude", "claude-vscode", "copilot", "copilot-cli", "opencode"].includes(t))) {
      const paths = emitFiles([id]).map((f) => f.path);
      expect(paths.filter((p) => /worker/.test(p)), id).toEqual([]);
    }
  });

  it("019:FR-025: the worker self-reports as the tool it is emitted for", () => {
    expect(emitTarget("claude")[".claude/agents/amby-worker.md"]).toContain("--agent=claude");
    expect(emitTarget("opencode")[".opencode/agents/amby-worker.md"]).toContain("--agent=opencode");
    for (const f of emitFiles(ALL)) expect(f.contents, f.path).not.toContain("$AGENT");
  });

  it("025:FR-013, 025:FR-020: the worker carries the reporting cadence and directive protocol verbatim", () => {
    const body = loadWorkerAgent().body;
    expect(body).toContain(REPORT_CADENCE);
    expect(body).toContain(DIRECTIVE_PROTOCOL);
  });

  it("019:FR-007: the worker tells the worker to answer in one line, to claim first and to mark BLOCKED", () => {
    const body = loadWorkerAgent().body;
    expect(body).toMatch(/one line/i);
    expect(body).toContain("ambykit fleet claim");
    expect(body).toContain("⚠ BLOCKED:");
  });
});
