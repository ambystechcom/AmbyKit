import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/core/dashboard.js";

/** US-1 acceptance criteria (feature 020), exercised through `parseTasks`. */
const phase = (...lines: string[]): string => ["## Phase 1", ...lines].join("\n");

describe("US-1: mark a task as blocked", () => {
  it("AC1: an unchecked task with a BLOCKED marker is blocked and the reason is retrievable (FR-001)", () => {
    const [t] = parseTasks(phase("- [ ] [T001] [US1] Call the API (src/api.ts) ⚠ BLOCKED: waiting on the API key"));
    expect(t?.blocked).toBe("waiting on the API key");
    expect(t?.done).toBe(false);
  });

  it("AC1: every other task on the list is read as before", () => {
    const tasks = parseTasks(
      phase("- [ ] [T001] Call the API (src/api.ts) ⚠ BLOCKED: no key", "- [ ] [T002] [P] Other (src/other.ts)", "- [x] [T003] Done (src/done.ts)"),
    );
    expect(tasks.map((t) => t.blocked)).toEqual(["no key", undefined, undefined]);
    expect(tasks[1]).toMatchObject({ id: "T002", parallel: true, paths: ["src/other.ts"], done: false });
    expect(tasks[2]).toMatchObject({ id: "T003", done: true, paths: ["src/done.ts"] });
  });

  it("AC2: once the marker is removed and the task checked off it is no longer blocked", () => {
    const [before] = parseTasks(phase("- [ ] [T001] Call the API (src/api.ts) ⚠ BLOCKED: no key"));
    const [after] = parseTasks(phase("- [x] [T001] Call the API (src/api.ts)"));
    expect(before?.blocked).toBe("no key");
    expect(after?.blocked).toBeUndefined();
    expect(after?.done).toBe(true);
  });

  it("AC3: a deviation note is attached to the task and changes neither checked state nor ownership (FR-002)", () => {
    const plain = parseTasks(phase("- [x] [T001] [P] [US2] Do it (src/a.ts, test/a.test.ts)"))[0];
    const noted = parseTasks(phase("- [x] [T001] [P] [US2] Do it (src/a.ts, test/a.test.ts) ↪ DEVIATION: used a fixture instead"))[0];
    expect(noted?.deviation).toBe("used a fixture instead");
    expect(noted).toMatchObject({ done: plain?.done, story: plain?.story, parallel: plain?.parallel, paths: plain?.paths, description: plain?.description });
  });

  it("AC4: a BLOCKED marker with no reason is still blocked, with an empty reason to report (FR-003)", () => {
    const [t] = parseTasks(phase("- [ ] [T001] Do it (src/a.ts) ⚠ BLOCKED:"));
    expect(t?.blocked).toBe("");
    expect(t?.paths).toEqual(["src/a.ts"]);
  });

  it("AC5: a checked task that still carries a BLOCKED marker shows both, so consumers can report it (FR-004)", () => {
    const [t] = parseTasks(phase("- [x] [T001] Do it (src/a.ts) ⚠ BLOCKED: stale marker"));
    expect(t?.done).toBe(true);
    expect(t?.blocked).toBe("stale marker");
  });

  it("recovers a marker together with file ownership, story tag and [P] (US-5 AC2)", () => {
    const [t] = parseTasks(phase("- [ ] [T004] [P] [US3] Wire it (src/wire.ts, test/wire.test.ts) ⚠ BLOCKED: needs `src/x.ts` (not merged)"));
    expect(t).toMatchObject({
      id: "T004",
      story: "US3",
      parallel: true,
      paths: ["src/wire.ts", "test/wire.test.ts"],
      blocked: "needs `src/x.ts` (not merged)",
    });
    expect(t?.pathIssue).toBeUndefined();
  });

  it("works with the glyph-less ASCII form", () => {
    const [t] = parseTasks(phase("- [ ] [T001] Do it (src/a.ts) BLOCKED: no key"));
    expect(t?.blocked).toBe("no key");
  });
});
