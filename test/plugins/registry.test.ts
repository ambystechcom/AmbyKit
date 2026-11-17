import { describe, expect, it } from "vitest";
import type { TargetDef } from "../../src/emitters/index.js";
import { TARGETS } from "../../src/emitters/index.js";
import { buildRegistry, describeCollision } from "../../src/plugins/registry.js";

const fake = (id: string, toolId = id): TargetDef => ({ id, displayName: id, emitter: { toolId } as TargetDef["emitter"] });

describe("target registry (feature 027)", () => {
  it("027:FR-003: built-ins come first, plugin targets follow in listing order", () => {
    const r = buildRegistry(TARGETS, [
      { name: "ambykit-emitter-a", version: "1.0.0", targets: [fake("a")] },
      { name: "ambykit-emitter-b", version: "1.0.0", targets: [fake("b")] },
    ]);
    expect(r.targets.map((t) => t.id)).toEqual([...TARGETS.map((t) => t.id), "a", "b"]);
    expect(r.collisions).toEqual([]);
    expect(r.owners.get("a")).toBe("ambykit-emitter-a");
    expect(r.owners.get("claude")).toBe("built-in");
  });

  it("027:FR-005: a plugin target colliding with a built-in is reported and never overrides it", () => {
    const impostor = fake("claude", "claude-impostor");
    const r = buildRegistry(TARGETS, [{ name: "ambykit-emitter-x", version: "1.0.0", targets: [impostor] }]);
    expect(r.collisions).toEqual([{ id: "claude", plugin: "ambykit-emitter-x", with: "built-in" }]);
    expect(r.targets.find((t) => t.id === "claude")).toBe(TARGETS.find((t) => t.id === "claude"));
    expect(r.targets.filter((t) => t.id === "claude")).toHaveLength(1);
    expect(describeCollision(r.collisions[0]!)).toMatch(/ambykit-emitter-x.*'claude'.*built-in/);
  });

  it("027:FR-005: a plugin target colliding with an earlier plugin keeps the earlier one", () => {
    const first = fake("dup", "first");
    const r = buildRegistry([], [
      { name: "ambykit-emitter-a", version: "1.0.0", targets: [first] },
      { name: "ambykit-emitter-b", version: "1.0.0", targets: [fake("dup", "second"), fake("ok")] },
    ]);
    expect(r.targets.map((t) => t.id)).toEqual(["dup", "ok"]);
    expect(r.targets[0]).toBe(first);
    expect(r.collisions).toEqual([{ id: "dup", plugin: "ambykit-emitter-b", with: "ambykit-emitter-a" }]);
    expect(describeCollision(r.collisions[0]!)).toMatch(/plugin ambykit-emitter-a/);
  });

  it("027:FR-005: the plugin behind an emitter is findable for error messages", () => {
    const r = buildRegistry(TARGETS, [{ name: "ambykit-emitter-a", version: "2.0.0", targets: [fake("a", "a-tool")] }]);
    expect(r.pluginOfTool("a-tool")).toEqual({ name: "ambykit-emitter-a", version: "2.0.0" });
    expect(r.pluginOfTool("claude")).toBeUndefined();
  });

  it("027:FR-016: the built-in list is not mutated", () => {
    const before = TARGETS.length;
    buildRegistry(TARGETS, [{ name: "ambykit-emitter-a", version: "1.0.0", targets: [fake("a")] }]);
    expect(TARGETS).toHaveLength(before);
  });
});
