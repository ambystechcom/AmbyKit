import { describe, expect, it } from "vitest";
import { loadCommandSpecs } from "../src/core/command-spec.js";
import type { RulesContext } from "../src/core/types.js";
import { ClaudeEmitter, TARGETS } from "../src/emitters/index.js";

// Feature 017 (FR-020, SC-004): the activity self-report is authored once with `$AGENT`, and every
// tool's emitted commands carry that tool's own id.
describe("activity self-report in emitted commands (feature 017)", () => {
  const specs = loadCommandSpecs();
  const ctx: RulesContext = { projectName: "demo", specs, manageRules: false };
  const PHASES = ["specify", "design", "plan", "tasks", "implement", "converge"];

  it("each reporting phase prompt has exactly one report line (implement: two)", () => {
    for (const id of PHASES) {
      const body = specs.find((s) => s.id === id)!.body;
      expect(body.match(/ambykit activity <feature> --agent=\$AGENT --phase=/g)?.length, id).toBe(id === "implement" ? 2 : 1);
    }
    expect(specs.find((s) => s.id === "implement")!.body).toContain("--phase=implement --task=T###");
  });

  it("every emitter substitutes its own tool id and leaves no $AGENT", () => {
    for (const t of TARGETS.filter((x) => !x.alias)) {
      const files = t.emitter.emit(specs, ctx).filter((f) => f.contents.includes("ambykit activity"));
      if (t.emitter.commandSurface === "none") continue;
      expect(files.length, t.id).toBeGreaterThanOrEqual(PHASES.length);
      for (const f of files) {
        expect(f.contents, f.path).not.toContain("$AGENT");
        expect(f.contents, f.path).toContain(`--agent=${t.emitter.toolId} `);
      }
    }
  });

  it("Claude grants only the scoped activity command to phases without shell access", () => {
    const files = new ClaudeEmitter().emit(specs, ctx);
    const tools = (name: string) => /allowed-tools: (.*)/.exec(files.find((f) => f.path.endsWith(`amby.${name}.md`))!.contents)![1];
    expect(tools("converge")).toBe("Read, Edit, Bash(ambykit activity:*)");
    expect(tools("plan")).toBe("Read, Write, Edit, Bash(ambykit activity:*)");
    expect(tools("implement")).toBe("Read, Write, Edit, Bash");
    expect(tools("analyze")).toBe("Read");
  });
});
