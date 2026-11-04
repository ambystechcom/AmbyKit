import { describe, expect, it } from "vitest";
import { parseTasks } from "../../src/core/dashboard.js";
const BS = String.fromCharCode(92);
import { phase, tasksMd } from "../helpers/tasks-fixture.js";

const one = (line: string) => parseTasks(line)[0]!;

describe("parseTasks — declared paths (015)", () => {
  it("reads a single path", () => {
    expect(one("- [ ] [T001] [US1] do it (src/a.ts)")).toMatchObject({ paths: ["src/a.ts"], parallel: false });
    expect(one("- [ ] [T001] [US1] do it (src/a.ts)").pathIssue).toBeUndefined();
  });
  it("reads multiple comma-separated paths, strips backticks, normalizes", () => {
    const t = one("- [ ] [T002] [P] [US1] do it (`src/A.ts`, ./docs/, test" + BS + "b.test.ts)");
    expect(t.paths).toEqual(["src/a.ts", "docs", "test/b.test.ts"]);
    expect(t.parallel).toBe(true);
  });
  it("ignores a prose parenthetical and flags the task as missing a path", () => {
    expect(one("- [ ] [T003] [US1] do it (see the spec)")).toMatchObject({ paths: [], pathIssue: "missing" });
  });
  it("flags a task with no group as missing", () => {
    expect(one("- [ ] [T004] do it")).toMatchObject({ paths: [], pathIssue: "missing" });
  });
  it("flags globs as invalid", () => {
    expect(one("- [ ] [T005] do it (src/**/*.ts)")).toMatchObject({ paths: [], pathIssue: "glob" });
  });
  it("uses only the last group", () => {
    expect(one("- [ ] [T006] do it (src/a.ts) then more (src/b.ts)").paths).toEqual(["src/b.ts"]);
  });
  it("keeps the description unchanged (pre-015 consumers)", () => {
    expect(one("- [ ] [T002] [P] [US1] add endpoint (api/x.ts)").description).toBe("add endpoint (api/x.ts)");
  });
});

describe("parseTasks — phases", () => {
  it("assigns phase from `## Phase N`, the ordinal for unnumbered headings, and 0 before any", () => {
    const body = [
      "- [ ] [T001] before (a.ts)",
      "## Phase 3 — Stories",
      "- [ ] [T002] in three (b.ts)",
      "## Polish",
      "- [ ] [T003] ordinal (c.ts)",
    ].join("\n");
    expect(parseTasks(body).map((t) => t.phase)).toEqual([0, 3, 2]);
  });
  it("parses a fixture-built file, including checked lines and CRLF", () => {
    const body = tasksMd(
      [
        phase(1, [{ id: "T001", parallel: true, done: true, paths: ["a/x.ts"] }]),
        phase(2, [{ id: "T002", story: 1, paths: null }]),
      ],
      { eol: "\r\n" },
    );
    const t = parseTasks(body);
    expect(t.map((x) => [x.id, x.done, x.phase, x.parallel])).toEqual([
      ["T001", true, 1, true],
      ["T002", false, 2, false],
    ]);
    expect(t[1]!.pathIssue).toBe("missing");
  });
  it("parses a pre-015 tasks.md without error (SC-004)", () => {
    const old = "# Tasks\n\n- [x] [T001] [US1] create table (db/x.sql)\n- [ ] [T002] [US1] add endpoint\n";
    const t = parseTasks(old);
    expect(t).toHaveLength(2);
    expect(t[1]!.pathIssue).toBe("missing");
  });
});
