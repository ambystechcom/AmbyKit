import { describe, expect, it } from "vitest";
import { detectSpecFormat, detectTasksFormat } from "../../src/core/spec-format/detect.js";
import { fixture } from "../helpers/spec-project.js";

describe("format detection (030, T012; FR-019)", () => {
  it("030:FR-019: a spec with format: 2 is v2 and marked", () => {
    expect(detectSpecFormat("---\nformat: 2\nstories:\n  - id: US-1\n---\n### US-1 — A\n")).toEqual({ format: 2, marker: true });
  });

  it("030:FR-019: story data without the marker is v2 and not marked", () => {
    expect(detectSpecFormat("---\nfeature: x\nstories:\n  - id: US-1\n    status: draft\n---\n")).toEqual({ format: 2, marker: false });
  });

  it("030:FR-003: broken YAML that still declares stories: is v2 intent, never a silent 1.x fallback", () => {
    expect(detectSpecFormat(fixture("malformed", "bad-frontmatter.spec.md")).format).toBe(2);
  });

  it("030:FR-012: a 1.x spec (bullets, no frontmatter story data) is format 1", () => {
    expect(detectSpecFormat("---\nfeature: x\n---\n### US-1 — A\n\n- **status:** done\n")).toEqual({ format: 1, marker: false });
    expect(detectSpecFormat("### US-1 — A\n")).toEqual({ format: 1, marker: false });
  });

  it("030:FR-019: the edge-rich fixtures detect as their own format", () => {
    expect(detectSpecFormat(fixture("edge-rich", "spec.v1.md")).format).toBe(1);
    expect(detectSpecFormat(fixture("edge-rich", "spec.v2.md")).format).toBe(2);
    expect(detectTasksFormat(fixture("edge-rich", "tasks.v1.md")).format).toBe(1);
    expect(detectTasksFormat(fixture("edge-rich", "tasks.v2-phase.md")).format).toBe(2);
    expect(detectTasksFormat(fixture("edge-rich", "tasks.v2-task.md")).format).toBe(2);
  });

  it("030:FR-002: a yaml fence without files or verify is documentation, so the tasks file stays 1.x", () => {
    const text = "## Phase 1\n\n- [ ] [T001] do (src/a.ts)\n\n```yaml\nname: example\n```\n";
    expect(detectTasksFormat(text).format).toBe(1);
  });

  it("030:FR-002: a tasks file with format: 2 in frontmatter is v2 even before any block exists", () => {
    expect(detectTasksFormat("---\nformat: 2\n---\n## Phase 1\n- [ ] [T001] x\n")).toEqual({ format: 2, marker: true });
  });
});
