import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyFiles, listBackups, restoreLatestBackup } from "../../src/cli/fsops.js";
import { buildEmittedFiles } from "../../src/cli/emit.js";
import { RestoreCommand } from "../../src/cli/restore.js";
import type { AmbyConfig } from "../../src/core/types.js";

const config: AmbyConfig = { version: "0", tools: ["claude"] };

/** A temp project with the `.amby/` marker so command project-discovery succeeds. */
function project(): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-restore-"));
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify(config), "utf8");
  return root;
}

function apply(root: string, dryRun = false) {
  return applyFiles(root, buildEmittedFiles(root, config), { dryRun, includeUser: false });
}

describe("backup + restore (US-4 / SC-005)", () => {
  it("restores the pre-modification content of a merged rules file", () => {
    const root = project();
    const original = "# My AGENTS\n\nirreplaceable original guidance\n";
    writeFileSync(join(root, "AGENTS.md"), original, "utf8");

    apply(root); // merges the region, backing up the original first
    const merged = readFileSync(join(root, "AGENTS.md"), "utf8");
    expect(merged).not.toBe(original); // it changed
    expect(listBackups(root).some((b) => b.original === "AGENTS.md")).toBe(true);

    const restored = restoreLatestBackup(root, "AGENTS.md");
    expect(restored).not.toBeNull();
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe(original); // fully recovered
  });

  it("returns null when there is no backup for a file", () => {
    expect(restoreLatestBackup(project(), "AGENTS.md")).toBeNull();
  });

  it("`restore` with no arg lists backups; with a file restores it", async () => {
    const root = project();
    writeFileSync(join(root, "AGENTS.md"), "# keep me\n\noriginal\n", "utf8");
    apply(root);

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...a: unknown[]) => void logs.push(a.join(" "));
    try {
      expect(await new RestoreCommand().run({ cwd: root, positionals: [], flags: {} })).toBe(0);
      expect(await new RestoreCommand().run({ cwd: root, positionals: ["AGENTS.md"], flags: {} })).toBe(0);
    } finally {
      console.log = origLog;
    }
    expect(logs.join("\n")).toContain("AGENTS.md");
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe("# keep me\n\noriginal\n");
  });

  it("dry-run reports the planned per-file action without writing (FR-008b)", () => {
    const root = project();
    writeFileSync(join(root, "AGENTS.md"), "# team\n\nkeep\n", "utf8");
    const result = apply(root, true);
    expect(result.wouldChange).toContain("AGENTS.md");
    expect(result.written).toHaveLength(0);
    expect(result.backedUp).toHaveLength(0); // no backup taken in dry-run
    // The file on disk is untouched by a dry-run.
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe("# team\n\nkeep\n");
  });
});
