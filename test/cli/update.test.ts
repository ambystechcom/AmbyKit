import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { UpdateCommand } from "../../src/cli/update.js";
import { packageVersion } from "../../src/core/paths.js";
import type { CliOptions } from "../../src/cli/base-command.js";

/** Drives the CLI-update seams without spawning npm or hitting the network. */
class TestUpdate extends UpdateCommand {
  constructor(
    private readonly latest: string | null,
    private readonly installOk: boolean,
  ) {
    super();
  }
  protected override async latestVersion(): Promise<string | null> {
    return this.latest;
  }
  protected override installCli(): boolean {
    return this.installOk;
  }
}

async function run(cmd: UpdateCommand, cwd: string = process.cwd()): Promise<{ code: number; out: string }> {
  const out: string[] = [];
  const log = console.log;
  const err = console.error;
  console.log = (...a: unknown[]) => void out.push(a.join(" "));
  console.error = (...a: unknown[]) => void out.push(a.join(" "));
  const opts: CliOptions = { cwd, positionals: [], flags: {} };
  try {
    const code = await cmd.run(opts);
    return { code, out: out.join("\n") };
  } finally {
    console.log = log;
    console.error = err;
  }
}

/** A minimal AmbyKit project at cwd: `.amby/config.json` + a `specs/` dir (projectAtCwd needs both). */
function project(tools: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-update-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools }));
  mkdirSync(join(root, "specs"), { recursive: true });
  return root;
}

/** `update` on a CLI that is already current → goes straight to the project prompt refresh. */
const currentUpdate = () => new TestUpdate(packageVersion(), false);

afterEach(() => {
  delete process.env["AMBYKIT_CACHE_DIR"];
});

describe("ambykit update — CLI self-update (feature 010 / US-2)", () => {
  it("updates when outdated and asks the user to re-run (FR-006, R-5)", async () => {
    const { code, out } = await run(new TestUpdate("999.0.0", true));
    expect(code).toBe(0);
    expect(out).toContain("999.0.0");
    expect(out).toMatch(/Re-run .*ambykit update/);
  });

  it("prints the manual command and keeps the install intact on failure (FR-011)", async () => {
    const { code, out } = await run(new TestUpdate("999.0.0", false));
    expect(code).toBe(1);
    expect(out).toContain("npm install -g @ambystech/ambykit@latest");
  });

  it("does not attempt an install when already current", async () => {
    // latest == installed → not outdated → no update path, no re-run message.
    const { code, out } = await run(new TestUpdate(packageVersion(), false));
    expect(code).toBe(0);
    expect(out).not.toMatch(/Re-run .*ambykit update/);
  });
});

describe("ambykit update — project prompt refresh (feature 010 / US-3)", () => {
  it("refreshes stale prompts in a project, then reports up to date on a re-run (FR-007/008, SC-004)", async () => {
    const root = project(["claude"]);

    const first = await run(currentUpdate(), root);
    expect(first.code).toBe(0);
    expect(first.out).toMatch(/Refreshed \d+ prompt file/);
    expect(existsSync(join(root, ".claude", "commands", "amby.specify.md"))).toBe(true);

    // Re-run is idempotent → nothing to write → the exact up-to-date message (check stays green).
    const second = await run(currentUpdate(), root);
    expect(second.out).toContain("Everything is up to date.");
  });

  it("skips the prompt refresh outside an AmbyKit project (FR-010)", async () => {
    const notAProject = mkdtempSync(join(tmpdir(), "ambykit-noproj-"));
    const { code, out } = await run(currentUpdate(), notAProject);
    expect(code).toBe(0);
    expect(out).toMatch(/Not in an AmbyKit project/);
  });
});
