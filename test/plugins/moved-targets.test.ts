import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { SyncCommand } from "../../src/cli/sync.js";
import { MOVED_TARGETS, movedTarget, movedTargetNotices } from "../../src/core/moved-targets.js";
import { TARGETS } from "../../src/emitters/index.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAP = { gemini: { package: "ambykit-emitter-gemini", since: "1.7.0" } };

describe("moved targets (feature 027, US-5)", () => {
  afterEach(() => {
    delete MOVED_TARGETS["gone-target"];
  });

  it("027:FR-014: a configured target that moved gets a notice naming the package to install", () => {
    const notices = movedTargetNotices(["claude", "gemini"], (id) => id === "claude", MAP);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(/Target 'gemini' moved to the plugin ambykit-emitter-gemini \(since 1\.7\.0\)/);
    expect(notices[0]).toMatch(/npm install --save-exact ambykit-emitter-gemini/);
    expect(notices[0]).toMatch(/Files already written for it are left in place/);
  });

  it("027:FR-014: no notice for a target that is still available, was never moved, or is provided by a loaded plugin", () => {
    expect(movedTargetNotices(["gemini"], () => true, MAP)).toEqual([]);
    expect(movedTargetNotices(["unknown-thing"], () => false, MAP)).toEqual([]);
    expect(movedTarget("gemini", MAP)?.package).toBe("ambykit-emitter-gemini");
    expect(movedTarget("toString", MAP)).toBeUndefined();
  });

  it("027:FR-013: nothing moved in 1.6: the map is empty and every built-in target is still bundled", () => {
    expect(Object.keys(MOVED_TARGETS)).toEqual([]);
    expect(TARGETS).toHaveLength(18);
  });

  it("027:FR-014: sync prints the notice for a moved target and removes none of its files", async () => {
    MOVED_TARGETS["gone-target"] = { package: "ambykit-emitter-gone-target", since: "9.9.9" };
    const root = pluginProject({ tools: ["claude", "gone-target"] });
    const old = join(root, ".gone", "commands", "amby.specify.md");
    mkdirSync(dirname(old), { recursive: true });
    writeFileSync(old, "written by an earlier release\n");
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(`${r.out}\n${r.err}`).toMatch(/Target 'gone-target' moved to the plugin ambykit-emitter-gone-target/);
    expect(existsSync(old)).toBe(true);
    expect(readFileSync(old, "utf8")).toBe("written by an earlier release\n");
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
  });

  it("027:FR-013: docs/plugin-split.md lists all 18 targets with a status and churn evidence", () => {
    const doc = readFileSync(join(ROOT, "docs", "plugin-split.md"), "utf8");
    for (const t of TARGETS) expect(doc, t.id).toMatch(new RegExp(`\\| \`${t.id}\` \\|`));
    const rows = doc.split("\n").filter((l) => /^\| `[a-z-]+` \|/.test(l));
    expect(rows).toHaveLength(18);
    for (const row of rows) expect(row, row).toMatch(/built in|plugin candidate/);
    expect(doc).toMatch(/2\.0 gate/);
  });
});
