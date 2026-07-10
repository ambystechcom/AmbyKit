import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// FR-014 (feature 007): the docs site's workflow/command facts must match src/prompts + registries.
// execFileSync throws on a non-zero exit, so a drifted site fails this test.
describe("docs-sync check (FR-014)", () => {
  it("passes: site phase/command facts are in sync with the source of truth", () => {
    const out = execFileSync("node", ["scripts/check-docs-sync.mjs"], { cwd: root, encoding: "utf8" });
    expect(out).toContain("docs in sync");
  });
});
