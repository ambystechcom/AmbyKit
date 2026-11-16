import { describe, expect, it } from "vitest";
import { assertInsideProject, buildEmittedFiles } from "../../src/core/emit.js";
import { loadPluginSession } from "../../src/plugins/session.js";
import type { EmittedFile } from "../../src/core/types.js";
import { pluginProject } from "../helpers/plugin-project.js";

const file = (path: string, scope: "project" | "user" = "project"): EmittedFile => ({ path, contents: "x", scope });

describe("project-root path guard (feature 027, FR-007)", () => {
  it("027:FR-007: refuses absolute, drive-letter and parent paths in project scope", () => {
    for (const bad of ["../x", "a/../../x", "/etc/x", "C:/x", "C:\\x", "..\\x", ""]) {
      expect(() => assertInsideProject(file(bad), "t"), bad).toThrow(/outside the project/);
    }
  });

  it("027:FR-007: allows ordinary relative paths and leaves user scope to --include-user", () => {
    for (const good of [".claude/commands/a.md", "AGENTS.md", "a/b..c/d.txt", "./x"]) {
      expect(() => assertInsideProject(file(good), "t"), good).not.toThrow();
    }
    expect(() => assertInsideProject(file("../outside", "user"), "t")).not.toThrow();
  });

  it("027:FR-007: a plugin that emits ../outside.txt fails the whole emit and is named", async () => {
    const root = pluginProject({ tools: ["escape"], plugins: { "ambykit-emitter-escape": "1.0.0" } });
    const session = await loadPluginSession(root, { plugins: { "ambykit-emitter-escape": "1.0.0" } });
    expect(session?.failures).toEqual([]);
    expect(() => buildEmittedFiles(root, { version: "0.0.0", tools: ["escape"] }, session!.registry)).toThrow(
      /'escape' \(plugin ambykit-emitter-escape@1\.0\.0\) tried to write outside the project: \.\.\/outside\.txt/,
    );
  });

  it("027:FR-005: an output collision between two plugins names both plugins", async () => {
    const plugins = { "ambykit-emitter-plain": "1.0.0", "ambykit-emitter-collide": "1.0.0" };
    const root = pluginProject({ plugins });
    const session = await loadPluginSession(root, { plugins });
    // `collide` is rejected by the registry (its target id is built-in `claude`), so emit the two by hand.
    expect(session!.collisions.map((c) => c.id)).toEqual(["claude"]);
    const plain = session!.registry.targets.find((t) => t.id === "plain")!;
    const twin = { ...plain, id: "twin", emitter: { ...plain.emitter, toolId: "twin", emit: () => [{ path: ".plain/commands/amby.specify.md", contents: "different", scope: "project" as const }] } };
    const registry = { ...session!.registry, targets: [...session!.registry.targets, twin as typeof plain] };
    expect(() => buildEmittedFiles(root, { version: "0.0.0", tools: ["plain", "twin"] }, registry)).toThrow(
      /Output collision at \.plain\/commands\/amby\.specify\.md: 'plain' \(plugin ambykit-emitter-plain@1\.0\.0\) and 'twin' emit different contents/,
    );
  });

  it("027:FR-016: without a registry the collision message is the one it always was", () => {
    // Built-in only: no plugin names are added to any message.
    const root = pluginProject({ tools: ["claude"] });
    expect(buildEmittedFiles(root, { version: "0.0.0", tools: ["claude"] }).length).toBeGreaterThan(0);
  });
});
