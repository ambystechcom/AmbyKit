import { describe, expect, it } from "vitest";
import { parseStories } from "../../src/core/dashboard.js";
import { convertSpec } from "../../src/core/migrate/convert-spec.js";
import { readSpec } from "../../src/core/spec-format/dispatch.js";
import { storyOut } from "../helpers/spec-model.js";
import { fixture } from "../helpers/spec-project.js";

const V1 = fixture("edge-rich", "spec.v1.md");
const model = (text: string, feature = "900-edge-rich") => readSpec(feature, text).stories.map(storyOut);
const v1Model = (text: string, feature = "900-edge-rich") => parseStories(text, feature).map(storyOut);

describe("convert a 1.x spec to v2 (030, US-3)", () => {
  it("030:FR-005: the converted edge-rich spec reads back equal to the 1.x model", () => {
    const r = convertSpec(V1, "900-edge-rich");
    expect(r.status).toBe("converted");
    expect(model(r.text)).toEqual(v1Model(V1));
    expect(readSpec("900-edge-rich", r.text).issues).toEqual([]);
  });

  it("030:FR-005: format: 2 and a stories list are added, the metadata bullets move, and prose stays", () => {
    const r = convertSpec(V1, "900-edge-rich");
    expect(r.text).toMatch(/^---\r?\nformat: 2\r?\n/);
    expect(r.text).toMatch(/^stories:/m);
    const bullets = r.text.split(/\r?\n/).filter((l) => /^\s*[-*]\s+\*\*(status|depends-on|blocked-by|priority):\*\*/i.test(l));
    expect(bullets).toEqual([]);
    expect(r.text).toContain("Prose that mentions **status:** done before any story must be left alone.");
    expect(r.text).toContain("Needs a decision [NEEDS CLARIFICATION: how many?]");
    expect(r.text).toContain("- Given a, When b, Then c.");
  });

  it("030:FR-005: the (priority: Pn) annotation is stripped from headings and each strip is reported", () => {
    const r = convertSpec(V1, "900-edge-rich");
    expect(r.text).toContain("### US-1 — First story\n".replace(/\n/g, r.text.includes("\r\n") ? "\r\n" : "\n"));
    expect(r.text).not.toMatch(/\(priority:\s*P\d\)/);
    expect(r.strippedHeadings.map((s) => [s.story, s.priority])).toEqual([["US-1", "P1"], ["US-2", "P2"]]);
    expect(r.strippedHeadings.every((s) => s.line > 1)).toBe(true);
  });

  it("030:FR-005: everything outside the moved bullets, the headings' annotations and the frontmatter is byte-identical", () => {
    const r = convertSpec(V1, "900-edge-rich");
    const keep = (t: string) =>
      t
        .split(/\r?\n/)
        .filter((l) => !/\*\*(status|depends-on|blocked-by|priority):\*\*\s+/.test(l) || /Prose that mentions/.test(l))
        .map((l) => l.replace(/\s*\(priority:\s*P\d\)/, ""))
        .join("\n");
    const body = (t: string) => t.slice(t.lastIndexOf("---") + 3);
    expect(body(keep(r.text)).replace(/\n{2,}/g, "\n")).toBe(body(keep(V1)).replace(/\n{2,}/g, "\n"));
  });

  it("030:FR-009: converting a converted spec changes nothing", () => {
    const once = convertSpec(V1, "900-edge-rich");
    const twice = convertSpec(once.text, "900-edge-rich");
    expect(twice).toMatchObject({ status: "unchanged", reason: "already v2", text: once.text });
  });

  it("030:FR-005: the file's line endings are kept (CRLF stays CRLF, LF stays LF)", () => {
    const lf = V1.replace(/\r\n/g, "\n");
    const crlf = lf.replace(/\n/g, "\r\n");
    const a = convertSpec(lf, "900-edge-rich").text;
    const b = convertSpec(crlf, "900-edge-rich").text;
    expect(a).not.toContain("\r");
    expect(b.split("\r\n").join("")).not.toMatch(/[\r\n]/);
    expect(model(b)).toEqual(model(a));
  });

  it("030:FR-005: a spec with no frontmatter gets minimal frontmatter, flagged", () => {
    const text = "### US-1 — Story\n\n- **status:** done\n";
    const r = convertSpec(text, "912-no-frontmatter");
    expect(r.addedFrontmatter).toBe(true);
    expect(r.text.startsWith("---\nformat: 2\nfeature: 912-no-frontmatter\nstories:")).toBe(true);
    expect(model(r.text, "912-no-frontmatter")).toEqual(v1Model(text, "912-no-frontmatter"));
  });

  it("030:FR-005: a story with no metadata still gets an entry, and cross-feature references are quoted", () => {
    const text = "---\nfeature: x\n---\n\n### US-1 — A\n\n- **depends-on:** [019:US-1, US-2]\n\n### US-2 — B\n";
    const r = convertSpec(text, "x");
    expect(r.text).toContain('depends-on: ["019:US-1", US-2]');
    expect(r.text).toMatch(/- id: US-2\r?\n---/);
    expect(model(r.text, "x")).toEqual(v1Model(text, "x"));
  });

  it("030:FR-005: a spec with no stories is left unchanged", () => {
    const r = convertSpec("# Notes\n\nNo stories here.\n", "x");
    expect(r).toMatchObject({ status: "unchanged", reason: "no stories" });
  });

  it("030:FR-023: dual-write keeps every 1.x line and adds the v2 data, and both read the same with no drift warning", () => {
    const r = convertSpec(V1, "900-edge-rich", { dualWrite: true });
    expect(r.status).toBe("converted");
    expect(r.text).toContain("- **status:** in-progress");
    expect(r.text).toContain("### US-1 — First story  (priority: P1)");
    expect(r.strippedHeadings).toEqual([]);
    const read = readSpec("900-edge-rich", r.text);
    expect(read.stories.map(storyOut)).toEqual(v1Model(V1));
    expect(read.issues.filter((i) => i.kind === "v1-data-disagrees")).toEqual([]);
  });
});
