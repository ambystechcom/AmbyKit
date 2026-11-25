import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 034:FR-010, FR-011 — `docs/release.md` keeps a written rollback plan that names each command and who runs it, says a published
 * version cannot be reused so the fix is 2.0.1, states what 1.x loses on a v2 file and the two ways back, and the release checklist
 * runs in order (US-5).
 */
const root = resolve(__dirname, "..", "..");
const doc = readFileSync(resolve(root, "docs", "release.md"), "utf8").replace(/\r\n/g, "\n");
const rollback = doc.slice(doc.indexOf("\n## Rollback\n"));
const changelog = readFileSync(resolve(root, "CHANGELOG.md"), "utf8");

describe("rollback plan (034, US-5)", () => {
  it("034:FR-010: the plan exists after the checklist", () => {
    expect(doc.indexOf("\n## Release checklist\n")).toBeGreaterThan(0);
    expect(doc.indexOf("\n## Rollback\n")).toBeGreaterThan(doc.indexOf("\n## Release checklist\n"));
  });

  it("034:FR-010: it names the last 1.x version (D-4), and that version is the newest 1.x in the changelog", () => {
    const newest1x = /^## \[(1\.\d+\.\d+)\]/m.exec(changelog)?.[1];
    expect(newest1x).toBe("1.6.0");
    expect(rollback).toContain(`The last 1.x version is **${newest1x}**`);
  });

  it("034:FR-010: each step is a command: repoint latest, deprecate, edit the release", () => {
    expect(rollback).toMatch(/^\s*npm dist-tag add @ambystech\/ambykit@1\.6\.0 latest$/m);
    expect(rollback).toMatch(/^\s*npm deprecate @ambystech\/ambykit@2\.0\.0 ".*2\.0\.1.*"$/m);
    expect(rollback).toMatch(/^\s*gh release edit v2\.0\.0 /m);
  });

  it("034:FR-010: it says who runs each command", () => {
    expect(rollback).toMatch(/release maintainer runs every\s+command/);
    expect(rollback).toMatch(/npm owner login/);
  });

  it("034:FR-010: a version cannot be reused, so the fix ships as 2.0.1", () => {
    expect(rollback).toMatch(/cannot be unpublished and published again/);
    expect(rollback).toMatch(/Ship the fix as 2\.0\.1/);
  });

  it("034:FR-011: it states what 1.x loses on a v2 file and the two ways back, linking the migration guide", () => {
    expect(rollback).toMatch(/loses story statuses,\s+dependencies, file ownership and Verify results/);
    expect(rollback).toContain("**Restore from version control:**");
    expect(rollback).toContain("**Dual-write:**");
    expect(rollback).toContain("ambykit migrate --dual-write");
    expect(rollback).toContain("](./migration.md#a-1x-ambykit-loses-data-on-a-v2-file)");
  });

  it("034:FR-010: the checklist runs in order: preconditions, candidate, gate, branch, publish, fresh install", () => {
    const steps = ["**Preconditions.**", "**Release candidate.**", "**Gate.**", "**Release branch.**", "**Publish.**", "**Fresh-install check.**"];
    const at = steps.map((s) => doc.indexOf(s));
    for (let i = 0; i < steps.length; i++) expect(at[i], steps[i]).toBeGreaterThan(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(doc).toContain("npm run release:check");
  });

  it("034:FR-010: the contributing checklist links the release guide and keeps its per-release bullets", () => {
    const contributing = readFileSync(resolve(root, "docs", "contributing.md"), "utf8");
    const section = contributing.slice(contributing.indexOf("## Release checklist"));
    expect(section).toContain("](./release.md)");
    expect(section).toMatch(/\*\*Plugins:\*\*/);
    expect(existsSync(resolve(root, "docs", "plugins-release.md"))).toBe(true);
  });
});
