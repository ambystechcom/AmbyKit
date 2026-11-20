import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLANNED_DEPRECATED_TARGETS, PLANNED_MOVED_TARGETS } from "../../src/core/moved-targets.js";

/**
 * Feature 036, US-3 (T043, FR-009): the changelog and the migration guide list every moved target, its package and the install
 * line, and they are generated from nothing: this test reads them against the planned table so a doc and the table cannot drift.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8").replaceAll("\r\n", "\n");
const migration = read("docs/migration.md");
const changelog = read("CHANGELOG.md");
const unreleased = changelog.slice(changelog.indexOf("## [Unreleased]"), changelog.indexOf("## [1.6.0]"));

describe("the migration guide lists the moved targets (036:FR-009)", () => {
  it("036:FR-009: every moved id, its package and the exact install line appear, and the config example pins the package", () => {
    for (const [id, m] of Object.entries(PLANNED_MOVED_TARGETS)) {
      expect(migration, `id ${id}`).toContain(`\`${id}\``);
      expect(migration, `package of ${id}`).toContain(m.package);
      expect(migration, `install line of ${id}`).toContain(`npm install --save-exact ${m.package}`);
    }
    expect(migration).toMatch(/"plugins": \{ "@ambystech\/ambykit-emitter-antigravity": "\d+\.\d+\.\d+" \}/);
  });

  it("036:FR-009: it says when it takes effect, what is never deleted, and that AmbyKit does not install the package for you", () => {
    expect(migration).toContain("Takes effect when you upgrade to AmbyKit 2.0");
    expect(migration).toMatch(/never delete or rewrite/);
    expect(migration).toMatch(/does not install the package or edit your\s+config/);
  });

  it("036:FR-009: it names the targets that stay built in and the long tail that only gets a notice", () => {
    for (const product of ["Claude Code", "Codex", "Copilot", "Cursor", "OpenCode"]) expect(migration, product).toContain(product);
    for (const id of ["claude-vscode", "copilot-cli", "cursor-cli", "pi"]) expect(migration, id).toContain(`\`${id}\``);
    for (const id of Object.keys(PLANNED_DEPRECATED_TARGETS)) expect(migration, id).toContain(`\`${id}\``);
  });
});

describe("the changelog lists the moved targets (036:FR-009)", () => {
  it("036:FR-009: [Unreleased] names the package and both Antigravity targets, and says they are still bundled until 2.0", () => {
    expect(unreleased).toContain("@ambystech/ambykit-emitter-antigravity");
    expect(unreleased).toContain("`antigravity`");
    expect(unreleased).toContain("`antigravity-cli`");
    expect(unreleased).toMatch(/still bundled and nothing changes for you/);
  });
});
