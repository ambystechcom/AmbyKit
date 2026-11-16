import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GraphCommand } from "../../src/cli/graph.js";
import { runCommand } from "../helpers/run-command.js";

function project(specs: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-023-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  for (const [dir, body] of Object.entries(specs)) {
    mkdirSync(join(root, "specs", dir), { recursive: true });
    writeFileSync(join(root, "specs", dir, "spec.md"), `---\nfeature: ${dir}\n---\n# ${dir}\n\n${body}`);
  }
  return root;
}
const story = (n: number, fields = ""): string =>
  `### US-${n} — Story ${n}  (priority: P1)\n\n${fields}\n- **status:** draft\n\n`;

const good = () =>
  project({
    "001-base": story(1) + story(2),
    "002-top": story(1, "- **depends-on:** [001:US-1]\n") + story(2, "- **blocked-by:** [US-1]\n"),
    "003-leaf": story(1, "- **depends-on:** [002:US-1]\n"),
  });

const run = (root: string, positionals: string[] = [], flags: Record<string, string | boolean> = {}) =>
  runCommand(new GraphCommand(), root, positionals, flags);

describe("ambykit graph (spec 023, US-3)", () => {
  it("FR-007: prints readable text by default and exits 0 on a healthy graph", async () => {
    const { code, out } = await run(good());
    expect(code).toBe(0);
    expect(out).toContain("Dependency graph: 5 stories, 3 dependencies, 3 features.");
    expect(out).toContain("002-top -> 001-base");
  });

  it("FR-007/FR-008: --json prints the versioned machine shape", async () => {
    const { code, out } = await run(good(), [], { json: true });
    const doc = JSON.parse(out);
    expect(code).toBe(0);
    expect(doc.version).toBe(1);
    expect(doc.nodes).toHaveLength(5);
    expect(doc.featureEdges.map((e: { from: string; to: string }) => `${e.from}>${e.to}`)).toEqual([
      "002-top>001-base",
      "003-leaf>002-top",
    ]);
  });

  it("FR-007: --mermaid prints a flowchart", async () => {
    const { code, out } = await run(good(), [], { mermaid: true });
    expect(code).toBe(0);
    expect(out.startsWith("graph TD")).toBe(true);
    expect(out).toContain("subgraph f_002_top");
    expect(out).toContain("-.->");
  });

  it("FR-009: a feature argument shows that feature and its direct neighbours only", async () => {
    const { out } = await run(good(), ["002"], { json: true });
    const doc = JSON.parse(out);
    expect([...new Set(doc.nodes.map((n: { feature: string }) => n.feature))]).toEqual(["001-base", "002-top", "003-leaf"]);
    const far = JSON.parse((await run(good(), ["001"], { json: true })).out);
    expect([...new Set(far.nodes.map((n: { feature: string }) => n.feature))]).toEqual(["001-base", "002-top"]);
  });

  it("reports an unknown feature argument and exits 1", async () => {
    const { code, err } = await run(good(), ["999"]);
    expect(code).toBe(1);
    expect(err).toContain('No feature matches "999"');
  });

  it("FR-010: a broken edge is listed first and sets a non-zero exit, in every format", async () => {
    const root = project({ "001-bad": story(1, "- **blocked-by:** [US-9]\n") });
    const text = await run(root);
    expect(text.code).toBe(1);
    expect(text.out).toContain("[broken] 001:US-1 blocked-by US-9");
    const json = await run(root, [], { json: true });
    expect(json.code).toBe(1);
    expect(JSON.parse(json.out).broken).toHaveLength(1);
    expect((await run(root, [], { mermaid: true })).code).toBe(1);
  });

  it("FR-010: a cycle is listed and sets a non-zero exit", async () => {
    const root = project({ "001-loop": story(1, "- **depends-on:** [US-2]\n") + story(2, "- **depends-on:** [US-1]\n") });
    const { code, out } = await run(root);
    expect(code).toBe(1);
    expect(out).toContain("[cycle] 001:US-1 -> 001:US-2 -> 001:US-1");
  });

  it("an empty project says so and exits 0", async () => {
    const root = project({});
    const { code, out } = await run(root);
    expect(code).toBe(0);
    expect(out).toContain("No user stories found.");
    expect(JSON.parse((await run(root, [], { json: true })).out).nodes).toEqual([]);
  });
});
