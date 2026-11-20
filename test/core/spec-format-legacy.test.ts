import { afterEach, describe, expect, it } from "vitest";
import { readSpec, readTasks } from "../../src/core/spec-format/dispatch.js";
import {
  LEGACY_REFUSED_KIND,
  activeTally,
  beginTally,
  endTally,
  legacyEnabled,
  legacyFeatures,
  legacyWarningLine,
  refuseLegacy,
} from "../../src/core/spec-format/legacy.js";
import { FormatTally } from "../../src/core/spec-format/model.js";
import { fixture } from "../helpers/spec-project.js";

afterEach(() => endTally());

const V1_SPEC = fixture("edge-rich", "spec.v1.md");
const V2_SPEC = fixture("edge-rich", "spec.v2.md");
const V1_TASKS = fixture("edge-rich", "tasks.v1.md");
const V2_TASKS = fixture("edge-rich", "tasks.v2-phase.md");

describe("the 1.x warning switches (030, US-6, FR-012)", () => {
  it("030:FR-012: the warning is on by default and off with legacyWarning: false or AMBYKIT_LEGACY_WARNING=0", () => {
    expect(legacyEnabled(undefined, {})).toBe(true);
    expect(legacyEnabled({}, {})).toBe(true);
    expect(legacyEnabled({ legacyWarning: true }, {})).toBe(true);
    expect(legacyEnabled({ legacyWarning: false }, {})).toBe(false);
    expect(legacyEnabled({}, { AMBYKIT_LEGACY_WARNING: "0" })).toBe(false);
    expect(legacyEnabled({}, { AMBYKIT_LEGACY_WARNING: "false" })).toBe(false);
    expect(legacyEnabled({}, { AMBYKIT_LEGACY_WARNING: "1" })).toBe(true);
  });

  it("030:FR-012: the line gives the count and how to migrate, in one sentence pair", () => {
    expect(legacyWarningLine(1)).toBe("1 file uses the 1.x spec format (read as before). Run `ambykit migrate` to upgrade; support ends in 2.1.");
    expect(legacyWarningLine(12)).toBe("12 files use the 1.x spec format (read as before). Run `ambykit migrate` to upgrade; support ends in 2.1.");
  });
});

describe("tally (030, FR-012)", () => {
  it("030:FR-012: files read with a name are recorded by format in the running command's tally", () => {
    const tally = beginTally();
    readSpec("900-x", V1_SPEC, { file: "specs/900-x/spec.md" });
    readTasks(V1_TASKS, { file: "specs/900-x/tasks.md" });
    readSpec("901-y", V2_SPEC, { file: "specs/901-y/spec.md" });
    readTasks(V2_TASKS, { file: "specs/901-y/tasks.md" });
    expect([...tally.v1].sort()).toEqual(["specs/900-x/spec.md", "specs/900-x/tasks.md"]);
    expect([...tally.v2].sort()).toEqual(["specs/901-y/spec.md", "specs/901-y/tasks.md"]);
    expect(activeTally()).toBe(tally);
    expect(legacyFeatures(tally)).toEqual(["900-x"]);
  });

  it("030:FR-012: a read without a file name (history blobs, git show) is never tallied", () => {
    const tally = beginTally();
    readTasks(V1_TASKS);
    readSpec("900-x", V1_SPEC);
    expect(tally.v1.size).toBe(0);
  });

  it("030:FR-012: a file read twice counts once, and an explicit tally wins over the active one", () => {
    const active = beginTally();
    const mine = new FormatTally();
    readTasks(V1_TASKS, { file: "specs/900-x/tasks.md", tally: mine });
    readTasks(V1_TASKS, { file: "specs/900-x/tasks.md", tally: mine });
    expect(mine.v1.size).toBe(1);
    expect(active.v1.size).toBe(0);
  });

  it("030:FR-012: outside a command run there is no active tally", () => {
    endTally();
    expect(activeTally()).toBeNull();
    expect(() => readTasks(V1_TASKS, { file: "specs/900-x/tasks.md" })).not.toThrow();
  });
});

describe("2.1 refusal, built now and dormant (030, FR-013)", () => {
  it("030:FR-013: refuseLegacy is false for every 1.x and 2.0.x version and true from 2.1.0", () => {
    for (const v of ["1.5.0", "1.99.99", "2.0.0", "2.0.9", "2.0.0-rc.1"]) expect(refuseLegacy(v), v).toBe(false);
    for (const v of ["2.1.0", "2.1.3", "2.10.0", "3.0.0", "10.0.0"]) expect(refuseLegacy(v), v).toBe(true);
  });

  it("030:FR-013: from 2.1 a 1.x spec is refused with an error naming the file and saying to migrate with 2.0", () => {
    const r = readSpec("900-x", V1_SPEC, { file: "specs/900-x/spec.md", version: "2.1.0" });
    expect(r.stories).toEqual([]);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ severity: "error", kind: LEGACY_REFUSED_KIND, file: "specs/900-x/spec.md" });
    expect(r.issues[0]?.message).toMatch(/specs\/900-x\/spec\.md uses the 1\.x spec format.*migrate it with AmbyKit 2\.0/);
  });

  it("030:FR-013: from 2.1 a 1.x tasks file is refused the same way", () => {
    const r = readTasks(V1_TASKS, { file: "specs/900-x/tasks.md", version: "2.1.0" });
    expect(r.tasks).toEqual([]);
    expect(r.phases).toEqual([]);
    expect(r.issues[0]).toMatchObject({ kind: LEGACY_REFUSED_KIND, file: "specs/900-x/tasks.md" });
  });

  it("030:FR-013: v2 files are unaffected by the refusal", () => {
    expect(readSpec("900-x", V2_SPEC, { version: "2.1.0" }).stories.length).toBeGreaterThan(0);
    expect(readTasks(V2_TASKS, { version: "2.1.0" }).tasks.length).toBeGreaterThan(0);
  });

  it("030:FR-012: below 2.1 the same files read exactly as before", () => {
    const r = readSpec("900-x", V1_SPEC, { version: "2.0.3" });
    expect(r.issues).toEqual([]);
    expect(r.stories.length).toBeGreaterThan(0);
  });

  it("030:FR-013: the installed version (1.5.0 today) does not refuse", () => {
    expect(readSpec("900-x", V1_SPEC).issues).toEqual([]);
  });
});
