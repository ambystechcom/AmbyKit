import { describe, expect, it } from "vitest";
import { loadCommandSpecs } from "../src/core/command-spec.js";
import { TARGETS, sharedOutputs } from "../src/emitters/index.js";
import { emitFiles, emitTarget } from "./helpers/emit-target.js";

/** Kiro and the Pi alias (feature 016, US-4, FR-005/007). */

const specs = loadCommandSpecs();

describe("Kiro emitter", () => {
  const files = emitTarget("kiro");

  it("emits one skill directory per phase under .kiro/skills, plus AGENTS.md only", () => {
    const expected = [...specs.map((s) => `.kiro/skills/${s.name.replaceAll(".", "-")}/SKILL.md`), "AGENTS.md"].sort();
    expect(Object.keys(files).sort()).toEqual(expected);
  });

  it("names match their directory, with no dots, within Kiro's rules", () => {
    for (const [path, text] of Object.entries(files)) {
      const dir = /^\.kiro\/skills\/([^/]+)\/SKILL\.md$/.exec(path)?.[1];
      if (!dir) continue;
      const name = /^name: (.+)$/m.exec(text)![1]!;
      expect(name).toBe(dir);
      expect(name).toMatch(/^[a-z0-9-]{1,64}$/);
      expect(text).toMatch(/^description: "/m);
    }
  });

  it("rewords $ARGUMENTS into prose", () => {
    const text = files[".kiro/skills/amby-specify/SKILL.md"]!;
    expect(text).not.toContain("$ARGUMENTS");
    expect(text).toContain("the user's request that followed this skill invocation");
  });
});

describe("Pi alias", () => {
  it("is an alias of the Codex emitter", () => {
    const pi = TARGETS.find((t) => t.id === "pi")!;
    expect(pi.alias).toBe(true);
    expect(pi.emitter).toBe(TARGETS.find((t) => t.id === "codex")!.emitter);
  });

  it("alone produces exactly Codex's files", () => {
    expect(emitTarget("pi")).toEqual(emitTarget("codex"));
  });

  it("with Codex writes each file once", () => {
    const both = emitFiles(["codex", "pi"]).map((f) => f.path);
    expect(new Set(both).size).toBe(both.length);
    expect(both.sort()).toEqual(emitFiles(["codex"]).map((f) => f.path).sort());
  });

  it("dropping one owner keeps the files for the other", () => {
    expect(emitTarget(["pi"])).toEqual(emitTarget(["codex", "pi"]));
    expect(emitTarget(["codex"])).toEqual(emitTarget(["codex", "pi"]));
  });
});

describe("sharedOutputs (FR-007)", () => {
  it("names every owner of an emitter two targets share", () => {
    expect(sharedOutputs(["codex", "pi", "kiro"])).toEqual([{ dir: ".agents/skills", owners: ["codex", "pi"] }]);
    expect(sharedOutputs(["pi", "codex"])[0]!.owners).toEqual(["pi", "codex"]);
  });
  it("is empty when nothing is shared", () => {
    expect(sharedOutputs(["codex", "kiro", "gemini"])).toEqual([]);
  });
});
