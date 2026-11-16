import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findCitations, loadDecisions, nextAdrNumber, parseDecision } from "../../src/core/decisions.js";

const rec = (extra = "", id = "ADR-001") =>
  `---\nid: ${id}\ntitle: Use files\nstatus: accepted\ndate: 2026-11-16\n${extra}---\n\n# Use files\n\n## Context\nx\n`;

describe("parseDecision (022 FR-002)", () => {
  it("parses the template fields and treats empty YAML values as absent", () => {
    const r = parseDecision(rec("feature:\nprinciple: 3\nconflicts: []\nsupersedes:\nsuperseded-by:\n"), "ADR-001.md");
    expect(r).toMatchObject({ id: "ADR-001", title: "Use files", status: "accepted", date: "2026-11-16", principle: "3", conflicts: [], file: "ADR-001.md" });
    expect(r.feature).toBeUndefined();
    expect(r.supersedes).toBeUndefined();
    expect(r.supersededBy).toBeUndefined();
  });

  it("reads supersede links and numeric conflicts", () => {
    const r = parseDecision(rec("conflicts: [2, 5]\nsupersedes: ADR-009\nsuperseded-by: ADR-010\n"), "ADR-001.md");
    expect(r.conflicts).toEqual(["2", "5"]);
    expect(r.supersedes).toBe("ADR-009");
    expect(r.supersededBy).toBe("ADR-010");
  });

  it("throws naming the file on a bad id or status", () => {
    expect(() => parseDecision("---\nid: X-1\ntitle: t\nstatus: accepted\n---\n", "bad.md")).toThrow(/bad\.md/);
    expect(() => parseDecision("---\nid: ADR-001\ntitle: t\nstatus: maybe\n---\n", "bad.md")).toThrow(/status/);
  });
});

describe("findCitations (022 FR-007)", () => {
  it("finds unique ADR-### ids and ignores placeholders", () => {
    expect(findCitations("see ADR-001, ADR-0012 and ADR-001 again; ADR-### and ADR-1 and XADR-002")).toEqual(["ADR-001", "ADR-0012"]);
  });
});

describe("nextAdrNumber (022 FR-005)", () => {
  it("starts at 001", () => expect(nextAdrNumber([], "")).toBe("001"));
  it("uses the highest file", () => expect(nextAdrNumber(["ADR-001.md", "ADR-004.md", "README.md"], "")).toBe("005"));
  it("counts index rows of deleted files (tombstones)", () => {
    expect(nextAdrNumber(["ADR-001.md"], "| ADR-001 | a | accepted |\n| ADR-007 | gone | accepted |")).toBe("008");
  });
});

describe("loadDecisions", () => {
  it("reads records, the index and citations; scans markdown only", () => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-adr-"));
    mkdirSync(join(root, ".amby", "decisions"), { recursive: true });
    mkdirSync(join(root, "specs", "001-a"), { recursive: true });
    writeFileSync(join(root, ".amby", "decisions", "ADR-001.md"), rec());
    writeFileSync(join(root, ".amby", "decisions", "ADR-002.md"), "no frontmatter");
    writeFileSync(join(root, ".amby", "decisions", "README.md"), "| ADR-001 | t | accepted |\n| ADR-003 | gone | accepted |");
    writeFileSync(join(root, "specs", "001-a", "plan.md"), "Follows ADR-001.");
    writeFileSync(join(root, "specs", "001-a", "code.ts"), "// ADR-009");
    writeFileSync(join(root, ".amby", "constitution.md"), "per ADR-005");
    const d = loadDecisions(root);
    expect(d.records.map((r) => r.id)).toEqual(["ADR-001"]);
    expect(d.invalid).toHaveLength(1);
    expect(d.indexIds).toEqual(["ADR-001", "ADR-003"]);
    const cited = d.citations.map((c) => `${c.id}@${c.source}`);
    expect(cited).toContain("ADR-001@specs/001-a/plan.md");
    expect(cited).toContain("ADR-005@.amby/constitution.md");
    expect(cited.join()).not.toContain("ADR-009");
  });

  it("returns an empty input when nothing exists", () => {
    const d = loadDecisions(mkdtempSync(join(tmpdir(), "ambykit-adr-empty-")));
    expect(d).toEqual({ records: [], invalid: [], indexIds: null, citations: [] });
  });
});
