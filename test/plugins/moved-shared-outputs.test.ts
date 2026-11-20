import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CheckCommand } from "../../src/cli/check.js";
import { SyncCommand } from "../../src/cli/sync.js";
import { MOVED_TARGETS } from "../../src/core/moved-targets.js";
import { TARGETS, sharedOutputs } from "../../src/emitters/index.js";
import { buildRegistry } from "../../src/plugins/registry.js";
import { loadPlugins } from "../../src/plugins/loader.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

/**
 * Feature 036, US-1 (T022, TC-017): `codex` (built in) and a plugin target both write `.agents/skills`, like Codex and the moved
 * Antigravity targets do today. The files are written once, the plugin's target counts as a co-owner, and removing one owner from
 * the config leaves the shared files for the other (FR-003, R3). The fixture plugin's targets (`skills-target`, `skills-target-cli`)
 * write the same directory as the official Antigravity plugin.
 */

const PLUGIN = "ambykit-emitter-skills-target";
const SPECIFY = ".agents/skills/amby-specify/SKILL.md";
const MOVED = { package: PLUGIN, since: "2.0.0" };

const config = (tools: string[]): string => JSON.stringify({ version: "0.0.0", tools, manageRules: false, plugins: { [PLUGIN]: "1.0.0" } });

describe("a plugin target sharing .agents/skills with codex (036:FR-003)", () => {
  afterEach(() => {
    delete MOVED_TARGETS["skills-target"];
    delete MOVED_TARGETS["skills-target-cli"];
  });

  it("036:FR-003: the plugin's targets are listed as co-owners of the directory, in config order", async () => {
    const root = pluginProject({ tools: ["codex"], plugins: { [PLUGIN]: "1.0.0" } });
    const { loaded } = await loadPlugins(root, { [PLUGIN]: "1.0.0" });
    const registry = buildRegistry(TARGETS, loaded);
    expect(sharedOutputs(["codex", "skills-target", "skills-target-cli"], registry)).toEqual([
      { dir: ".agents/skills", owners: ["codex", "skills-target", "skills-target-cli"] },
    ]);
    // Without the registry the plugin's ids are unknown, so the directory looks unshared: the reason every caller passes it (T012).
    expect(sharedOutputs(["codex", "skills-target"])).toEqual([]);
  });

  it("036:FR-003: sync writes each shared skill once, carrying codex's id, and check names every owner", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    MOVED_TARGETS["skills-target-cli"] = MOVED;
    const root = pluginProject({ tools: ["codex", "skills-target", "skills-target-cli"], plugins: { [PLUGIN]: "1.0.0" }, config: { manageRules: false } });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(readFileSync(join(root, SPECIFY), "utf8")).toContain("--agent=codex");
    writeFileSync(join(root, ".amby", "constitution.md"), "# Constitution\n"); // check also wants a constitution
    const check = await runCommand(new CheckCommand(), root, []);
    expect(`${check.out}\n${check.err}`).toMatch(/\.agents\/skills\/ is owned by: codex, skills-target, skills-target-cli/);
  });

  it("036:FR-003: removing the plugin target from the config leaves the shared files, unchanged, for codex", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["codex", "skills-target"], plugins: { [PLUGIN]: "1.0.0" }, config: { manageRules: false } });
    await runCommand(new SyncCommand(), root, []);
    const before = readFileSync(join(root, SPECIFY), "utf8");

    writeFileSync(join(root, ".amby", "config.json"), config(["codex"]));
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(existsSync(join(root, SPECIFY))).toBe(true);
    expect(readFileSync(join(root, SPECIFY), "utf8")).toBe(before);
  });

  it("036:FR-003: removing codex leaves the shared files for the plugin target, which now rewrites nothing it must not", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["codex", "skills-target"], plugins: { [PLUGIN]: "1.0.0" }, config: { manageRules: false } });
    await runCommand(new SyncCommand(), root, []);
    expect(readFileSync(join(root, SPECIFY), "utf8")).toContain("--agent=codex");

    writeFileSync(join(root, ".amby", "config.json"), config(["skills-target"]));
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(existsSync(join(root, SPECIFY))).toBe(true);
    // The skill still exists; it now reports the remaining owner's id, which is the file's only change.
    expect(readFileSync(join(root, SPECIFY), "utf8")).toContain("--agent=skills-target");
  });

  it("036:FR-005: when the plugin is missing, the shared files codex still owns are kept and codex keeps syncing", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["codex", "skills-target"], plugins: { [PLUGIN]: "1.0.0" }, config: { manageRules: false } });
    await runCommand(new SyncCommand(), root, []);
    const before = readFileSync(join(root, SPECIFY), "utf8");

    // The plugin disappears (uninstalled) while the config still lists the target.
    writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: ["codex", "skills-target"], manageRules: false }));
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(1);
    expect(`${r.out}\n${r.err}`).toMatch(/Target 'skills-target' moved to the plugin ambykit-emitter-skills-target/);
    expect(readFileSync(join(root, SPECIFY), "utf8")).toBe(before);
  });
});
