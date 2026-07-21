import { describe, expect, it } from "vitest";
import {
  REGION_HEADING,
  buildRegion,
  fingerprint,
  findRegion,
  mergeRegion,
} from "../../src/core/merge.js";

const region = (body = "hello world") => buildRegion(`${REGION_HEADING}\n\n${body}`);

describe("findRegion", () => {
  it("returns null when there is no AmbyKit region", () => {
    expect(findRegion("# My doc\n\nsome text\n")).toBeNull();
  });

  it("locates a region ending at the next same/higher heading", () => {
    const text = `# Title\n\n${REGION_HEADING}\n\nmanaged body\n\n## After\n\ntail\n`;
    const r = findRegion(text)!;
    expect(r).not.toBeNull();
    expect(text.split("\n")[r.startLine]).toBe(REGION_HEADING);
    expect(text.split("\n")[r.endLine]).toBe("## After");
    expect(r.body).toContain("managed body");
    expect(r.body).not.toContain("## After");
  });

  it("locates a region running to end-of-file", () => {
    const text = `intro\n\n${REGION_HEADING}\n\nmanaged tail\n`;
    const r = findRegion(text)!;
    expect(r.endLine).toBe(text.split("\n").length);
  });

  it("does not treat a deeper heading as the region end", () => {
    const text = `${REGION_HEADING}\n\n#### deeper\n\nstill managed\n`;
    const r = findRegion(text)!;
    expect(r.body).toContain("#### deeper");
    expect(r.body).toContain("still managed");
  });

  it("throws when more than one region is present (malformed → abort)", () => {
    const text = `${REGION_HEADING}\n\na\n\n${REGION_HEADING}\n\nb\n`;
    expect(() => findRegion(text)).toThrow(/expected at most one/);
  });
});

describe("fingerprint / buildRegion", () => {
  it("is deterministic and ignores trailing whitespace", () => {
    expect(fingerprint("abc")).toBe(fingerprint("abc\n\n  "));
  });

  it("builds a region that starts with the heading and ends with a fingerprint footer", () => {
    const block = region();
    expect(block.startsWith(REGION_HEADING)).toBe(true);
    expect(block.trimEnd().endsWith("-->")).toBe(true);
    expect(block).toMatch(/<!-- ambykit:fingerprint \S+ -->/);
    expect(findRegion(block)!.fingerprint).not.toBeNull();
  });
});

describe("mergeRegion", () => {
  it("creates the file when none exists (FR-002)", () => {
    const plan = mergeRegion(null, region());
    expect(plan.action).toBe("created");
    expect(plan.contents!.startsWith(REGION_HEADING)).toBe(true);
    expect(plan.contents!.endsWith("\n")).toBe(true);
  });

  it("preserves all pre-existing content and appends the region (FR-001)", () => {
    const existing = "# House rules\n\nNEVER touch prod on Friday.\n";
    const plan = mergeRegion(existing, region());
    expect(plan.action).toBe("updated");
    expect(plan.contents).toContain("NEVER touch prod on Friday.");
    expect(plan.contents).toContain(REGION_HEADING);
  });

  it("is idempotent — a second merge of the same region is unchanged (SC-002)", () => {
    const first = mergeRegion("# Doc\n\nkeep me\n", region());
    expect(first.action).toBe("updated");
    const second = mergeRegion(first.contents!, region());
    expect(second.action).toBe("unchanged");
    expect(second.contents).toBeUndefined();
  });

  it("updates the region in place without creating a second one (FR-004)", () => {
    const withA = mergeRegion("intro\n", region("version A")).contents!;
    const plan = mergeRegion(withA, region("version B"));
    expect(plan.action).toBe("updated");
    expect(plan.contents).toContain("version B");
    expect(plan.contents).not.toContain("version A");
    expect(findRegion(plan.contents!)).not.toBeNull(); // still exactly one (would throw if two)
  });

  it("skips a region that was hand-edited since AmbyKit wrote it (FR-008a)", () => {
    const managed = mergeRegion("intro\n", region("original")).contents!;
    const tampered = managed.replace("original", "human tweak");
    const plan = mergeRegion(tampered, region("original"));
    expect(plan.action).toBe("skipped");
    expect(plan.reason).toMatch(/hand-edited/);
    expect(plan.contents).toBeUndefined();
  });

  it("aborts on a malformed file with two regions (FR-007)", () => {
    const twoRegions = `${REGION_HEADING}\n\na\n\n${REGION_HEADING}\n\nb\n`;
    const plan = mergeRegion(twoRegions, region());
    expect(plan.action).toBe("aborted");
    expect(plan.reason).toMatch(/expected at most one/);
  });

  it("preserves content that follows the region when splicing", () => {
    const existing = `${REGION_HEADING}\n\nold\n\n## Footer\n\nkeep this footer\n`;
    const plan = mergeRegion(existing, region("new"));
    expect(plan.action).toBe("updated");
    expect(plan.contents).toContain("## Footer");
    expect(plan.contents).toContain("keep this footer");
    expect(plan.contents).toContain("new");
  });

  it("ensures a required prefix (Claude @AGENTS.md bridge) and stays idempotent (FR-011)", () => {
    const existing = "# My CLAUDE.md\n\nlocal notes\n";
    const plan = mergeRegion(existing, region(), { requiredPrefix: "@AGENTS.md" });
    expect(plan.action).toBe("updated");
    expect(plan.contents!.startsWith("@AGENTS.md")).toBe(true);
    expect(plan.contents).toContain("local notes");
    const again = mergeRegion(plan.contents!, region(), { requiredPrefix: "@AGENTS.md" });
    expect(again.action).toBe("unchanged");
  });
});
