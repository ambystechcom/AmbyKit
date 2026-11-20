import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import example from "../../examples/ambykit-emitter-example/index.js";
import { getTarget } from "../../src/emitters/index.js";
import { assertEmitterContract, checkEmitterContract, createPluginApi, frontmatterKeys, type MatrixRow } from "../../src/testkit/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const rows: MatrixRow[] = JSON.parse(readFileSync(join(ROOT, "examples", "ambykit-emitter-example", "matrix-rows.json"), "utf8"));
const { targets } = (example as (api: ReturnType<typeof createPluginApi>) => { targets: NonNullable<ReturnType<typeof getTarget>>[] })(createPluginApi());
const target = targets.find((t) => t.id === "example")!;
const row = rows.find((r) => r.target === "example")!;
const kinds = (t: typeof target, r: MatrixRow | undefined) => checkEmitterContract(t, r).map((f) => f.kind);

describe("contract test kit (feature 027)", () => {
  it("027:FR-009: a correct row passes for each of the example's three targets", () => {
    for (const t of targets) {
      const r = rows.find((x) => x.target === t.id);
      expect(checkEmitterContract(t, r), t.id).toEqual([]);
      expect(() => assertEmitterContract(t, r), t.id).not.toThrow();
    }
  });

  it("027:FR-009: the kit also holds built-in emitters to their rows (Gemini TOML, Kiro skills, Cursor CLI rules-only)", () => {
    const gemini: MatrixRow = { target: "gemini", commandSurface: "commands", commandDir: ".gemini/commands", fileTemplate: "amby.<phase>.toml", frontmatterKeys: ["description", "prompt"], sourceUrl: "docs/tool-compatibility.md" };
    const kiro: MatrixRow = { target: "kiro", commandSurface: "skills", commandDir: ".kiro/skills", fileTemplate: "amby-<phase>/SKILL.md", frontmatterKeys: ["name", "description"], sourceUrl: "docs/tool-compatibility.md" };
    const cursorCli: MatrixRow = { target: "cursor-cli", commandSurface: "none", commandDir: ".cursor/commands", fileTemplate: "unused", frontmatterKeys: [], sourceUrl: "docs/tool-compatibility.md" };
    expect(checkEmitterContract(getTarget("gemini")!, gemini)).toEqual([]);
    expect(checkEmitterContract(getTarget("kiro")!, kiro)).toEqual([]);
    expect(checkEmitterContract(getTarget("cursor-cli")!, { ...cursorCli, commandDir: getTarget("cursor-cli")!.emitter.commandDir })).toEqual([]);
  });

  it("027:FR-009: a wrong path fails and names the missing and the unexpected file", () => {
    const failures = checkEmitterContract(target, { ...row, fileTemplate: "x-<phase>.md" });
    expect(failures.map((f) => f.kind)).toEqual(expect.arrayContaining(["missing-file", "unexpected-file"]));
    expect(failures.filter((f) => f.kind === "missing-file").map((f) => f.message).join(" ")).toMatch(/\.example\/commands\/x-specify\.md/);
    expect(failures.filter((f) => f.kind === "unexpected-file").map((f) => f.message).join(" ")).toMatch(/\.example\/commands\/amby\.specify\.md/);
  });

  it("027:FR-009: an unknown or missing frontmatter key fails, grouped into one line", () => {
    const extra = checkEmitterContract(target, { ...row, frontmatterKeys: ["description", "argument-hint"] });
    expect(extra.map((f) => f.kind)).toEqual(["frontmatter"]);
    expect(extra[0]!.message).toMatch(/\d+ command file\(s\) .*\["description"\].*\["description","argument-hint"\]/);
    const fewer = checkEmitterContract(target, { ...row, frontmatterKeys: [] });
    expect(fewer.map((f) => f.kind)).toEqual(["frontmatter"]);
  });

  it("027:FR-009: a different command directory, surface or target id fails", () => {
    expect(kinds(target, { ...row, commandDir: ".other/commands" })).toContain("dir");
    expect(kinds(target, { ...row, commandSurface: "skills" })).toContain("surface");
    expect(kinds(target, { ...row, target: "someone-else" })).toContain("target");
  });

  it("027:FR-009: a missing row fails (Principle 4: no row, no pass), as does a malformed one", () => {
    expect(kinds(target, undefined)).toEqual(["missing-row"]);
    expect(kinds(target, null as never)).toEqual(["missing-row"]);
    expect(kinds(target, { target: "example" } as never)).toEqual(["invalid-row"]);
    expect(checkEmitterContract(target, undefined)[0]!.message).toMatch(/No matrix row for target 'example'/);
  });

  it("027:FR-009: assert throws one error that lists every difference", () => {
    const bad = { ...row, commandDir: ".other", fileTemplate: "x-<phase>.md", frontmatterKeys: ["nope"] };
    let message = "";
    try {
      assertEmitterContract(target, bad);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/Target 'example' does not match its matrix row \(\d+ differences\)/);
    expect(message).toMatch(/commandDir is '\.example\/commands', the row says '\.other'/);
    expect(message).toMatch(/Expected file/);
    expect(message).toMatch(/Emitted '/);
    expect(message.split("\n").length).toBeGreaterThan(3);
  });

  it("027:FR-007: a plugin emitting outside the project fails the kit", () => {
    const escaping = { id: "x", displayName: "x", emitter: { toolId: "x", displayName: "x", commandSurface: "commands", commandDir: ".x", emit: () => [{ path: "../o.md", contents: "", scope: "project" }] } } as never;
    const failures = checkEmitterContract(escaping, { target: "x", commandSurface: "commands", commandDir: ".x", fileTemplate: "a.md", frontmatterKeys: [], sourceUrl: "u" });
    expect(failures.map((f) => f.kind)).toContain("escapes");
  });

  it("027:FR-009: an emitter that throws is reported rather than crashing the kit", () => {
    const throwing = { id: "x", displayName: "x", emitter: { toolId: "x", displayName: "x", commandSurface: "commands", commandDir: ".x", emit: () => { throw new Error("kaboom"); } } } as never;
    const failures = checkEmitterContract(throwing, { target: "x", commandSurface: "commands", commandDir: ".x", fileTemplate: "a.md", frontmatterKeys: [], sourceUrl: "u" });
    expect(failures.map((f) => f.kind)).toEqual(["emit-threw"]);
    expect(failures[0]!.message).toMatch(/kaboom/);
  });

  it("027:FR-009: frontmatterKeys reads YAML and TOML, ignoring keys inside a multi-line prompt", () => {
    expect(frontmatterKeys("a.md", "---\nname: x\ndescription: \"y\"\n  nested: z\n---\nbody: not a key\n")).toEqual(["name", "description"]);
    expect(frontmatterKeys("a.md", "no frontmatter here\nkey: value")).toEqual([]);
    expect(frontmatterKeys("a.md", "---\r\nname: x\r\n---\r\n")).toEqual(["name"]);
    expect(frontmatterKeys("a.toml", "# GENERATED\ndescription = \"d\"\nprompt = '''\nnot_a_key = 1\n'''\nafter = 2\n")).toEqual(["description", "prompt", "after"]);
    expect(frontmatterKeys("a.toml", "description = \"d\"\nprompt = \"\"\"one-line\"\"\"\nx = 1\n")).toEqual(["description", "prompt", "x"]);
  });

  it("027:FR-009: the package exposes the plugin and testkit entries", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.exports["./plugin"]).toBe("./dist/plugins/index.js");
    expect(pkg.exports["./testkit"]).toBe("./dist/testkit/index.js");
    expect(pkg.exports["."]).toBe("./dist/index.js");
  });
});

