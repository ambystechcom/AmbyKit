import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CheckCommand } from "../../src/cli/check.js";
import { SyncCommand } from "../../src/cli/sync.js";
import { MOVED_TARGETS } from "../../src/core/moved-targets.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

/**
 * Feature 036, US-1 (T020): a moved target whose plugin is installed and listed behaves like any other target, and a built-in
 * target is unchanged by the move (FR-003, FR-001). The fixture plugin is shaped like the official Antigravity one
 * (test/fixtures/plugins/ambykit-emitter-skills-target), so core never needs the published package (D3).
 */

const PLUGIN = "ambykit-emitter-skills-target";
const MOVED = { package: PLUGIN, since: "2.0.0" };
const text = (r: { out: string; err: string }): string => `${r.out}\n${r.err}`;

/** Every file under the project's tool directories, as path -> contents, for byte comparison. */
const read = (root: string, rel: string): string => readFileSync(join(root, rel), "utf8");

describe("a moved target provided by an installed, listed plugin (036:FR-003)", () => {
  afterEach(() => {
    delete MOVED_TARGETS["skills-target"];
    delete MOVED_TARGETS["skills-target-cli"];
  });

  it("036:FR-003: sync succeeds and writes the files the plugin defines, for both of its targets", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    MOVED_TARGETS["skills-target-cli"] = MOVED;
    const root = pluginProject({
      tools: ["claude", "skills-target", "skills-target-cli"],
      plugins: { [PLUGIN]: "1.0.0" },
      config: { mcp: { enabled: true } },
    });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(text(r)).not.toMatch(/moved to the plugin/);
    expect(existsSync(join(root, ".agents", "skills", "amby-specify", "SKILL.md"))).toBe(true);
    // The CLI target of the fixture adds a project MCP file through api.MCP_COMMAND, like the official plugin's CLI target.
    expect(JSON.parse(read(root, ".agents/mcp_config.json"))).toEqual({ mcpServers: { ambykit: { command: "ambykit", args: ["mcp"] } } });
  });

  it("036:FR-003: whether the target is marked as moved changes nothing about what the plugin emits (byte-identical)", async () => {
    const tools = ["claude", "skills-target", "skills-target-cli"];
    const config = { tools, plugins: { [PLUGIN]: "1.0.0" }, config: { mcp: { enabled: true } } };
    const plain = pluginProject(config);
    await runCommand(new SyncCommand(), plain, []);

    MOVED_TARGETS["skills-target"] = MOVED;
    MOVED_TARGETS["skills-target-cli"] = MOVED;
    const moved = pluginProject(config);
    await runCommand(new SyncCommand(), moved, []);

    for (const rel of [".agents/skills/amby-specify/SKILL.md", ".agents/skills/amby-plan/SKILL.md", ".agents/mcp_config.json", ".claude/commands/amby.specify.md"]) {
      expect(read(moved, rel), rel).toBe(read(plain, rel));
    }
  });

  it("036:FR-003: a second sync changes nothing, and check passes", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["claude", "skills-target"], plugins: { [PLUGIN]: "1.0.0" } });
    expect((await runCommand(new SyncCommand(), root, [])).code).toBe(0);
    const again = await runCommand(new SyncCommand(), root, []);
    expect(again.code).toBe(0);
    expect(text(again)).toMatch(/Synced 0 file\(s\)/);
    writeFileSync(join(root, ".amby", "constitution.md"), "# Constitution\n"); // check also wants a constitution; unrelated to plugins
    const check = await runCommand(new CheckCommand(), root, []);
    expect(check.code).toBe(0);
    expect(text(check)).not.toMatch(/moved to the plugin/);
  });
});

describe("built-in targets are unchanged by the move (036:FR-001)", () => {
  afterEach(() => {
    delete MOVED_TARGETS["skills-target"];
  });

  it("036:FR-001: claude and cursor write identical files with or without a moved plugin target next to them", async () => {
    const without = pluginProject({ tools: ["claude", "cursor", "opencode"] });
    await runCommand(new SyncCommand(), without, []);

    MOVED_TARGETS["skills-target"] = MOVED;
    const withMoved = pluginProject({ tools: ["claude", "cursor", "opencode", "skills-target"], plugins: { [PLUGIN]: "1.0.0" } });
    await runCommand(new SyncCommand(), withMoved, []);

    for (const rel of [".claude/commands/amby.specify.md", ".claude/commands/amby.plan.md", ".opencode/commands/amby.specify.md", "CLAUDE.md"]) {
      expect(existsSync(join(without, rel)), rel).toBe(true);
      expect(read(withMoved, rel), rel).toBe(read(without, rel));
    }
  });

  it("036:FR-001: a project that lists no moved target and no plugin never loads the plugin machinery (exit 0, no notices)", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["claude", "codex"] });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(text(r)).not.toMatch(/plugin/i);
  });
});
