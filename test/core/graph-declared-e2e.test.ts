import { describe, expect, it } from "vitest";
import { AnalyzeCommand } from "../../src/cli/analyze.js";
import { GraphCommand } from "../../src/cli/graph.js";
import { readFeatures } from "../../src/core/features.js";
import { buildGraph } from "../../src/core/graph.js";
import { runCommand } from "../helpers/run-command.js";
import { tempProject } from "../helpers/spec-project.js";

const spec = (feature: string, deps?: string): string =>
  `---\nformat: 2\nfeature: ${feature}\n${deps ? `depends-on: ${deps}\n` : ""}stories:\n  - id: US-1\n    status: draft\n---\n\n### US-1 — Story\n`;

describe("feature-level depends-on from v2 frontmatter (030, US-9)", () => {
  it("030:FR-016: readFeatures carries the declared dependencies and buildGraph draws the declared edges", () => {
    const dir = tempProject({ "019-base": { "spec.md": spec("019-base") }, "031-top": { "spec.md": spec("031-top", "[019]") } });
    const { features } = readFeatures(dir);
    expect(features.find((f) => f.dir === "031-top")?.dependsOn).toEqual(["019"]);
    expect(features.find((f) => f.dir === "019-base")?.dependsOn).toBeUndefined();
    expect(buildGraph(features).featureEdges).toEqual([{ from: "031-top", to: "019-base", via: [], declared: true }]);
  });

  it("030:FR-016: ambykit graph shows the declared edge in text and json", async () => {
    const dir = tempProject({ "019-base": { "spec.md": spec("019-base") }, "031-top": { "spec.md": spec("031-top", "[019-base]") } });
    const text = await runCommand(new GraphCommand(), dir, [], {});
    expect(text.out).toMatch(/031-top -> 019-base {2}\(declared\)/);
    const json = JSON.parse((await runCommand(new GraphCommand(), dir, [], { json: true })).out) as { version: number; featureEdges: { declared?: boolean }[] };
    expect(json.version).toBe(1);
    expect(json.featureEdges[0]?.declared).toBe(true);
  });

  it("030:FR-016: analyze reports an unknown declared feature as a dangling reference and exits 1", async () => {
    const dir = tempProject({ "031-top": { "spec.md": spec("031-top", "[099]") } });
    const r = await runCommand(new AnalyzeCommand(), dir, [], {});
    expect(r.code).toBe(1);
    expect(r.out + r.err).toMatch(/\[dangling-reference\] 031 depends-on names unknown feature 099/);
    const json = JSON.parse((await runCommand(new AnalyzeCommand(), dir, [], { json: true })).out) as { issues: { kind: string; message: string }[] };
    expect(json.issues).toContainEqual(expect.objectContaining({ kind: "dangling-reference", message: "031 depends-on names unknown feature 099" }));
  });

  it("030:FR-016: a 1.x feature has no declared dependencies and analyze output has no new finding", async () => {
    const dir = tempProject({
      "019-base": { "spec.md": "---\nfeature: 019-base\n---\n\n### US-1 — S\n\n- **status:** done\n" },
    });
    expect(readFeatures(dir).features[0]?.dependsOn).toBeUndefined();
    const r = await runCommand(new AnalyzeCommand(), dir, [], { json: true });
    expect((JSON.parse(r.out) as { issues: unknown[] }).issues).toEqual([]);
    expect(r.code).toBe(0);
  });

  it("030:FR-016: a declared dependency on an existing feature raises no issue", async () => {
    const dir = tempProject({ "019-base": { "spec.md": spec("019-base") }, "031-top": { "spec.md": spec("031-top", "[019]") } });
    const r = await runCommand(new AnalyzeCommand(), dir, [], { json: true });
    expect((JSON.parse(r.out) as { issues: unknown[] }).issues).toEqual([]);
  });
});
