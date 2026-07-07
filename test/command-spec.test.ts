import { describe, expect, it } from "vitest";
import { parseCommandSpec, loadCommandSpecs } from "../src/core/command-spec.js";

describe("parseCommandSpec", () => {
  it("parses frontmatter and trims the body", () => {
    const raw = [
      "---",
      "id: specify",
      "name: amby.specify",
      "description: Turn an idea into a spec.",
      'argument-hint: "<feature description>"',
      "phase: specify",
      "reads: [.amby/constitution.md]",
      "writes: [specs/NNN-slug/spec.md]",
      "allowedTools: [read, write, edit]",
      "---",
      "",
      "Do the thing.",
      "",
    ].join("\n");
    const spec = parseCommandSpec(raw, "specify.md");
    expect(spec.id).toBe("specify");
    expect(spec.name).toBe("amby.specify");
    expect(spec.argumentHint).toBe("<feature description>");
    expect(spec.allowedTools).toEqual(["read", "write", "edit"]);
    expect(spec.reads).toEqual([".amby/constitution.md"]);
    expect(spec.body).toBe("Do the thing.");
  });

  it("rejects invalid frontmatter", () => {
    const raw = "---\nname: x\n---\nbody";
    expect(() => parseCommandSpec(raw, "bad.md")).toThrow(/Invalid prompt frontmatter/);
  });
});

describe("loadCommandSpecs", () => {
  it("loads all eight phase prompts, sorted by id", () => {
    const specs = loadCommandSpecs();
    const ids = specs.map((s) => s.id);
    expect(ids).toEqual([
      "analyze",
      "clarify",
      "constitution",
      "design",
      "implement",
      "plan",
      "specify",
      "tasks",
    ]);
    for (const s of specs) expect(s.name.startsWith("amby.")).toBe(true);
  });
});
