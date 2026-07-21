import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyFiles } from "../../src/cli/fsops.js";
import { buildEmittedFiles } from "../../src/cli/emit.js";
import { REGION_HEADING } from "../../src/core/merge.js";
import type { AmbyConfig } from "../../src/core/types.js";

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "ambykit-sync-brownfield-"));
}
function run(root: string, config: AmbyConfig, dryRun = false) {
  return applyFiles(root, buildEmittedFiles(root, config), { dryRun, includeUser: false });
}
/** Count occurrences of the region heading — proves there is exactly one region (SC-002). */
function regionCount(text: string): number {
  return text.split("\n").filter((l) => l.trimEnd() === REGION_HEADING).length;
}

describe("sync as the brownfield update path (US-2)", () => {
  const claude: AmbyConfig = { version: "0", tools: ["claude"] };

  it("re-running sync twice leaves exactly one region and reports no change (SC-002, FR-004/005)", () => {
    const root = tempRoot();
    writeFileSync(join(root, "AGENTS.md"), "# Team\n\nour rules\n", "utf8");

    run(root, claude); // first update
    const second = run(root, claude); // idempotent re-run
    const agents = readFileSync(join(root, "AGENTS.md"), "utf8");

    expect(regionCount(agents)).toBe(1);
    expect(second.unchanged).toContain("AGENTS.md");
    expect(second.updated).not.toContain("AGENTS.md");
    expect(agents).toContain("our rules"); // user content still there
  });

  it("check-style dry-run reports in-sync after an update, ignoring backups (FR-010)", () => {
    const root = tempRoot();
    writeFileSync(join(root, "AGENTS.md"), "# Team\n\nkeep\n", "utf8");
    run(root, claude); // update (writes a backup under .amby/backups/)

    // A subsequent `check` (dryRun) recomputes the emitted set — backups are not part of it.
    const check = run(root, claude, true);
    expect(check.wouldChange).toHaveLength(0);
    expect(existsSync(join(root, ".amby", "backups"))).toBe(true); // backup exists but is not "out of sync"
  });

  it("gives every configured tool its native rules file in one region (FR-006)", () => {
    const root = tempRoot();
    const multi: AmbyConfig = { version: "0", tools: ["claude", "copilot", "cursor"] };
    run(root, multi);

    const claudeMd = readFileSync(join(root, "CLAUDE.md"), "utf8");
    const copilot = readFileSync(join(root, ".github", "copilot-instructions.md"), "utf8");
    const cursor = readFileSync(join(root, ".cursor", "rules", "ambykit.mdc"), "utf8");
    const agents = readFileSync(join(root, "AGENTS.md"), "utf8");

    for (const f of [claudeMd, copilot, cursor, agents]) expect(regionCount(f)).toBe(1);
    expect(claudeMd.startsWith("@AGENTS.md")).toBe(true); // Claude bridge intact (FR-011)
    expect(cursor).toContain("alwaysApply: true"); // Cursor frontmatter intact
  });

  it("skips a hand-edited region on the next sync and reports it (FR-008a)", () => {
    const root = tempRoot();
    run(root, claude); // establish region in greenfield CLAUDE.md + AGENTS.md
    const path = join(root, "AGENTS.md");
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace("Spec-Driven Development", "Spec-Driven Development (MY EDIT)"),
      "utf8",
    );

    const result = run(root, claude);
    // AGENTS.md region was edited → skipped; CLAUDE.md untouched region → unchanged.
    expect(result.skippedRegions).toContain("AGENTS.md");
  });
});
