import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sharedOutputs } from "../../../src/emitters/index.js";
import { emitTargetWithPlugin, emitWithPlugin, pluginRegistry } from "./helpers.js";

/**
 * What the plugin writes (spec 036, FR-003, FR-012, SC-001). While the emitters still lived inside AmbyKit, `equivalence.test.ts`
 * proved the plugin byte-identical to them (48 cases: 6 target sets x roles x mcp x rules, whole EmittedFile objects). They are
 * gone from core now, so what that comparison established is kept as the goldens recorded from them (`test/fixtures/golden/`),
 * compared through the real `buildEmittedFiles` with the plugin installed. After an intentional change to a neutral prompt:
 * `UPDATE_GOLDEN=1 npx vitest run plugins/antigravity/test/golden.test.ts`.
 */

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "golden");
type Emitted = Record<string, string>;
const lf = (files: Emitted): Emitted => Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.replaceAll("\r\n", "\n")]));

describe("the plugin matches the goldens recorded from the built-in emitters (036:FR-003, FR-012)", () => {
  for (const id of ["antigravity", "antigravity-cli"]) {
    it(`036:FR-012: ${id}: every file, with and without roles, equals the recorded golden`, () => {
      const actual = { plain: lf(emitTargetWithPlugin(id)), roles: lf(emitTargetWithPlugin(id, { roles: true })) };
      const file = join(DIR, `${id}.json`);
      if (process.env["UPDATE_GOLDEN"] === "1") {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(file, JSON.stringify(actual, null, 2) + "\n");
      }
      const raw = JSON.parse(readFileSync(file, "utf8")) as typeof actual;
      const golden = { plain: lf(raw.plain), roles: lf(raw.roles) };
      expect(Object.keys(actual.plain)).toEqual(Object.keys(golden.plain));
      expect(actual).toEqual(golden);
    });
  }

  it("036:FR-003: it writes something (the comparison is not two empty lists)", () => {
    const files = emitWithPlugin(["antigravity", "antigravity-cli"], { roles: true });
    expect(files.some((f) => f.path === ".agents/skills/amby-specify/SKILL.md")).toBe(true);
    expect(files.length).toBeGreaterThan(10);
  });
});

describe("shared .agents/skills with codex and pi (036:FR-003)", () => {
  it("036:FR-003: the plugin's targets are co-owners of .agents/skills with codex and pi", () => {
    const ids = ["codex", "pi", "antigravity", "antigravity-cli"];
    expect(pluginRegistry.collisions).toEqual([]);
    expect(sharedOutputs(ids, pluginRegistry)[0]!.owners).toEqual(ids);
  });

  it("036:FR-003: each skill is written once and carries the highest-ranked id (codex, then antigravity, then antigravity-cli)", () => {
    const specify = (tools: string[]): string => emitWithPlugin(tools, { manageRules: false }).find((f) => f.path === ".agents/skills/amby-specify/SKILL.md")!.contents;
    expect(specify(["antigravity-cli", "pi", "antigravity", "codex"])).toContain("--agent=codex");
    expect(specify(["antigravity-cli", "antigravity"])).toContain("--agent=antigravity ");
    expect(specify(["antigravity-cli"])).toContain("--agent=antigravity-cli");
    const paths = emitWithPlugin(["antigravity-cli", "pi", "antigravity", "codex"], { manageRules: false }).map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("036:FR-003: the targets keep their ids, names, surface and directory", () => {
    const expected = { antigravity: "Antigravity (IDE)", "antigravity-cli": "Antigravity CLI" } as const;
    for (const [id, name] of Object.entries(expected)) {
      const t = pluginRegistry.targets.find((x) => x.id === id)!;
      expect(t.displayName).toBe(name);
      expect(t.emitter.toolId).toBe(id);
      expect(t.emitter.commandSurface).toBe("skills");
      expect(t.emitter.commandDir).toBe(".agents/skills");
    }
  });
});
