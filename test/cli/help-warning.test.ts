import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../../src/cli/index.js";

/**
 * Regression (feature 010): running `ambykit` with no args must show the outdated-version callout
 * between the banner and the usage/commands — not only for real commands.
 */
describe("no-arg / help shows the update warning between banner and usage", () => {
  const origTTY = process.stdout.isTTY;
  afterEach(() => {
    (process.stdout as unknown as { isTTY?: boolean }).isTTY = origTTY;
    delete process.env["AMBYKIT_CACHE_DIR"];
    delete process.env["NO_COLOR"];
  });

  async function runNoArgs(): Promise<string[]> {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => void logs.push(a.join(" "));
    try {
      await main([]);
    } finally {
      console.log = orig;
    }
    return logs;
  }

  it("prints the warning (naming the newer version) before the Usage line", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-help-"));
    process.env["AMBYKIT_CACHE_DIR"] = dir;
    process.env["NO_COLOR"] = "1"; // plain output for stable assertions
    writeFileSync(
      join(dir, "version-cache.json"),
      JSON.stringify({ latest: "999.0.0", checkedAt: new Date().toISOString() }),
    );
    (process.stdout as unknown as { isTTY?: boolean }).isTTY = true;

    const logs = await runNoArgs();
    const warnIdx = logs.findIndex((l) => l.includes("Update available"));
    const usageIdx = logs.findIndex((l) => l.includes("Usage:"));
    expect(warnIdx).toBeGreaterThanOrEqual(0);
    expect(usageIdx).toBeGreaterThan(warnIdx);
    expect(logs.join("\n")).toContain("999.0.0");
  });

  it("shows no warning when up to date", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ambykit-help2-"));
    process.env["AMBYKIT_CACHE_DIR"] = dir;
    writeFileSync(
      join(dir, "version-cache.json"),
      JSON.stringify({ latest: "0.0.1", checkedAt: new Date().toISOString() }), // behind installed
    );
    (process.stdout as unknown as { isTTY?: boolean }).isTTY = true;

    const logs = await runNoArgs();
    expect(logs.join("\n")).not.toContain("Update available");
  });
});
