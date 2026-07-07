import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddCommand } from "../../src/cli/add.js";

/** A minimal AmbyKit project (just enough for `add` to find the root). */
function project(): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-nontty-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  return root;
}

describe("add on a non-TTY (US-7, FR-016)", () => {
  it("errors with guidance instead of blocking on a prompt when no target is given", async () => {
    const errors: string[] = [];
    const origErr = console.error;
    console.error = (...a: unknown[]) => void errors.push(a.join(" "));
    let code: number;
    try {
      // Vitest runs without a TTY, so caps.isTTY is false → the prompt path is skipped.
      code = await new AddCommand().run({ cwd: project(), positionals: [], flags: {} });
    } finally {
      console.error = origErr;
    }
    expect(code).toBe(1);
    expect(errors.join("\n")).toContain("Specify at least one target");
  });
});
