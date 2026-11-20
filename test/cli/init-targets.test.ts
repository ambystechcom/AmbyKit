import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AddCommand } from "../../src/cli/add.js";
import { InitCommand } from "../../src/cli/init.js";
import { SyncCommand } from "../../src/cli/sync.js";
import { toolOptions } from "../../src/cli/ui/tool-options.js";
import { DEPRECATED_TARGETS, MOVED_TARGETS, PLANNED_DEPRECATED_TARGETS, deprecatedTargetNotices } from "../../src/core/moved-targets.js";
import { TARGETS } from "../../src/emitters/index.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

/**
 * Feature 036, US-3 (T042): `init` and `add` list built-in targets and show a moved one as "official plugin, install first" with the
 * install line; choosing one is refused with the same instructions and writes nothing (FR-006, FR-010). Bundled targets that will
 * move get a notice, not a change (FR-002, C-4). Before the 2.0 switch nothing has moved, so these only run through the mechanism
 * with a stand-in target (`gone-a`), exactly like the sync, check and update tests.
 */

const PACKAGE = "@ambystech/ambykit-emitter-gone";
const GONE = { package: PACKAGE, since: "2.0.0", displayName: "Gone A" };
const PLUGIN = "ambykit-emitter-skills-target";
const text = (r: { out: string; err: string }): string => `${r.out}\n${r.err}`;

const project = (tools: string[]): string => {
  const root = pluginProject({ tools });
  mkdirSync(join(root, "specs"), { recursive: true });
  return root;
};
const configOf = (root: string): string => readFileSync(join(root, ".amby", "config.json"), "utf8");

afterEach(() => {
  delete MOVED_TARGETS["gone-a"];
  delete MOVED_TARGETS["skills-target"];
  for (const id of Object.keys(PLANNED_DEPRECATED_TARGETS)) delete DEPRECATED_TARGETS[id];
});

describe("the tool pickers (036:FR-010)", () => {
  it("036:FR-010: with nothing moved the list is exactly the registry's, aliases hidden", () => {
    const options = toolOptions();
    expect(options).toEqual(TARGETS.filter((t) => !t.alias).map((t) => ({ value: t.id, label: t.displayName })));
    expect(options.some((o) => /official plugin/.test(o.label))).toBe(false);
  });

  it("036:FR-010: a moved target is listed after the built-ins, marked as an official plugin to install first, with its package", () => {
    MOVED_TARGETS["gone-a"] = GONE;
    const options = toolOptions();
    const last = options.at(-1)!;
    expect(last).toEqual({ value: "gone-a", label: `Gone A (official plugin, install first: ${PACKAGE})` });
    expect(options.slice(0, -1)).toEqual(TARGETS.filter((t) => !t.alias).map((t) => ({ value: t.id, label: t.displayName })));
  });

  it("036:FR-010: once its plugin provides the target it is listed as a normal target, not as 'install first'", () => {
    MOVED_TARGETS["gone-a"] = GONE;
    const registry = { targets: [...TARGETS, { id: "gone-a", displayName: "Gone A", emitter: TARGETS[0]!.emitter }] };
    const options = toolOptions(registry);
    expect(options.filter((o) => o.value === "gone-a")).toEqual([{ value: "gone-a", label: "Gone A" }]);
  });
});

