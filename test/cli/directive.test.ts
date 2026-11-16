import { describe, expect, it } from "vitest";
import { DirectiveCommand } from "../../src/cli/directive.js";
import { readDirective } from "../../src/core/fleet/directives.js";
import { createRun, updateRun } from "../../src/core/fleet/runs.js";
import { reportActivity } from "../../src/core/report.js";
import { project } from "../mcp/fixture.js";

const make = () => {
  const root = project([{ dir: "001-alpha", stories: [{ n: 1 }], phases: [{ title: "Work", tasks: [{ id: "T001", story: 1 }] }] }]);
  const run = createRun(root, "001-alpha");
  if (!run.ok) throw new Error(run.warning);
  updateRun(root, run.run.run, { lanes: [{ lane: "001-alpha.lane-1-1", assistant: "claude", tasks: ["T001"] }] });
  return { root, run: run.run.run };
};

async function directive(cwd: string, positionals: string[], flags: Record<string, string | boolean> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (...a: unknown[]) => void out.push(a.join(" "));
  console.error = (...a: unknown[]) => void err.push(a.join(" "));
  try {
    const code = await new DirectiveCommand().run({ cwd, positionals, flags });
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    console.log = log;
    console.error = error;
  }
}

describe("ambykit directive", () => {
  it("025:FR-023: pause writes the directive; the next report returns pause and a later one shows paused", async () => {
    const { root, run } = make();
    const r = await directive(root, ["001", "lane-1-1", "pause"]);
    expect(r.code).toBe(0);
    expect(readDirective(root, run, "lane-1-1")?.action).toBe("pause");
    const base = { feature: "001-alpha", agent: "claude", phase: "implement", lane: "1-1", fleet: true } as const;
    expect(reportActivity(root, { ...base, state: "working" })).toMatchObject({ directive: "pause", directiveStatus: "pause requested" });
    expect(reportActivity(root, { ...base, state: "paused" })).toMatchObject({ directive: "pause", directiveStatus: "paused" });
  });

  it("025:FR-023: resume writes continue", async () => {
    const { root, run } = make();
    await directive(root, ["001", "1-1", "pause"]);
    expect((await directive(root, ["001", "1-1", "resume"])).code).toBe(0);
    expect(readDirective(root, run, "lane-1-1")?.action).toBe("continue");
    expect(reportActivity(root, { feature: "001-alpha", agent: "claude", phase: "implement", lane: "1-1", state: "working", fleet: true }).directive).toBe("continue");
  });

  it("025:FR-023: stop is written like any other", async () => {
    const { root, run } = make();
    await directive(root, ["001-alpha", "lane-1-1", "stop"]);
    expect(readDirective(root, run, "lane-1-1")?.action).toBe("stop");
  });

  it("025:FR-023: an unknown lane is refused by name, exit 1, nothing written", async () => {
    const { root, run } = make();
    const r = await directive(root, ["001", "lane-7-7", "pause"]);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/lane 'lane-7-7' not found/);
    expect(readDirective(root, run, "lane-7-7")).toBeNull();
  });

  it("025:FR-023: an unknown verb, a missing argument and an unknown feature are refused", async () => {
    const { root } = make();
    expect((await directive(root, ["001", "lane-1-1", "explode"])).code).toBe(1);
    expect((await directive(root, ["001", "lane-1-1"])).code).toBe(1);
    expect((await directive(root, ["999", "lane-1-1", "pause"])).err).toMatch(/Feature '999' not found/);
  });

  it("025:FR-024: --run picks a run when several are unfinished; without it the warning names them", async () => {
    const { root, run } = make();
    const second = createRun(root, "001-alpha");
    if (!second.ok) throw new Error(second.warning);
    updateRun(root, second.run.run, { lanes: [{ lane: "001-alpha.lane-1-1", assistant: "claude", tasks: [] }] });
    const ambiguous = await directive(root, ["001", "1-1", "pause"]);
    expect(ambiguous.code).toBe(1);
    expect(ambiguous.err).toMatch(/several unfinished runs/);
    expect((await directive(root, ["001", "1-1", "pause"], { run })).code).toBe(0);
  });
});
