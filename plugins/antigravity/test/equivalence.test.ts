import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildEmittedFiles } from "../../../src/core/emit.js";
import { TARGETS, sharedOutputs, type TargetDef } from "../../../src/emitters/index.js";
import { createPluginApi } from "../../../src/plugins/api.js";
import { buildRegistry, type TargetRegistry } from "../../../src/plugins/registry.js";
import { tempProject } from "../../../test/helpers/emit-target.js";
import factory from "../src/index.js";

/**
 * The plugin must write exactly what the emitters inside AmbyKit 1.6 write (spec 036, FR-003, SC-001): that is what makes
 * removing the built-ins from core safe and what the install test (T035) expects ("run `ambykit sync`, no diff").
 *
 * Both sides run through the real `buildEmittedFiles`. The "plugin side" uses a registry shaped like AmbyKit 2.0 after the
 * built-ins are removed: every built-in target except the two Antigravity ones, plus the plugin's targets. Whole `EmittedFile`
 * objects are compared (path, contents, scope, merge and protection flags, and order), not just the contents.
 */

const MOVED = new Set(["antigravity", "antigravity-cli"]);
const pluginTargets: TargetDef[] = factory(createPluginApi()).targets;
const pluginRegistry: TargetRegistry = buildRegistry(
  TARGETS.filter((t) => !MOVED.has(t.id)),
  [{ name: "@ambystech/ambykit-emitter-antigravity", version: "1.0.0", targets: pluginTargets }],
);

interface Case {
  roles: boolean;
  mcp: boolean;
  manageRules: boolean;
}

function emit(tools: string[], c: Case, registry?: TargetRegistry) {
  const root = tempProject({ roles: c.roles });
  return buildEmittedFiles(root, { version: "0.0.0", tools, manageRules: c.manageRules, ...(c.mcp ? { mcp: { enabled: true } } : {}) }, registry);
}

const TOOL_SETS: string[][] = [
  ["antigravity"],
  ["antigravity-cli"],
  ["antigravity", "antigravity-cli"],
  ["antigravity-cli", "antigravity"],
  ["codex", "antigravity", "antigravity-cli", "pi"],
  ["claude", "antigravity", "cursor", "copilot-cli"],
];
const CASES: Case[] = [false, true].flatMap((roles) => [false, true].flatMap((mcp) => [true, false].map((manageRules) => ({ roles, mcp, manageRules }))));

