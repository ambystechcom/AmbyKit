import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { UpdateCommand } from "../../src/cli/update.js";
import { MOVED_TARGETS } from "../../src/core/moved-targets.js";
import { packageVersion } from "../../src/core/paths.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

/**
 * Feature 036, US-3 (T041, FR-006): `update` tells you which package to install and what to put in the config for a target that
 * moved, and writes nothing user-level and installs nothing without your say-so. It already worked this way (it prints the lines
 * and never installs); these tests pin it so a later change cannot start installing a plugin or editing config on its own.
 */

const PLUGIN = "ambykit-emitter-skills-target";
const text = (r: { out: string; err: string }): string => `${r.out}\n${r.err}`;

/** `update` with the CLI current, recording any attempt to install a package. */
class RecordingUpdate extends UpdateCommand {
  installs = 0;
  protected override async latestVersion(): Promise<string | null> {
    return packageVersion();
  }
  protected override installCli(): boolean {
    this.installs += 1;
    return true;
  }
}

/** A throwaway home directory: set as HOME and USERPROFILE for the duration of a run, restored afterwards. */
async function withHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const home = mkdtempSync(join(tmpdir(), "ambykit-home-"));
  const saved = { HOME: process.env["HOME"], USERPROFILE: process.env["USERPROFILE"] };
  process.env["HOME"] = home;
  process.env["USERPROFILE"] = home;
  try {
    return await fn(home);
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("update for a moved target whose plugin is not installed (036:FR-006)", () => {
  afterEach(() => {
    delete MOVED_TARGETS["skills-target"];
  });

  it("036:FR-006: it offers the install line and the config line, and does not install, edit config or write a user-level file", async () => {
    MOVED_TARGETS["skills-target"] = { package: PLUGIN, since: "2.0.0" };
    const root = pluginProject({ tools: ["claude", "skills-target"], config: { mcp: { enabled: true } } });
    mkdirSync(join(root, "specs"), { recursive: true });
    const configBefore = readFileSync(join(root, ".amby", "config.json"), "utf8");
    const cmd = new RecordingUpdate();

    const r = await withHome((home) =>
      runCommand(cmd, root, []).then((res) => {
        expect(readdirSync(home), "nothing may be written to the home directory").toEqual([]);
        return res;
      }),
    );

    expect(r.code).toBe(1);
    expect(text(r)).toContain(`Target 'skills-target' moved to the plugin ${PLUGIN} (since 2.0.0).`);
    expect(text(r)).toContain(`npm install --save-exact ${PLUGIN}`);
    expect(text(r)).toContain('list it under "plugins" in .amby/config.json with that exact version');
    expect(cmd.installs).toBe(0);
    expect(readFileSync(join(root, ".amby", "config.json"), "utf8")).toBe(configBefore);
    expect(existsSync(join(root, "node_modules"))).toBe(false);
    expect(existsSync(join(root, "package.json"))).toBe(false);
  });

  it("036:FR-006: user-level MCP files are not written by update (they need --include-user on sync, which update never passes)", async () => {
    MOVED_TARGETS["skills-target"] = { package: PLUGIN, since: "2.0.0" };
    const root = pluginProject({ tools: ["copilot-cli", "skills-target"], config: { mcp: { enabled: true } } });
    mkdirSync(join(root, "specs"), { recursive: true });
    const home = await withHome(async (h) => {
      await runCommand(new RecordingUpdate(), root, []);
      return readdirSync(h);
    });
    expect(home).toEqual([]);
  });

  it("036:FR-006: once the plugin is installed and listed, update refreshes its files like any target (exit 0)", async () => {
    MOVED_TARGETS["skills-target"] = { package: PLUGIN, since: "2.0.0" };
    const root = pluginProject({ tools: ["claude", "skills-target"], plugins: { [PLUGIN]: "1.0.0" } });
    mkdirSync(join(root, "specs"), { recursive: true });
    const cmd = new RecordingUpdate();
    const r = await runCommand(cmd, root, []);
    expect(r.code).toBe(0);
    expect(cmd.installs).toBe(0);
    expect(existsSync(join(root, ".agents", "skills", "amby-specify", "SKILL.md"))).toBe(true);
    expect(text(r)).not.toMatch(/moved to the plugin/);
  });
});
