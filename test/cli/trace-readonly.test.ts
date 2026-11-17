import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runTrace, specWith, traceFixture } from "../helpers/trace-fixture.js";

function snapshot(dir: string, out: Record<string, string> = {}): Record<string, string> {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) snapshot(p, out);
    else out[p] = createHash("sha1").update(readFileSync(p)).digest("hex") + statSync(p).mtimeMs;
  }
  return out;
}

describe("trace is read-only", () => {
  it("024:FR-011: leaves every spec and test file untouched, with or without flags", async () => {
    const root = traceFixture({
      specs: { "019-a": { "spec.md": specWith("FR-001"), "tests.md": "uncovered: FR-001 — x\n" } },
      files: { "t/a.test.ts": `it("019:FR-001: x", () => {});\nit("legacy", () => {});` },
    });
    const before = snapshot(root);
    await runTrace(root);
    await runTrace(root, ["019"], { json: true });
    await runTrace(root, [], { gate: true });
    expect(snapshot(root)).toEqual(before);
  });
});
