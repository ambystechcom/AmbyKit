import { describe, expect, it } from "vitest";
import { conflicts, ownershipOf, sharedFiles } from "../../src/core/fleet-plan/ownership.js";
import { model } from "../helpers/fleet-plan-fixture.js";

const own = (tasks: Parameters<typeof model>[0]["tasks"]) => ownershipOf(model({ dir: "031-x", tasks }));

describe("fleet ownership (feature 031)", () => {
  it("031:FR-004: the feature's files are the union of its open tasks' declared paths", () => {
    const o = own([
      { id: "T001", paths: ["src/b.ts", "src/a.ts"] },
      { id: "T002", paths: ["src/a.ts"] },
      { id: "T003", done: true, paths: ["src/done.ts"] },
    ]);
    expect(o).toEqual({ files: ["src/a.ts", "src/b.ts"], unknown: [] });
  });

  it("031:FR-006: an open task with no ownership, or a glob, puts the feature in `unknown` by task id", () => {
    const o = own([
      { id: "T001", paths: ["src/a.ts"] },
      { id: "T002", paths: null },
      { id: "T003", paths: "glob" },
      { id: "T004", done: true, paths: null },
    ]);
    expect(o.unknown).toEqual(["T002", "T003"]);
    expect(o.files).toEqual(["src/a.ts"]);
  });

  it("031:FR-004: a directory overlaps the files under it; unrelated files do not", () => {
    expect(sharedFiles({ files: ["src/core"], unknown: [] }, { files: ["src/core/a.ts", "src/cli/b.ts"], unknown: [] })).toEqual(["src/core/a.ts"]);
    expect(conflicts({ files: ["src/a.ts"], unknown: [] }, { files: ["src/b.ts"], unknown: [] })).toBe(false);
  });

  it("031:FR-006: unknown ownership conflicts with every other feature, never independent", () => {
    expect(conflicts({ files: [], unknown: ["T001"] }, { files: ["src/z.ts"], unknown: [] })).toBe(true);
  });
});
