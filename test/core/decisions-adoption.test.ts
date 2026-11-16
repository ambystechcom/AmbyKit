import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/core/analyze.js";
import { installArtifactTemplates } from "../../src/core/scaffold.js";

// Feature 022 US-7 / FR-015 / SC-004: a project with no decisions sees nothing new.
describe("decisions adoption (feature 022)", () => {
  function project(): string {
    const root = mkdtempSync(join(tmpdir(), "ambykit-adopt-"));
    mkdirSync(join(root, ".amby"), { recursive: true });
    writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
    const d = join(root, "specs", "001-demo");
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, "spec.md"), "---\nfeature: 001-demo\nstatus: ready\n---\n# Demo\n\n### US-1 — One  (priority: P1)\n\n- **status:** draft\n\n## Requirements (EARS)\n\n- FR-001  THE SYSTEM SHALL do one. Placeholders like ADR-### are not citations.\n");
    writeFileSync(join(d, "tasks.md"), "---\nfeature: x\n---\n\n## Phase 1\n\n- [ ] [T001] [US1] Alpha (src/a.ts)\n");
    return root;
  }

  it("adds no `decisions` key to the report without records or citations", () => {
    const report = analyzeProject(project());
    expect(Object.keys(report)).not.toContain("decisions");
    expect(JSON.stringify(report)).not.toContain("decisions");
  });

  it("installing templates creates no .amby/decisions/ (created on first use only)", () => {
    const root = project();
    installArtifactTemplates(root);
    expect(existsSync(join(root, ".amby", "decisions"))).toBe(false);
    expect(existsSync(join(root, ".amby", "templates", "adr.md"))).toBe(true);
  });

  it("the first citation or record switches the section on", () => {
    const root = project();
    mkdirSync(join(root, ".amby", "decisions"), { recursive: true });
    writeFileSync(join(root, ".amby", "decisions", "ADR-001.md"), "---\nid: ADR-001\ntitle: t\nstatus: accepted\n---\n");
    expect(analyzeProject(root).decisions?.records).toHaveLength(1);
  });
});
