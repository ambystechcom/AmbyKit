import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCommandSpecs } from "../../src/core/command-spec.js";
import { AntigravityCliEmitter, AntigravityEmitter } from "../../src/emitters/index.js";
import { MCP_COMMAND, MCP_SERVER_NAME } from "../../src/emitters/base-emitter.js";
import { createPluginApi } from "../../src/plugins/api.js";
import * as barrel from "../../src/plugins/index.js";
import * as testkit from "../../src/testkit/index.js";

/**
 * Feature 036, T003: the plugin API gaps the official Antigravity plugin needs. The Antigravity CLI emitter writes a
 * project MCP file with `MCP_COMMAND`; a plugin could not reach it. Added to the API (an addition: 027's API is unchanged).
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const specs = loadCommandSpecs();
const ctx = { projectName: "demo", specs, manageRules: false };

describe("MCP values in the plugin API (feature 036, T003)", () => {
  it("036:FR-007: the factory argument carries the server name and start command the built-in emitters use", () => {
    const api = createPluginApi();
    expect(api.MCP_SERVER_NAME).toBe(MCP_SERVER_NAME);
    expect(api.MCP_COMMAND).toEqual(MCP_COMMAND);
    expect(api.MCP_COMMAND).toEqual({ command: "ambykit", args: ["mcp"] });
  });

  it("036:FR-007: `@ambystech/ambykit/plugin` exports them, and the contract kit hands out the same API", () => {
    expect(barrel.MCP_SERVER_NAME).toBe(MCP_SERVER_NAME);
    expect(barrel.MCP_COMMAND).toEqual(MCP_COMMAND);
    expect(testkit.createPluginApi().MCP_COMMAND).toEqual(MCP_COMMAND);
  });

  it("036:FR-007: every existing extension point is still provided (additions only)", () => {
    const api = createPluginApi();
    for (const name of ["BaseEmitter", "SkillsEmitter", "TomlCommandEmitter", "skillName", "skillPath", "skillFrontmatter", "tomlBasic", "tomlPrompt", "apiVersion"]) {
      expect(api, name).toHaveProperty(name);
    }
    expect(api.apiVersion).toBe(barrel.PLUGIN_API_VERSION);
  });

  it("036:FR-007: docs/plugin-api.md names the two additions", () => {
    const doc = readFileSync(join(ROOT, "docs", "plugin-api.md"), "utf8");
    expect(doc).toMatch(/`MCP_SERVER_NAME`, `MCP_COMMAND`/);
  });
});

describe("a plugin shaped like Antigravity (feature 036, T002)", () => {
  type Factory = (api: ReturnType<typeof createPluginApi>) => { targets: { id: string; emitter: { toolId: string; commandDir: string; mcpFiles(c: typeof ctx): { path: string; contents: string }[]; mcpSkipReason(): string | null; emit(s: typeof specs, c: typeof ctx): { path: string; contents: string }[] } }[] };

  async function fixture() {
    const url = pathToFileURL(join(ROOT, "test", "fixtures", "plugins", "ambykit-emitter-skills-target", "index.js")).href;
    const mod = (await import(url)) as { default: Factory };
    return Object.fromEntries(mod.default(createPluginApi()).targets.map((t) => [t.id, t.emitter]));
  }

  it("036:FR-003: its IDE and CLI targets write the skills layout the built-in Antigravity emitters write", async () => {
    const t = await fixture();
    const own = (id: string) => t[id]!.emit(specs, ctx).map((f) => f.path);
    expect(own("skills-target")).toEqual(new AntigravityEmitter().emit(specs, ctx).map((f) => f.path));
    expect(own("skills-target-cli")).toEqual(new AntigravityCliEmitter().emit(specs, ctx).map((f) => f.path));
    expect(own("skills-target")).toContain(".agents/skills/amby-constitution/SKILL.md");
  });

  it("036:FR-003: the CLI target's MCP file, built with api.MCP_COMMAND, is byte-identical to the built-in CLI emitter's", async () => {
    const t = await fixture();
    const mine = t["skills-target-cli"]!.mcpFiles(ctx);
    const builtIn = new AntigravityCliEmitter().mcpFiles(ctx);
    expect(mine).toEqual(builtIn);
    expect(mine[0]!.path).toBe(".agents/mcp_config.json");
    expect(JSON.parse(mine[0]!.contents).mcpServers[MCP_SERVER_NAME]).toEqual(MCP_COMMAND);
  });

  it("036:FR-003: the IDE target writes no MCP file and gives a reason, as the built-in IDE emitter does", async () => {
    const t = await fixture();
    expect(t["skills-target"]!.mcpFiles(ctx)).toEqual([]);
    expect(t["skills-target"]!.mcpFiles(ctx)).toEqual(new AntigravityEmitter().mcpFiles(ctx));
    expect(typeof t["skills-target"]!.mcpSkipReason()).toBe("string");
  });
});
