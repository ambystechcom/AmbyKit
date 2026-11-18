import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseStories, parseTasks } from "../../src/core/dashboard.js";
import { parsePhases } from "../../src/core/markers.js";
import { readPhases, readSpec, readTasks } from "../../src/core/spec-format/dispatch.js";
import { FormatTally } from "../../src/core/spec-format/model.js";
import { ROOT } from "../helpers/spec-project.js";

const spec = readFileSync(join(ROOT, "specs", "020-blocked-and-verify", "spec.md"), "utf8");
const tasks = readFileSync(join(ROOT, "specs", "020-blocked-and-verify", "tasks.md"), "utf8");

describe("dispatcher, 1.x path (030, T013)", () => {
  it("030:FR-012: a 1.x spec reads exactly what parseStories returns, format 1, no issues", () => {
    const r = readSpec("020-blocked-and-verify", spec);
    expect(r.format).toBe(1);
    expect(r.stories).toEqual(parseStories(spec, "020-blocked-and-verify"));
    expect(r.issues).toEqual([]);
    expect(r.dependsOn).toEqual([]);
    expect(r.meta.feature).toBe("020-blocked-and-verify");
  });

  it("030:FR-012: a 1.x tasks file reads exactly what parseTasks and parsePhases return", () => {
    const r = readTasks(tasks);
    expect(r.format).toBe(1);
    expect(r.tasks).toEqual(parseTasks(tasks));
    expect(r.phases).toEqual(parsePhases(tasks));
    expect(readPhases(tasks)).toEqual(r.phases);
    expect(r.issues).toEqual([]);
  });

  it("030:FR-012: the tally hook records the format of every file read", () => {
    const tally = new FormatTally();
    readSpec("020-blocked-and-verify", spec, { file: "specs/020/spec.md", tally });
    readTasks(tasks, { file: "specs/020/tasks.md", tally });
    expect([...tally.v1].sort()).toEqual(["specs/020/spec.md", "specs/020/tasks.md"]);
    expect(tally.v2.size).toBe(0);
  });
});
