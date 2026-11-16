import { describe, expect, it } from "vitest";
import { REPORT_CADENCE, DIRECTIVE_PROTOCOL } from "../src/mcp/tools/fleet.js";
import { loadCommandSpecs } from "../src/core/command-spec.js";
import { SUBAGENT_SUPPORT } from "../src/core/subagents.js";
import { TARGETS } from "../src/emitters/index.js";
import { emitFiles } from "./helpers/emit-target.js";

const run = loadCommandSpecs().find((s) => s.id === "run")!;

/** The emitted run command of a target: the one file whose contents carry the prompt's first sentence. */
function runFile(target: string): string {
  const files = emitFiles([target]);
  const hit = files.find((f) => /amby[.-]run/.test(f.path));
  if (!hit) throw new Error(`no run command emitted for ${target}: ${files.map((f) => f.path).join(", ")}`);
  return hit.contents;
}

describe("/amby.run prompt", () => {
  it("019:FR-006: the lead has no role of its own, so no role line is ever prepended", () => {
    expect(run.role).toBeUndefined();
    expect(runFile("claude")).not.toContain("say so in your first line");
  });

  it("019:FR-009, 019:FR-011: names QA and the architect by role path, and the Verify gate", () => {
    const text = runFile("claude");
    expect(text).toContain("@.amby/roles/qa.md");
    expect(text).toContain("@.amby/roles/architect.md");
    expect(text).toContain("**Verify:**");
    expect(text).toMatch(/A failing Verify never passes the checkpoint/);
    expect(text).toContain("✓ passed");
    expect(text).toContain("? unverified");
  });

  it("019:FR-023: gives QA the tests.md cases when the feature has them", () => {
    expect(runFile("claude")).toMatch(/tests\.md.*expected tests/s);
  });

  it("019:FR-002: stops before a phase whose artifact is missing or draft, naming it", () => {
    expect(runFile("claude")).toMatch(/spec still `draft`/);
    expect(runFile("claude")).toContain("name that artifact");
  });

  it("019:FR-003: a done feature changes nothing", () => {
    expect(runFile("claude")).toMatch(/Done\*\* → say so and change nothing/);
  });

  it("019:FR-014: several runs are asked about, a new run only on request, ids are <feature>.<n>", () => {
    const text = runFile("claude");
    expect(text).toContain("Several");
    expect(text).toContain("never pick");
    expect(text).toContain("`--new` starts another");
  });

  it("019:FR-012: escalates at the round limit and records the decision", () => {
    const text = runFile("claude");
    expect(text).toContain("escalate");
    expect(text).toContain('--decision="<text>"');
  });

  it("019:FR-016: pause, resume and stop use the directive wording of the worker, verbatim", () => {
    expect(runFile("claude")).toContain(DIRECTIVE_PROTOCOL);
    expect(runFile("claude")).toContain(REPORT_CADENCE);
  });

  it("019:FR-010: a failed review returns only the finding IDs to the same worker", () => {
    expect(runFile("claude")).toMatch(/only the finding IDs and their `fix` to the \*\*same worker\*\*/);
  });

  it("019:FR-006: states that every review role stays read-only, including security", () => {
    expect(runFile("claude")).toMatch(/including `security`, stay read-only/);
  });

  it("019:FR-026, 019:FR-027: tells the lead about restarts, the pause after them, and the caps", () => {
    const text = runFile("claude");
    expect(text).toContain("--restart=<lane>");
    expect(text).toMatch(/only they may approve moving it to another assistant/);
    expect(text).toMatch(/default 3 workers, 2 per assistant type/);
  });

  it("019:FR-019: records the overlap choice, serialized or squad", () => {
    const text = runFile("claude");
    expect(text).toContain("--overlap=serialized");
    expect(text).toContain("--overlap=squad");
  });

  it("019:FR-013: keeps state in files only, through the fleet helper", () => {
    expect(runFile("claude")).toContain("nothing here needs a server");
  });

  it("019:FR-025: loads artifacts by reference only, never whole", () => {
    expect(runFile("claude")).toContain("Never whole artifacts");
  });
});

describe("$SUBAGENTS substitution and the no-subagent fallback", () => {
  const emittersWithCommands = TARGETS.filter((t) => t.emitter.commandSurface !== "none");

  it("019:FR-021: no emitted file keeps the placeholder, and each says yes or no", () => {
    for (const t of TARGETS) {
      for (const f of emitFiles([t.id])) expect(f.contents, `${t.id} ${f.path}`).not.toContain("$SUBAGENTS");
    }
  });

  it("019:FR-021, 019:FR-022: Claude Code is told yes and every unconfirmed target is told no, from the table", () => {
    for (const t of emittersWithCommands) {
      const files = emitFiles([t.id]).filter((f) => /amby[.-]run/.test(f.path));
      expect(files.length, t.id).toBeGreaterThan(0);
      const expected = SUBAGENT_SUPPORT[t.emitter.toolId]?.status === "confirmed" ? "yes" : "no";
      for (const f of files) expect(f.contents, `${t.id} ${f.path}`).toContain(`Subagents on this host: \`${expected}\``);
    }
  });

  it("019:FR-020, 019:FR-021: the fallback text is in every emission and names the sequence and the same state files", () => {
    const text = runFile("codex");
    expect(text).toContain("If `no`");
    expect(text).toContain("in sequence");
    expect(text).toContain("same commands and state files");
  });

  it("019:FR-020: the prompt names no server tool and asks for none", () => {
    expect(run.body).not.toMatch(/\bMCP\b|mcp__|ambykit mcp/i);
    expect(run.allowedTools.every((t) => ["read", "write", "edit", "bash"].includes(t))).toBe(true);
  });
});
