import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AddCommand } from "../../src/cli/add.js";
import { CheckCommand } from "../../src/cli/check.js";
import { SyncCommand } from "../../src/cli/sync.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

const sync = (root: string, flags: Record<string, string | boolean> = {}) => runCommand(new SyncCommand(), root, [], flags);
const text = (r: { out: string; err: string }) => `${r.out}\n${r.err}`;

describe("ambykit sync with plugins (feature 027)", () => {
  const FAKE = { "ambykit-emitter-fake": "1.2.3" };

  it("027:FR-003: a listed plugin's target is emitted like a built-in, and sync names the plugin", async () => {
    const root = pluginProject({ tools: ["claude", "fake"], plugins: FAKE });
    const r = await sync(root);
    expect(r.code).toBe(0);
    expect(existsSync(join(root, ".fake", "commands", "amby.specify.md"))).toBe(true);
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
    expect(readFileSync(join(root, ".fake", "commands", "amby.specify.md"), "utf8")).toMatch(/^---\ndescription: "/);
    expect(text(r)).toMatch(/Plugin ambykit-emitter-fake@1\.2\.3/);
  });

  it("027:FR-008: the plugin is named on every run, including --check", async () => {
    const root = pluginProject({ tools: ["fake"], plugins: FAKE });
    await sync(root);
    for (const flags of [{}, { check: true }]) {
      const r = await sync(root, flags);
      expect(text(r), JSON.stringify(flags)).toMatch(/Plugin ambykit-emitter-fake@1\.2\.3/);
    }
  });

  it("027:FR-011: sync prints the experimental note when a plugin loads", async () => {
    const root = pluginProject({ tools: ["fake"], plugins: FAKE });
    expect(text(await sync(root))).toMatch(/plugin API \(1\.0\.0\) is experimental in 1\.6/);
  });

  it("027:FR-017: a second sync over the same plugins changes nothing, and --check is clean", async () => {
    const root = pluginProject({ tools: ["claude", "fake"], plugins: FAKE });
    await sync(root);
    const again = await sync(root);
    expect(again.code).toBe(0);
    expect(text(again)).toMatch(/Synced 0 file/);
    const check = await sync(root, { check: true });
    expect(check.code).toBe(0);
    expect(text(check)).toMatch(/In sync/);
  });

  it("027:FR-004: a listed package that is not installed is reported, other targets sync, and it exits 1", async () => {
    const root = pluginProject({ tools: ["claude", "fake"], plugins: { "ambykit-emitter-fake": "1.2.3" }, install: [] });
    const r = await sync(root);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Plugin ambykit-emitter-fake was not loaded: not installed/);
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
    expect(existsSync(join(root, ".fake"))).toBe(false);
  });

  it("027:FR-004: a pin that does not match the installed version is reported and exits 1", async () => {
    const root = pluginProject({ tools: ["claude", "fake"], plugins: { "ambykit-emitter-fake": "1.2.4" }, install: ["ambykit-emitter-fake"] });
    const r = await sync(root);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/installed version 1\.2\.3 does not match the pin 1\.2\.4/);
    expect(existsSync(join(root, ".fake"))).toBe(false);
  });

  it("027:FR-005: a plugin target that collides with a built-in is reported, the built-in is untouched, and it exits 1", async () => {
    const root = pluginProject({ tools: ["claude"], plugins: { "ambykit-emitter-collide": "1.0.0" } });
    const r = await sync(root);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Plugin ambykit-emitter-collide defines target 'claude', which is already a built-in target/);
    expect(existsSync(join(root, ".collide"))).toBe(false);
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);
  });

  it("027:FR-005: two plugins defining one target id: the first wins, the second is reported", async () => {
    const root = pluginProject({ tools: ["fake"], plugins: { "ambykit-emitter-fake": "1.2.3", "ambykit-emitter-fake2": "1.0.0" } });
    const r = await sync(root);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Plugin ambykit-emitter-fake2 defines target 'fake'.*plugin ambykit-emitter-fake/);
    expect(existsSync(join(root, ".fake", "commands", "amby.specify.md"))).toBe(true);
    expect(existsSync(join(root, ".faketwin"))).toBe(false);
  });

  it("027:FR-007: a plugin that writes outside the project fails the sync and names the plugin", async () => {
    const root = pluginProject({ tools: ["escape"], plugins: { "ambykit-emitter-escape": "1.0.0" } });
    const r = await sync(root);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/ambykit-emitter-escape@1\.0\.0\) tried to write outside the project/);
  });
});

describe("ambykit check and add with plugins (feature 027)", () => {
  const FAKE = { "ambykit-emitter-fake": "1.2.3" };

  it("027:FR-003: check validates a plugin-provided target and is healthy after a sync", async () => {
    const root = pluginProject({ tools: ["claude", "fake"], plugins: FAKE });
    writeFileSync(join(root, ".amby", "constitution.md"), "# Constitution\n");
    await sync(root);
    const r = await runCommand(new CheckCommand(), root, []);
    expect(text(r)).not.toMatch(/not a known target/);
    expect(text(r)).toMatch(/Plugin ambykit-emitter-fake@1\.2\.3/);
    expect(text(r)).toMatch(/Healthy/);
  });

  it("027:FR-004: check reports a plugin that is not loaded", async () => {
    const root = pluginProject({ tools: ["fake"], plugins: FAKE, install: [] });
    const r = await runCommand(new CheckCommand(), root, []);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Plugin ambykit-emitter-fake was not loaded/);
  });

  it("027:FR-003: add accepts a plugin target id when its plugin loads, and emits it", async () => {
    const root = pluginProject({ plugins: FAKE });
    const r = await runCommand(new AddCommand(), root, ["fake"]);
    expect(r.code).toBe(0);
    expect(existsSync(join(root, ".fake", "commands", "amby.specify.md"))).toBe(true);
    expect(JSON.parse(readFileSync(join(root, ".amby", "config.json"), "utf8")).plugins).toEqual(FAKE);
  });

  it("027:FR-006: add refuses a plugin target id when its plugin does not load", async () => {
    const root = pluginProject({ plugins: FAKE, install: [] });
    const r = await runCommand(new AddCommand(), root, ["fake"]);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Unknown target\(s\): fake/);
    expect(text(r)).toMatch(/Plugin ambykit-emitter-fake was not loaded/);
  });

  it("027:FR-003: add lists plugin targets among the available ones", async () => {
    const root = pluginProject({ plugins: FAKE });
    const r = await runCommand(new AddCommand(), root, ["nope"]);
    expect(r.code).toBe(1);
    expect(text(r)).toMatch(/Available:.*claude.*fake/);
  });
});
