import { describe, expect, it } from "vitest";
import { readSpec } from "../../src/core/spec-format/dispatch.js";
import { storyOut } from "../helpers/spec-model.js";
import { fixture } from "../helpers/spec-project.js";

const read = (text: string, file = "specs/900-x/spec.md") => readSpec("900-x", text, { file });

describe("v2 spec reader (030, US-1)", () => {
  it("030:FR-001: the v1 and v2 forms of the edge-rich spec give equal stories", () => {
    const v1 = readSpec("900-edge-rich", fixture("edge-rich", "spec.v1.md"));
    const v2 = readSpec("900-edge-rich", fixture("edge-rich", "spec.v2.md"));
    expect(v1.format).toBe(1);
    expect(v2.format).toBe(2);
    expect(v2.stories.map(storyOut)).toEqual(v1.stories.map(storyOut));
    expect(v2.meta).toEqual(v1.meta);
    expect(v2.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("030:FR-001: story data comes from frontmatter, titles from headings, with the stale priority annotation stripped from the title", () => {
    const r = read(fixture("edge-rich", "spec.v2.md"));
    const s2 = r.stories.find((s) => s.id === "US2");
    expect(s2).toMatchObject({ title: "Second — with dash", priority: "P2", status: "in-progress", dependsOn: ["US1", "019US1"], blockedBy: ["US1"] });
  });

  it("030:FR-003: broken YAML under stories: is a located error and not a silent 1.x fallback", () => {
    const r = read(fixture("malformed", "bad-frontmatter.spec.md"), "bad.spec.md");
    expect(r.format).toBe(2);
    const e = r.issues.find((i) => i.severity === "error");
    expect(e).toMatchObject({ file: "bad.spec.md", kind: "bad-yaml" });
    expect(e?.line).toBeGreaterThanOrEqual(2);
    expect(e?.message).toMatch(/invalid YAML/);
  });

  it("030:FR-003: a dependency that is not a list is an error naming the story and line", () => {
    const r = read(fixture("malformed", "deps-not-list.spec.md"));
    const e = r.issues.find((i) => i.kind === "not-a-list");
    expect(e).toMatchObject({ severity: "error" });
    expect(e?.message).toMatch(/US-1.*depends-on.*list/);
    expect(e?.line).toBeGreaterThan(1);
  });

  it("030:FR-001: an unusual status is read as written and only warns", () => {
    const r = read(fixture("malformed", "deps-not-list.spec.md"));
    expect(r.stories.find((s) => s.id === "US2")?.status).toBe("made-up");
    expect(r.issues.find((i) => i.kind === "unknown-status")).toMatchObject({ severity: "warning" });
  });

  it("030:FR-003: a frontmatter story without a heading is an error", () => {
    const r = read(fixture("malformed", "orphan-story.spec.md"));
    expect(r.issues.find((i) => i.kind === "story-without-heading")).toMatchObject({ severity: "error" });
    expect(r.issues.find((i) => i.kind === "story-without-heading")?.message).toMatch(/US-9/);
  });

  it("030:FR-004: structured data wins and a stale 1.x bullet that disagrees is reported", () => {
    const text = [
      "---",
      "format: 2",
      "stories:",
      "  - id: US-1",
      "    status: done",
      "---",
      "",
      "### US-1 — Story",
      "",
      "- **status:** draft",
      "",
    ].join("\n");
    const r = read(text);
    expect(r.stories[0]?.status).toBe("done");
    const w = r.issues.find((i) => i.kind === "v1-data-disagrees");
    expect(w).toMatchObject({ severity: "warning" });
    expect(w?.message).toMatch(/frontmatter wins/);
  });

  it("030:FR-004: a stale (priority: Pn) in the heading loses to the frontmatter and is reported", () => {
    const text = "---\nformat: 2\nstories:\n  - id: US-1\n    priority: P2\n---\n\n### US-1 — Story  (priority: P1)\n";
    const r = read(text);
    expect(r.stories[0]).toMatchObject({ priority: "P2", title: "Story" });
    expect(r.issues.find((i) => i.kind === "v1-data-disagrees")).toBeDefined();
  });

  it("030:FR-019: story data without format: 2 is read as v2 with one warning", () => {
    const text = "---\nfeature: x\nstories:\n  - id: US-1\n    status: ready\n---\n\n### US-1 — Story\n";
    const r = read(text);
    expect(r.format).toBe(2);
    expect(r.stories[0]?.status).toBe("ready");
    expect(r.issues.filter((i) => i.kind === "missing-format-marker")).toHaveLength(1);
  });

  it("030:FR-001: a story heading with no frontmatter entry warns and is otherwise read as a 1.x story", () => {
    const text = "---\nformat: 2\nstories:\n  - id: US-1\n    status: done\n---\n\n### US-1 — One\n\n### US-2 — Two\n\n- **status:** ready\n";
    const r = read(text);
    expect(r.stories.map((s) => [s.id, s.status])).toEqual([["US1", "done"], ["US2", "ready"]]);
    expect(r.issues.find((i) => i.kind === "story-not-in-frontmatter")).toMatchObject({ severity: "warning" });
  });

  it("030:FR-016: feature-level depends-on is read as a list, and a non-list is an error", () => {
    const ok = read("---\nformat: 2\ndepends-on: [019, 023-dependency-graph]\nstories: []\n---\n");
    expect(ok.dependsOn).toEqual(["019", "023-dependency-graph"]);
    const bad = read("---\nformat: 2\ndepends-on: 019\nstories: []\n---\n");
    expect(bad.issues.find((i) => i.kind === "not-a-list")).toMatchObject({ severity: "error" });
  });

  it("030:FR-001: CRLF files read the same as LF", () => {
    const lf = fixture("edge-rich", "spec.v2.md").replace(/\r\n/g, "\n");
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(read(crlf).stories.map(storyOut)).toEqual(read(lf).stories.map(storyOut));
  });
});
