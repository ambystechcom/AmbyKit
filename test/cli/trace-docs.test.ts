import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("trace documentation", () => {
  it("024:FR-020: the CLI reference states in one section how tests cite requirements", () => {
    const doc = readFileSync(join(root, "docs", "cli-reference.md"), "utf8");
    const sections = doc.match(/^### Citing requirements$/gm) ?? [];
    expect(sections).toHaveLength(1);
    const body = doc.split("### Citing requirements")[1]!.split(/^## /m)[0]!;
    expect(body).toContain("NNN:FR-###");
    expect(body).toContain("begins");
    expect(body.split("\n").length).toBeLessThan(25);
  });
});
