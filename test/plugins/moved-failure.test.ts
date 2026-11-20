import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CheckCommand } from "../../src/cli/check.js";
import { SyncCommand } from "../../src/cli/sync.js";
import { UpdateCommand } from "../../src/cli/update.js";
import { legacyWorkflowFiles } from "../../src/core/legacy.js";
import { MOVED_TARGETS } from "../../src/core/moved-targets.js";
import { packageVersion } from "../../src/core/paths.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

/**
 * Feature 036, US-1 (phase 2): a configured target that moved to a plugin whose package is not installed fails
 * that target only. `sync`, `check` and `update` name it and print the install and config lines, keep processing the
 * other targets, exit non-zero, and delete or rewrite nothing it emitted earlier (FR-004, FR-005).
 */

class CurrentUpdate extends UpdateCommand {
  protected override async latestVersion(): Promise<string | null> {
    return packageVersion();
  }
}

const GONE = { package: "ambykit-emitter-gone-target", since: "2.0.0" };

/** A project listing two built-in targets and the moved one, with a file the moved target wrote in an earlier release. */
function movedProject(): { root: string; old: string } {
  MOVED_TARGETS["gone-target"] = GONE;
  const root = pluginProject({ tools: ["claude", "codex", "gone-target"] });
  mkdirSync(join(root, "specs"), { recursive: true });
  const old = join(root, ".gone", "commands", "amby.specify.md");
  mkdirSync(dirname(old), { recursive: true });
  writeFileSync(old, "written by an earlier release\n");
  return { root, old };
}

const text = (r: { out: string; err: string }): string => `${r.out}\n${r.err}`;

describe("a moved target with no plugin fails only that target (feature 036, FR-004, FR-005)", () => {
  afterEach(() => {
    delete MOVED_TARGETS["gone-target"];
  });

  it("036:FR-004: sync names the target, prints the install and config lines, still syncs the others and exits 1", async () => {
    const { root } = movedProject();
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Target 'gone-target' moved to the plugin ambykit-emitter-gone-target \(since 2\.0\.0\)/);
    expect(text(r)).toMatch(/npm install --save-exact ambykit-emitter-gone-target/);
    expect(text(r)).toMatch(/list it under "plugins" in \.amby\/config\.json/);
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
    expect(existsSync(join(root, ".agents", "skills", "amby-specify", "SKILL.md"))).toBe(true);
  });

  it("036:FR-005: nothing the moved target wrote earlier is deleted or changed", async () => {
    const { root, old } = movedProject();
    await runCommand(new SyncCommand(), root, []);
    expect(existsSync(old)).toBe(true);
    expect(readFileSync(old, "utf8")).toBe("written by an earlier release\n");
  });

  it("036:FR-004: check reports the moved target once, with the install line, and fails", async () => {
    const { root } = movedProject();
    const r = await runCommand(new CheckCommand(), root, []);
    expect(r.code).toBe(1);
    const all = text(r);
    expect(all.match(/Target 'gone-target' moved to the plugin/g)).toHaveLength(1);
    expect(all).not.toMatch(/'gone-target' is not a known target/);
  });

  it("036:FR-004, FR-005: update refreshes the other targets, names the moved one, exits 1 and leaves its files alone", async () => {
    const { root, old } = movedProject();
    const r = await runCommand(new CurrentUpdate(), root, []);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Target 'gone-target' moved to the plugin ambykit-emitter-gone-target/);
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
    expect(readFileSync(old, "utf8")).toBe("written by an earlier release\n");
  });

  it("036:FR-004: a project that lists only built-in targets is unaffected (exit 0)", async () => {
    MOVED_TARGETS["gone-target"] = GONE;
    const root = pluginProject({ tools: ["claude", "codex"] });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(text(r)).not.toMatch(/moved to the plugin/);
  });
});

describe("a moved target provided by an installed, listed plugin (feature 036, FR-003)", () => {
  afterEach(() => {
    delete MOVED_TARGETS["skills-target"];
  });

  it("036:FR-003: no failure, and the plugin's files are emitted next to the built-in targets'", async () => {
    MOVED_TARGETS["skills-target"] = { package: "ambykit-emitter-skills-target", since: "2.0.0" };
    const root = pluginProject({ tools: ["claude", "skills-target"], plugins: { "ambykit-emitter-skills-target": "1.0.0" } });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(text(r)).not.toMatch(/moved to the plugin/);
    expect(existsSync(join(root, ".agents", "skills", "amby-specify", "SKILL.md"))).toBe(true);
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
  });
});

describe("registry-aware lookups (feature 036, T012, FR-003)", () => {
  const stale = (): string => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-legacy-"));
    const file = join(root, ".agents", "workflows", "amby.specify.md");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "<!-- GENERATED by AmbyKit -->\nold workflow\n");
    return root;
  };
  const cfg = { version: "0.0.0", tools: ["agy"] };
  // A plugin target whose emitter reports the Antigravity tool id, as the official plugin's does.
  const registry = {
    targets: [{ id: "agy", displayName: "Agy", emitter: { toolId: "antigravity" } as never }],
  };

  it("036:FR-003: stale Antigravity workflows are found for a target the plugin registry provides", () => {
    expect(legacyWorkflowFiles(stale(), cfg as never, registry)).toEqual([".agents/workflows/amby.specify.md"]);
  });

  it("036:FR-003: without the registry the plugin's id is invisible, which is why the callers now pass it", () => {
    expect(legacyWorkflowFiles(stale(), cfg as never)).toEqual([]);
  });
});
