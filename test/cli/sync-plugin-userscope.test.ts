import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SyncCommand } from "../../src/cli/sync.js";
import { pluginProject } from "../helpers/plugin-project.js";
import { runCommand } from "../helpers/run-command.js";

const sync = (root: string, flags: Record<string, string | boolean> = {}) => runCommand(new SyncCommand(), root, [], flags);

describe("plugin files outside the project (feature 027, FR-007)", () => {
  const saved = { home: process.env["HOME"], profile: process.env["USERPROFILE"] };
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "ambykit-home-"));
    process.env["HOME"] = home; // user-level files must never reach the real home directory
    process.env["USERPROFILE"] = home;
  });
  afterEach(() => {
    if (saved.home === undefined) delete process.env["HOME"];
    else process.env["HOME"] = saved.home;
    if (saved.profile === undefined) delete process.env["USERPROFILE"];
    else process.env["USERPROFILE"] = saved.profile;
  });

  const project = () => pluginProject({ tools: ["userscope"], plugins: { "ambykit-emitter-user": "1.0.0" } });

  it("027:FR-007: a user-scope file is not written without --include-user, the project files are", async () => {
    const root = project();
    const r = await sync(root);
    expect(r.code).toBe(0);
    expect(existsSync(join(root, ".userscope", "commands", "a.md"))).toBe(true);
    expect(existsSync(join(home, ".userscope", "global.json"))).toBe(false);
  });

  it("027:FR-007: --include-user is the recorded consent that writes it, into the home directory only", async () => {
    const root = project();
    const r = await sync(root, { "include-user": true });
    expect(r.code).toBe(0);
    expect(existsSync(join(home, ".userscope", "global.json"))).toBe(true);
    expect(existsSync(join(root, ".userscope", "global.json"))).toBe(false);
  });

  it("027:FR-007: user-scope plugin files never take part in sync --check", async () => {
    const root = project();
    await sync(root); // without consent: the user file does not exist
    const check = await sync(root, { check: true });
    expect(check.code).toBe(0);
    expect(existsSync(join(home, ".userscope", "global.json"))).toBe(false);
    // Even with the file present and changed, --check ignores it.
    const withUser = await sync(root, { check: true, "include-user": true });
    expect(withUser.code).toBe(0);
    expect(existsSync(join(home, ".userscope", "global.json"))).toBe(false);
  });
});
