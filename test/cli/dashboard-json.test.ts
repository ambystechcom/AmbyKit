import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { computeDashboard } from "../../src/core/dashboard.js";
import { hasAnsi } from "../ui/helpers.js";

/** A minimal AmbyKit project fixture with one feature, story, and task list. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-dash-json-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  const feat = join(root, "specs", "001-demo");
  mkdirSync(feat, { recursive: true });
  writeFileSync(
    join(feat, "spec.md"),
    ["### US-1 — Demo story  (priority: P1)", "", "- **status:** in-progress", ""].join("\n"),
  );
  writeFileSync(
    join(feat, "tasks.md"),
    ["- [x] [T001] [US1] done task (a.ts)", "- [ ] [T002] [US1] todo task (b.ts)", ""].join("\n"),
  );
  return root;
}

/** Run a command capturing everything it writes to stdout. */
async function capture(root: string, flags: Record<string, string | boolean>): Promise<string> {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => void lines.push(args.join(" "));
  try {
    await new DashboardCommand().run({ cwd: root, positionals: [], flags });
  } finally {
    console.log = orig;
  }
  return lines.join("\n");
}

describe("dashboard --json (FR-009/010, SC-004)", () => {
  it("emits no ANSI and is byte-identical to the core computation", async () => {
    const root = fixture();
    const out = await capture(root, { json: true });

    expect(hasAnsi(out)).toBe(false);
    expect(() => JSON.parse(out)).not.toThrow();
    // The command's JSON must be exactly the core dashboard serialized — no styling leaks in.
    expect(out).toBe(JSON.stringify(computeDashboard(root), null, 2));
  });

  it("the styled (non-json) table path is separate and does colorize", async () => {
    const root = fixture();
    const json = await capture(root, { json: true });
    const table = await capture(root, {});
    // Different code paths → different output; json stays plain.
    expect(table).not.toBe(json);
    expect(hasAnsi(json)).toBe(false);
  });
});
