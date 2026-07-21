import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyFiles } from "../../src/cli/io/fsops.js";
import { buildEmittedFiles } from "../../src/core/emit.js";
import { REGION_HEADING, findRegion } from "../../src/core/merge.js";
import type { AmbyConfig, EmittedFile } from "../../src/core/types.js";

const config: AmbyConfig = { version: "0.0.0", tools: ["claude"] };

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "ambykit-brownfield-"));
}

function apply(root: string, dryRun = false) {
  return applyFiles(root, buildEmittedFiles(root, config), { dryRun, includeUser: false });
}

describe("brownfield init/sync — non-destructive rules merge (US-1)", () => {
  it("preserves existing agent-doc content and adds the region (FR-001)", () => {
    const root = tempRoot();
    const sentinel = "# House rules\n\nNEVER deploy on Friday. Ask @alice first.\n";
    writeFileSync(join(root, "AGENTS.md"), sentinel, "utf8");

    const result = apply(root);
    const merged = readFileSync(join(root, "AGENTS.md"), "utf8");
    expect(merged).toContain("NEVER deploy on Friday. Ask @alice first.");
    expect(merged).toContain(REGION_HEADING);
    expect(result.updated).toContain("AGENTS.md");
  });

  it("writes complete greenfield files when no rules file exists (FR-002)", () => {
    const root = tempRoot();
    const result = apply(root);
    expect(existsSync(join(root, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(root, "CLAUDE.md"))).toBe(true);
    expect(result.created).toContain("AGENTS.md");
    // Greenfield AGENTS.md keeps its title above the region.
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toMatch(/^# AGENTS\.md/);
  });

  it("is idempotent — a second run changes nothing and keeps exactly one region (SC-002)", () => {
    const root = tempRoot();
    writeFileSync(join(root, "AGENTS.md"), "# Mine\n\nkeep\n", "utf8");
    apply(root);
    const second = apply(root);
    expect(second.updated).not.toContain("AGENTS.md");
    expect(second.created).not.toContain("AGENTS.md");
    expect(second.unchanged).toContain("AGENTS.md");
    // Exactly one region → findRegion does not throw and is non-null.
    expect(findRegion(readFileSync(join(root, "AGENTS.md"), "utf8"))).not.toBeNull();
  });

  it("backs up an existing rules file before modifying it (FR-008c)", () => {
    const root = tempRoot();
    writeFileSync(join(root, "AGENTS.md"), "# Mine\n\noriginal content\n", "utf8");
    const result = apply(root);
    expect(result.backedUp.length).toBeGreaterThan(0);
    const backups = readdirSync(join(root, ".amby", "backups"));
    const agentsBackup = backups.find((f) => f.startsWith("AGENTS.md") && f.endsWith(".bak"));
    expect(agentsBackup).toBeDefined();
    expect(readFileSync(join(root, ".amby", "backups", agentsBackup!), "utf8")).toContain(
      "original content",
    );
  });

  it("leaves a hand-edited region untouched and reports it skipped (FR-008a)", () => {
    const root = tempRoot();
    apply(root); // establishes the managed region
    const path = join(root, "AGENTS.md");
    const tampered = readFileSync(path, "utf8").replace(
      "Spec-Driven Development",
      "Spec-Driven Development (my notes here)",
    );
    writeFileSync(path, tampered, "utf8");

    const result = apply(root);
    expect(result.skippedRegions).toContain("AGENTS.md");
    expect(readFileSync(path, "utf8")).toContain("my notes here"); // untouched
  });

  it("aborts a malformed file with two regions without partial writes (FR-007)", () => {
    const root = tempRoot();
    const twoRegions = `${REGION_HEADING}\n\na\n\n${REGION_HEADING}\n\nb\n`;
    writeFileSync(join(root, "AGENTS.md"), twoRegions, "utf8");
    const result = apply(root);
    expect(result.aborted).toContain("AGENTS.md");
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe(twoRegions); // unchanged
  });

  it("re-adds the Claude @AGENTS.md bridge when merging an existing CLAUDE.md (FR-011)", () => {
    const root = tempRoot();
    writeFileSync(join(root, "CLAUDE.md"), "# My Claude notes\n\nlocal guidance\n", "utf8");
    apply(root);
    const merged = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(merged.startsWith("@AGENTS.md")).toBe(true);
    expect(merged).toContain("local guidance");
    expect(merged).toContain(REGION_HEADING);
  });

  it("does not modify user-scope files without consent (FR-012)", () => {
    const root = tempRoot();
    const userFile: EmittedFile = {
      path: ".ambykit-usertest",
      contents: "x",
      scope: "user",
      merge: "region",
    };
    const result = applyFiles(root, [userFile], { dryRun: false, includeUser: false });
    expect(result.skipped).toContain(".ambykit-usertest");
    expect(result.written).not.toContain(".ambykit-usertest");
  });
});
