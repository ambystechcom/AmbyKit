import { describe, expect, it } from "vitest";
import { parseStories } from "../src/core/dashboard.js";

// Feature 009 / FR-005 / US-3: the dashboard already reflects per-story status (incl. in-progress),
// so a /amby.revise that flips a story to in-progress is visible with NO dashboard code change (R-1).
describe("dashboard reflects continued vs done status (FR-005)", () => {
  const spec = [
    "### US-1 — Continued story  (priority: P1)",
    "- **status:** in-progress",
    "",
    "### US-2 — Finished story  (priority: P2)",
    "- **status:** done",
    "",
  ].join("\n");
  const stories = parseStories(spec, "009-continue-spec");

  it("surfaces a story's in-progress status", () => {
    expect(stories.find((s) => s.id === "US1")!.status).toBe("in-progress");
  });

  it("keeps a done story reported as done", () => {
    expect(stories.find((s) => s.id === "US2")!.status).toBe("done");
  });
});
