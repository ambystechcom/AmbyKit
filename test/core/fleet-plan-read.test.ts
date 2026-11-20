import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isDone, readFleetInput } from "../../src/core/fleet-plan/read.js";
import { THREE, fleetProject, model } from "../helpers/fleet-plan-fixture.js";

describe("fleet plan reader (feature 031)", () => {
  it("031:FR-020: models carry status, open tasks with their declared paths and the artifacts present", () => {
    const { models } = readFleetInput(fleetProject(THREE));
    const base = models.find((m) => m.dir === "030-base")!;
    expect(base.status).toBe("ready");
    expect(base.tasks.map((t) => [t.id, t.paths])).toEqual([["T001", ["src/base.ts"]]]);
    expect(base.artifacts).toEqual({ spec: true, plan: true, tasks: true });
    expect(base.lanes).toBe(0);
  });

  it("031:FR-020: a feature-level depends-on (2.x frontmatter) becomes a declared dependency edge", () => {
    const { deps } = readFleetInput(fleetProject(THREE));
    expect(deps).toContainEqual({ feature: "031-mid", on: "030-base", why: "depends-on" });
  });

  it("031:FR-020: a story edge (NNN:US-#) in a 1.x spec becomes a derived dependency edge", () => {
    const root = fleetProject([
      { dir: "030-base" },
      { dir: "031-mid", storyDependsOn: ["030:US-1"] },
    ]);
    const { deps } = readFleetInput(root);
    expect(deps).toContainEqual({ feature: "031-mid", on: "030-base", why: "story-edge" });
  });

  it("031:FR-022: 1.x and 2.x features give the same model shape (ownership and dependencies read alike)", () => {
    const v1 = readFleetInput(fleetProject([{ dir: "030-a", tasks: [{ id: "T001", paths: ["src/x.ts"] }] }])).models[0]!;
    const v2 = readFleetInput(fleetProject([{ dir: "030-a", dependsOn: [], tasks: [{ id: "T001", paths: ["src/x.ts"] }] }])).models[0]!;
    expect(v2.tasks).toEqual(v1.tasks);
  });

  it("031:FR-006: a task with no usable path keeps its pathIssue in the model", () => {
    const { models } = readFleetInput(fleetProject([{ dir: "030-a", tasks: [{ id: "T001", paths: null }, { id: "T002", paths: "glob" }] }]));
    expect(models[0]!.tasks.map((t) => t.pathIssue)).toEqual(["missing", "glob"]);
  });

  it("031:FR-008: a feature is done when its spec says done or every task is checked", () => {
    expect(isDone({ status: "done", tasks: [] })).toBe(true);
    expect(isDone(model({ dir: "031-x", status: "ready", tasks: [{ id: "T001", done: true }] }))).toBe(true);
    expect(isDone(model({ dir: "031-x", status: "ready", tasks: [{ id: "T001" }] }))).toBe(false);
  });

  it("031:FR-020: nothing in src/core/fleet-plan parses markdown or YAML itself (only the 030 reader and the graph do)", () => {
    const dir = join(import.meta.dirname, "..", "..", "src", "core", "fleet-plan");
    const banned = [/gray-matter/, /from "yaml"/, /\.split\(\/\\r\?\\n\/\)/, /\.split\("\\n"\)/, /matchAll\(/, /\bparseTasks\b/, /\bparseStories\b/, /^## /m];
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
      const text = readFileSync(join(dir, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const b of banned) expect(text, `${name} must not match ${b}`).not.toMatch(b);
    }
  });
});
