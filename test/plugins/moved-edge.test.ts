import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CheckCommand } from "../../src/cli/check.js";
import { SyncCommand } from "../../src/cli/sync.js";
import { UpdateCommand } from "../../src/cli/update.js";
import { MOVED_TARGETS } from "../../src/core/moved-targets.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

/**
 * Feature 036, US-1 (T023, TC-018, TC-019, TC-020): the edges of a moved target whose plugin is not usable. Each case fails that
 * target only: the reason the plugin was refused and the install and config lines are both printed, the other targets still sync,
 * the exit is non-zero, and nothing is installed or written outside the project (FR-004, FR-005, FR-006).
 */

const PLUGIN = "ambykit-emitter-skills-target";
const text = (r: { out: string; err: string }): string => `${r.out}\n${r.err}`;
const MOVED = { package: PLUGIN, since: "2.0.0" };

/** The fixture plugin installed under node_modules with its package.json rewritten (version, plugin API range). */
function withPackage(root: string, over: Record<string, unknown>): void {
  const file = join(root, "node_modules", PLUGIN, "package.json");
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), ...over }));
}

function constitution(root: string): void {
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "constitution.md"), "# Constitution\n"); // check also wants one; unrelated to plugins
}

function tree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else out.push(abs.slice(root.length + 1).replaceAll("\\", "/"));
    }
  };
  walk(root);
  return out.sort();
}

describe("a moved target whose plugin is not usable (036:FR-004)", () => {
  afterEach(() => {
    delete MOVED_TARGETS["skills-target"];
  });

  it("036:FR-004: installed but not listed in config: the target is unavailable, the notice says to list it, the others sync (exit 1)", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["claude", "skills-target"], install: [PLUGIN] });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Target 'skills-target' moved to the plugin ambykit-emitter-skills-target/);
    expect(text(r)).toContain('list it under "plugins" in .amby/config.json');
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
    expect(existsSync(join(root, ".agents", "skills"))).toBe(false); // nothing was loaded on the plugin's behalf
  });

  it("036:FR-004: listed with a version that does not match the installed one: both the mismatch and the install line are printed", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["claude", "skills-target"], plugins: { [PLUGIN]: "1.0.1" }, install: [PLUGIN] });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/installed version 1\.0\.0 does not match the pin 1\.0\.1/);
    expect(text(r)).toMatch(/Target 'skills-target' moved to the plugin/);
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
  });

  it("036:FR-004: a plugin that needs a newer plugin API than this AmbyKit provides: check says so and names the moved target", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["claude", "skills-target"], plugins: { [PLUGIN]: "1.0.0" } });
    withPackage(root, { ambykit: { pluginApi: "^3" } });
    constitution(root);
    const r = await runCommand(new CheckCommand(), root, []);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/requires plugin API \^3, but this AmbyKit provides 2\.0\.0/);
    expect(text(r)).toMatch(/Target 'skills-target' moved to the plugin/);
  });

  it("036:FR-004: sync reports the same outdated plugin and still syncs the other targets", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["claude", "skills-target"], plugins: { [PLUGIN]: "1.0.0" } });
    withPackage(root, { ambykit: { pluginApi: "^3" } });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/requires plugin API \^3/);
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
  });

  it("036:FR-004: a plugin written for the 1.x API still loads, with a note, and the moved target works (exit 0)", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["claude", "skills-target"], plugins: { [PLUGIN]: "1.0.0" } });
    withPackage(root, { ambykit: { pluginApi: "^1" } });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(text(r)).toMatch(/declares the 1\.x plugin API/);
    expect(existsSync(join(root, ".agents", "skills", "amby-specify", "SKILL.md"))).toBe(true);
  });
});

describe("update with no registry access (036:FR-004, FR-006)", () => {
  afterEach(() => {
    delete MOVED_TARGETS["skills-target"];
  });

  /** `update` as it runs offline: the latest version is unknown, and any attempt to install the CLI is recorded. */
  class OfflineUpdate extends UpdateCommand {
    installs = 0;
    protected override async latestVersion(): Promise<string | null> {
      return null;
    }
    protected override installCli(): boolean {
      this.installs += 1;
      return false;
    }
  }

  it("036:FR-004: it does not try to install anything, refreshes the other targets, names the moved target and exits 1", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["claude", "skills-target"] });
    mkdirSync(join(root, "specs"), { recursive: true });
    const cmd = new OfflineUpdate();
    const r = await runCommand(cmd, root, []);
    expect(cmd.installs).toBe(0);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Target 'skills-target' moved to the plugin ambykit-emitter-skills-target/);
    expect(text(r)).toContain("npm install --save-exact ambykit-emitter-skills-target");
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
    expect(existsSync(join(root, "node_modules", PLUGIN))).toBe(false);
  });

  it("036:FR-006: with --dry-run it writes nothing at all, and still says which package to install", async () => {
    MOVED_TARGETS["skills-target"] = MOVED;
    const root = pluginProject({ tools: ["claude", "skills-target"] });
    mkdirSync(join(root, "specs"), { recursive: true });
    const before = tree(root);
    const cmd = new OfflineUpdate();
    const r = await runCommand(cmd, root, [], { "dry-run": true });
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Target 'skills-target' moved to the plugin/);
    expect(tree(root)).toEqual(before);
    expect(cmd.installs).toBe(0);
  });
});