describe("the contract kit checks only the frozen surface (feature 033, FR-008)", () => {
  it("033:FR-008: the kit exports exactly the runtime names the stability contract lists for it", async () => {
    const { contractFor, parseContractBlocks } = await import("../helpers/contract-doc.js");
    const listed = contractFor(parseContractBlocks(readFileSync(join(ROOT, "docs", "stability.md"), "utf8")), "kit")["exports"] as string[];
    const kit = await import("../../src/testkit/index.js");
    expect(Object.keys(kit).sort()).toEqual([...listed].sort());
  });

  it("033:FR-008: an emitter built only from the frozen plugin API passes the kit with a row of its own", () => {
    const api = createPluginApi();
    class Frozen extends api.BaseEmitter {
      toolId = "frozen";
      displayName = "Frozen";
      commandSurface = "commands" as const;
      commandDir = ".frozen/commands";
      commandFrontmatter(spec: { description: string }): [string, string][] {
        return [["description", this.yamlQuote(spec.description)]];
      }
    }
    const frozen = { id: "frozen", displayName: "Frozen", emitter: new Frozen() } as unknown as NonNullable<ReturnType<typeof getTarget>>;
    const row: MatrixRow = { target: "frozen", commandSurface: "commands", commandDir: ".frozen/commands", fileTemplate: "amby.<phase>.md", frontmatterKeys: ["description"], sourceUrl: "https://example.invalid/frozen" };
    expect(checkEmitterContract(frozen, row)).toEqual([]);
    expect(api.apiVersion).toMatch(/^2\./);
  });
});
