import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as barrel from "../../src/plugins/index.js";
import { loadCommandSpecs } from "../../src/core/command-spec.js";
import example from "../../examples/ambykit-emitter-example/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The API exactly as a plugin author gets it from `@ambystech/ambykit/plugin`: nothing but the barrel.
const api = {
  BaseEmitter: barrel.BaseEmitter,
  SkillsEmitter: barrel.SkillsEmitter,
  TomlCommandEmitter: barrel.TomlCommandEmitter,
  skillName: barrel.skillName,
  skillPath: barrel.skillPath,
  skillFrontmatter: barrel.skillFrontmatter,
  tomlBasic: barrel.tomlBasic,
  tomlPrompt: barrel.tomlPrompt,
  apiVersion: barrel.PLUGIN_API_VERSION,
};

describe("plugin extension points (feature 027)", () => {
  const specs = loadCommandSpecs();
  const ctx = { projectName: "demo", specs, manageRules: false };
  const { targets } = (example as (a: typeof api) => { targets: { id: string; emitter: { emit: (s: typeof specs, c: typeof ctx) => { path: string; contents: string; scope: string }[] } }[] })(api);
  const byId = Object.fromEntries(targets.map((t) => [t.id, t.emitter.emit(specs, ctx)]));

  it("027:FR-001: the example plugin extends all three emitters using only the barrel", () => {
    expect(targets.map((t) => t.id)).toEqual(["example", "example-skills", "example-toml"]);
  });

  it("027:FR-001: a BaseEmitter subclass emits one Markdown command per phase", () => {
    const files = byId["example"]!;
    expect(files.map((f) => f.path)).toEqual(specs.map((s) => `.example/commands/${s.name}.md`));
    expect(files[0]!.contents.startsWith('---\ndescription: "')).toBe(true);
    expect(files.every((f) => f.scope === "project")).toBe(true);
  });

  it("027:FR-001: a SkillsEmitter subclass emits <dir>/<skill>/SKILL.md with name and description", () => {
    const files = byId["example-skills"]!;
    expect(files.map((f) => f.path)).toEqual(specs.map((s) => `.example/skills/${s.name.replace(/\./g, "-")}/SKILL.md`));
    expect(files[0]!.contents).toMatch(/^---\nname: amby-[a-z]+\ndescription: "/);
  });

  it("027:FR-001: a TomlCommandEmitter subclass emits TOML commands with a prompt", () => {
    const files = byId["example-toml"]!;
    expect(files.map((f) => f.path)).toEqual(specs.map((s) => `.example/toml/${s.name}.toml`));
    expect(files[0]!.contents).toMatch(/\nprompt = /);
  });

  it("027:FR-002: every extension point named in docs/plugin-api.md is exported by the barrel", () => {
    const doc = readFileSync(join(ROOT, "docs", "plugin-api.md"), "utf8");
    const section = doc.slice(doc.indexOf("## Extension points"), doc.indexOf("## Options and guarantees"));
    const names = [...section.matchAll(/`([A-Za-z][A-Za-z0-9_]+)`/g)].map((m) => m[1]!);
    const barrelText = readFileSync(join(ROOT, "src", "plugins", "index.ts"), "utf8");
    const extensionPoints = ["BaseEmitter", "SkillsEmitter", "TomlCommandEmitter", "skillName", "skillPath", "skillFrontmatter", "tomlBasic", "tomlPrompt", "PLUGIN_API_VERSION"];
    for (const n of extensionPoints) {
      expect(names, n).toContain(n);
      expect(Object.keys(barrel), n).toContain(n);
    }
    const types = ["TargetDef", "CommandSpec", "CommandSurface", "EmittedFile", "RulesContext", "Role", "PluginModule", "PluginFactory", "PluginApi"];
    for (const t of types) {
      expect(doc, t).toContain(`\`${t}\``);
      expect(barrelText, t).toMatch(new RegExp(`\\b${t}\\b`));
    }
  });

  it("033:FR-007: the API is labelled stable from 2.0 in the docs and has no experimental flag in the barrel", () => {
    expect(Object.keys(barrel)).not.toContain("PLUGIN_API_EXPERIMENTAL");
    expect(readFileSync(join(ROOT, "docs", "plugin-api.md"), "utf8")).toMatch(/Stable from 2\.0/);
  });
});