describe("the plugin writes what AmbyKit 1.6's built-in Antigravity emitters write (036:FR-003, SC-001)", () => {
  it("036:FR-003: the plugin registry really replaces the built-ins (the comparison is not the built-in against itself)", () => {
    expect(pluginRegistry.collisions).toEqual([]);
    for (const id of MOVED) {
      const fromPlugin = pluginRegistry.targets.find((t) => t.id === id)!;
      const builtIn = TARGETS.find((t) => t.id === id)!;
      expect(fromPlugin.emitter).not.toBe(builtIn.emitter);
      expect(fromPlugin.emitter.constructor).not.toBe(builtIn.emitter.constructor);
      expect(pluginRegistry.owners.get(id)).toBe("@ambystech/ambykit-emitter-antigravity");
    }
  });

  for (const tools of TOOL_SETS) {
    for (const c of CASES) {
      const label = `${tools.join("+")} (roles ${c.roles ? "on" : "off"}, mcp ${c.mcp ? "on" : "off"}, rules ${c.manageRules ? "on" : "off"})`;
      it(`036:FR-003: ${label} is byte-identical, file by file, in the same order`, () => {
        const builtIn = emit(tools, c);
        const plugin = emit(tools, c, pluginRegistry);
        expect(plugin.map((f) => f.path)).toEqual(builtIn.map((f) => f.path));
        expect(plugin).toEqual(builtIn);
      });
    }
  }

  it("036:FR-003: it writes something (the comparison is not two empty lists)", () => {
    const files = emit(["antigravity", "antigravity-cli"], { roles: true, mcp: true, manageRules: true }, pluginRegistry);
    expect(files.some((f) => f.path === ".agents/skills/amby-specify/SKILL.md")).toBe(true);
    expect(files.some((f) => f.path === ".agents/mcp_config.json")).toBe(true);
    expect(files.length).toBeGreaterThan(10);
  });

  it("036:FR-003: the CLI target writes the project MCP file, the IDE target says why it does not", () => {
    const [ide, cli] = pluginTargets.map((t) => t.emitter);
    expect(ide!.mcpSkipReason()).toBe(TARGETS.find((t) => t.id === "antigravity")!.emitter.mcpSkipReason());
    expect(ide!.mcpSkipReason()).toMatch(/unconfirmed/);
    expect(cli!.mcpSkipReason()).toBeNull();
    const ctx = { projectName: "demo", specs: [], manageRules: false };
    expect(cli!.mcpFiles(ctx)).toEqual(TARGETS.find((t) => t.id === "antigravity-cli")!.emitter.mcpFiles(ctx));
  });

  it("036:FR-003: the targets keep their ids, names, surface and directory", () => {
    for (const t of pluginTargets) {
      const builtIn = TARGETS.find((b) => b.id === t.id)!;
      expect(t.displayName).toBe(builtIn.displayName);
      expect(t.emitter.toolId).toBe(builtIn.emitter.toolId);
      expect(t.emitter.displayName).toBe(builtIn.emitter.displayName);
      expect(t.emitter.commandSurface).toBe("skills");
      expect(t.emitter.commandDir).toBe(".agents/skills");
    }
  });
});

describe("shared .agents/skills with codex and pi (036:FR-003)", () => {
  it("036:FR-003: the plugin's targets are co-owners of .agents/skills exactly like the built-ins", () => {
    const ids = ["codex", "pi", "antigravity", "antigravity-cli"];
    expect(sharedOutputs(ids, pluginRegistry)).toEqual(sharedOutputs(ids));
    expect(sharedOutputs(ids, pluginRegistry)[0]!.owners).toEqual(ids);
  });

  it("036:FR-003: each skill is written once and carries the highest-ranked id (codex, then antigravity, then antigravity-cli)", () => {
    const c = { roles: false, mcp: false, manageRules: false };
    const specify = (tools: string[]): string => emit(tools, c, pluginRegistry).find((f) => f.path === ".agents/skills/amby-specify/SKILL.md")!.contents;
    expect(specify(["antigravity-cli", "pi", "antigravity", "codex"])).toContain("--agent=codex");
    expect(specify(["antigravity-cli", "antigravity"])).toContain("--agent=antigravity ");
    expect(specify(["antigravity-cli"])).toContain("--agent=antigravity-cli");
    const paths = emit(["antigravity-cli", "pi", "antigravity", "codex"], c, pluginRegistry).map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("the plugin matches the goldens recorded for core (036:FR-012)", () => {
  // The goldens still live in core (test/fixtures/emitters-golden) while the built-ins exist; T052 moves them here.
  const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "test", "fixtures", "emitters-golden");
  const lf = (files: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.replaceAll("\r\n", "\n")]));
  const record = (id: string, roles: boolean): Record<string, string> =>
    lf(
      Object.fromEntries(
        emit([id], { roles, mcp: false, manageRules: true }, pluginRegistry)
          .map((f) => [f.path, f.contents] as const)
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    );

  for (const id of ["antigravity", "antigravity-cli"]) {
    it(`036:FR-012: ${id}: every file, with and without roles, equals the recorded golden`, () => {
      const raw = JSON.parse(readFileSync(join(DIR, `${id}.json`), "utf8")) as { plain: Record<string, string>; roles: Record<string, string> };
      expect(record(id, false)).toEqual(lf(raw.plain));
      expect(record(id, true)).toEqual(lf(raw.roles));
    });
  }
});
