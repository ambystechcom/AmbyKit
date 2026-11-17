import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// If anything imports the plugin loader, this factory throws and the test fails (FR-016: no plugins, no loader).
vi.mock("../../src/plugins/loader.js", () => {
  throw new Error("the plugin loader was imported although no plugin is listed");
});

import { SyncCommand } from "../../src/cli/sync.js";
import { buildEmittedFiles } from "../../src/core/emit.js";
import { TARGETS } from "../../src/emitters/index.js";
import { loadPluginSession } from "../../src/plugins/session.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

const ALL = TARGETS.map((t) => t.id);
const text = (r: { out: string; err: string }) => `${r.out}\n${r.err}`;

describe("projects with no plugins are unchanged (feature 027, US-8)", () => {
  it("027:FR-016: no plugins key: the session is undefined and the loader is never imported", async () => {
    const root = pluginProject({ tools: ALL });
    expect(await loadPluginSession(root, {})).toBeUndefined();
    expect(await loadPluginSession(root, { plugins: {} })).toBeUndefined();
  });

  it("027:FR-016: sync writes exactly the built-in output for every target, and prints nothing about plugins", async () => {
    const root = pluginProject({ tools: ALL });
    const r = await runCommand(new SyncCommand(), root, []);
    expect(r.code).toBe(0);
    expect(text(r)).not.toMatch(/plugin/i);
    // `sync` installs the default roles first, so compute the built-in output after it ran (no registry given).
    const expected = buildEmittedFiles(root, { version: "0.0.0", tools: ALL });
    for (const f of expected.filter((x) => x.scope === "project" && x.merge !== "region")) {
      expect(existsSync(join(root, f.path)), f.path).toBe(true);
      expect(readFileSync(join(root, f.path), "utf8"), f.path).toBe(f.contents);
    }
  });

  it("027:FR-016: an empty plugins map behaves like an absent one", async () => {
    const a = pluginProject({ tools: ALL });
    const b = pluginProject({ tools: ALL, plugins: {} });
    const ra = await runCommand(new SyncCommand(), a, []);
    const rb = await runCommand(new SyncCommand(), b, []);
    expect(rb.code).toBe(ra.code);
    expect(text(rb)).toBe(text(ra));
  });

  it("027:FR-016: the second sync is a no-op and --check is clean with no plugins", async () => {
    const root = pluginProject({ tools: ALL });
    await runCommand(new SyncCommand(), root, []);
    const again = await runCommand(new SyncCommand(), root, []);
    expect(text(again)).toMatch(/Synced 0 file/);
    expect((await runCommand(new SyncCommand(), root, [], { check: true })).code).toBe(0);
  });
});
