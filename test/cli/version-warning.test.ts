import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BaseCommand, type CliOptions } from "../../src/cli/base-command.js";
import type { Capabilities } from "../../src/cli/ui/types.js";

/** A minimal command that routes through BaseCommand.run() so we can observe the warning placement. */
class FakeCommand extends BaseCommand {
  readonly name = "fake";
  readonly summary = "test";
  readonly usage = "fake";
  protected override requiresProject = false;
  constructor(caps: Capabilities, private readonly content = "CONTENT") {
    super();
    this.caps = caps;
  }
  protected override preamble(): string | null {
    return "PREAMBLE";
  }
  protected async execute(): Promise<number> {
    console.log(this.content);
    return 0;
  }
}

const tty = (): Capabilities => ({ isTTY: true, color: false, unicode: true, columns: 80 });

/** Point the version cache at a temp dir holding a fresh, far-ahead "latest" so we're outdated. */
function outdatedCache(): void {
  const dir = mkdtempSync(join(tmpdir(), "ambykit-warn-"));
  process.env["AMBYKIT_CACHE_DIR"] = dir;
  writeFileSync(
    join(dir, "version-cache.json"),
    JSON.stringify({ latest: "999.0.0", checkedAt: new Date().toISOString() }),
    "utf8",
  );
}

async function capture(cmd: BaseCommand, opts: Partial<CliOptions> = {}): Promise<string[]> {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => void logs.push(a.join(" "));
  try {
    await cmd.run({ cwd: process.cwd(), positionals: [], flags: {}, ...opts });
  } finally {
    console.log = orig;
  }
  return logs;
}

afterEach(() => {
  delete process.env["AMBYKIT_CACHE_DIR"];
});

describe("version warning in run() (feature 010 / US-1)", () => {
  it("prints the warning between the preamble and the content", async () => {
    outdatedCache();
    const logs = await capture(new FakeCommand(tty()));
    const joined = logs.join("\n");
    expect(joined).toContain("Update available");
    const preIdx = logs.findIndex((l) => l.includes("PREAMBLE"));
    const warnIdx = logs.findIndex((l) => l.includes("Update available"));
    const contentIdx = logs.findIndex((l) => l.includes("CONTENT"));
    expect(preIdx).toBeLessThan(warnIdx);
    expect(warnIdx).toBeLessThan(contentIdx);
  });

  it("suppresses the warning on a non-TTY", async () => {
    outdatedCache();
    const logs = await capture(new FakeCommand({ ...tty(), isTTY: false }));
    expect(logs.join("\n")).not.toContain("Update available");
  });

  it("suppresses the warning under --json and keeps output byte-clean JSON", async () => {
    outdatedCache();
    // A command whose execute() prints JSON — the warning must never pollute it (dashboard --json).
    const jsonCmd = new FakeCommand(tty(), JSON.stringify({ ok: true }));
    const logs = await capture(jsonCmd, { flags: { json: true } });
    expect(logs.join("\n")).not.toContain("Update available");
    const jsonLine = logs.find((l) => l.trim().startsWith("{"));
    expect(() => JSON.parse(jsonLine!)).not.toThrow();
  });
});