describe("add refuses a moved target that is not available (036:FR-006, FR-010)", () => {
  it("036:FR-010: it prints the install line and the config line, exits 1 and changes nothing", async () => {
    MOVED_TARGETS["gone-a"] = GONE;
    const root = project(["claude"]);
    const before = configOf(root);
    const r = await runCommand(new AddCommand(), root, ["gone-a"]);
    expect(r.code).toBe(1);
    expect(text(r)).toContain(`Target 'gone-a' is an official plugin now (${PACKAGE}, since 2.0.0), so it is not added.`);
    expect(text(r)).toContain(`npm install --save-exact ${PACKAGE}`);
    expect(text(r)).toContain('list it under "plugins" in .amby/config.json with that exact version');
    expect(text(r)).toContain("then run `ambykit add gone-a`");
    expect(configOf(root)).toBe(before);
    expect(existsSync(join(root, ".claude"))).toBe(false);
  });

  it("036:FR-006: asking for a built-in target and a moved one adds neither: nothing is saved or emitted", async () => {
    MOVED_TARGETS["gone-a"] = GONE;
    const root = project(["claude"]);
    const before = configOf(root);
    const r = await runCommand(new AddCommand(), root, ["cursor", "gone-a"]);
    expect(r.code).toBe(1);
    expect(configOf(root)).toBe(before);
    expect(existsSync(join(root, ".cursor"))).toBe(false);
    expect(existsSync(join(root, "node_modules"))).toBe(false);
  });

  it("036:FR-010: a typo is still 'unknown', not 'moved'", async () => {
    MOVED_TARGETS["gone-a"] = GONE;
    const r = await runCommand(new AddCommand(), project(["claude"]), ["nope"]);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Unknown target\(s\): nope/);
    expect(text(r)).not.toMatch(/official plugin now/);
  });

  it("036:FR-003: when the plugin is installed and listed, add works like for any target", async () => {
    MOVED_TARGETS["skills-target"] = { package: PLUGIN, since: "2.0.0" };
    const root = pluginProject({ tools: ["claude"], plugins: { [PLUGIN]: "1.0.0" } });
    mkdirSync(join(root, "specs"), { recursive: true });
    const r = await runCommand(new AddCommand(), root, ["skills-target"]);
    expect(r.code).toBe(0);
    expect(JSON.parse(configOf(root)).tools).toEqual(["claude", "skills-target"]);
    expect(existsSync(join(root, ".agents", "skills", "amby-specify", "SKILL.md"))).toBe(true);
  });
});

describe("init refuses a moved target (036:FR-006, FR-010)", () => {
  it("036:FR-010: init --tools with a moved target names the plugin, exits 1 and creates nothing", async () => {
    MOVED_TARGETS["gone-a"] = GONE;
    const dir = join(mkdtempSync(join(tmpdir(), "ambykit-init-")), "app");
    mkdirSync(dir, { recursive: true });
    const r = await runCommand(new InitCommand(), dir, [], { tools: "claude,gone-a", yes: true });
    expect(r.code).toBe(1);
    expect(text(r)).toContain(`Target 'gone-a' is an official plugin now (${PACKAGE}, since 2.0.0)`);
    expect(existsSync(join(dir, ".amby"))).toBe(false);
    expect(existsSync(join(dir, ".claude"))).toBe(false);
  });

  it("036:FR-010: init --tools with built-in targets is unchanged", async () => {
    MOVED_TARGETS["gone-a"] = GONE;
    const dir = join(mkdtempSync(join(tmpdir(), "ambykit-init-")), "app");
    mkdirSync(dir, { recursive: true });
    const r = await runCommand(new InitCommand(), dir, [], { tools: "claude,codex", yes: true });
    expect(r.code).toBe(0);
    expect(existsSync(join(dir, ".claude", "commands", "amby.specify.md"))).toBe(true);
  });
});

describe("a bundled target that will move gets a notice and keeps working (036:FR-002, C-4)", () => {
  it("036:FR-002: the notice names the replacing package and says nothing is needed yet", () => {
    expect(deprecatedTargetNotices(["gemini", "claude", "kiro"], PLANNED_DEPRECATED_TARGETS)).toEqual([
      "Target 'gemini' is bundled for now and will move to the plugin @ambystech/ambykit-emitter-gemini once it is published. It keeps working; nothing to do yet.",
      "Target 'kiro' is bundled for now and will move to the plugin @ambystech/ambykit-emitter-kiro once it is published. It keeps working; nothing to do yet.",
    ]);
  });

  it("036:FR-002: with no deprecations (today) sync is silent about it", async () => {
    const root = project(["claude", "gemini"]);
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(text(r)).not.toMatch(/will move to the plugin/);
  });

  it("036:FR-002: with the deprecation active sync prints the notice, still writes the target's files and exits 0", async () => {
    Object.assign(DEPRECATED_TARGETS, PLANNED_DEPRECATED_TARGETS);
    const root = project(["claude", "gemini"]);
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(text(r)).toContain("Target 'gemini' is bundled for now and will move to the plugin @ambystech/ambykit-emitter-gemini");
    expect(existsSync(join(root, ".gemini"))).toBe(true);
  });
});
