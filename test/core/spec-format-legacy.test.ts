import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSpec, readTasks } from "../../src/core/spec-format/dispatch.js";
import {
  LEGACY_DECISION_TITLE,
  LEGACY_READING,
  LEGACY_REFUSED_KIND,
  activeTally,
  beginTally,
  endTally,
  legacyEnabled,
  legacyFeatures,
  legacyOffProblems,
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

describe("the 1.x refusal behind one explicit switch (030:FR-013, 035:FR-002)", () => {
  it("035:FR-002: refuseLegacy follows the switch only, and the switch is on (no version can end 1.x reading)", () => {
    expect(refuseLegacy("on")).toBe(false);
    expect(refuseLegacy("off")).toBe(true);
    expect(LEGACY_READING, "LEGACY_READING stays on until 035's go decision is accepted (T080)").toBe("on");
    expect(refuseLegacy()).toBe(false);
  });

  it("035:FR-002: a version bump to 2.1.0 or later does not end 1.x reading", async () => {
    vi.resetModules();
    vi.doMock("../../src/core/paths.js", async (orig) => ({ ...(await orig<typeof import("../../src/core/paths.js")>()), packageVersion: () => "2.1.0" }));
    try {
      const { readSpec: read, readTasks: readT } = await import("../../src/core/spec-format/dispatch.js");
      const spec = read("900-x", V1_SPEC, { file: "specs/900-x/spec.md" });
      expect(spec.issues).toEqual([]);
      expect(spec.stories.length).toBeGreaterThan(0);
      expect(readT(V1_TASKS, { file: "specs/900-x/tasks.md" }).tasks.length).toBeGreaterThan(0);
    } finally {
      vi.doUnmock("../../src/core/paths.js");
      vi.resetModules();
    }
  });

  it("030:FR-013: with reading off a 1.x spec is refused with an error naming the file and saying to migrate", () => {
    const r = readSpec("900-x", V1_SPEC, { file: "specs/900-x/spec.md", legacyReading: "off" });
    expect(r.stories).toEqual([]);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ severity: "error", kind: LEGACY_REFUSED_KIND, file: "specs/900-x/spec.md" });
    expect(r.issues[0]?.message).toMatch(/specs\/900-x\/spec\.md uses the 1\.x spec format.*migrate it with AmbyKit/);
  });

  it("030:FR-013: with reading off a 1.x tasks file is refused the same way", () => {
    const r = readTasks(V1_TASKS, { file: "specs/900-x/tasks.md", legacyReading: "off" });
    expect(r.tasks).toEqual([]);
    expect(r.phases).toEqual([]);
    expect(r.issues[0]).toMatchObject({ kind: LEGACY_REFUSED_KIND, file: "specs/900-x/tasks.md" });
  });

  it("030:FR-013: v2 files are unaffected by the refusal", () => {
    expect(readSpec("900-x", V2_SPEC, { legacyReading: "off" }).stories.length).toBeGreaterThan(0);
    expect(readTasks(V2_TASKS, { legacyReading: "off" }).tasks.length).toBeGreaterThan(0);
  });

  it("030:FR-012: with reading on (today) the same files read exactly as before", () => {
    const r = readSpec("900-x", V1_SPEC);
    expect(r.issues).toEqual([]);
    expect(r.stories.length).toBeGreaterThan(0);
    expect(readSpec("900-x", V1_SPEC, { legacyReading: "on" }).stories).toEqual(r.stories);
  });
});

describe("the switch may go off only with 035's accepted go decision (035:FR-001, FR-002)", () => {
  const decisions = join(resolve(__dirname, "..", ".."), ".amby", "decisions");
  const GOOD = [
    "---",
    "id: ADR-099",
    `title: ${LEGACY_DECISION_TITLE}`,
    "status: accepted",
    "---",
    "- **Gate wording:** met, 2027-02-01, confirmed in 030 T090 and 035 D-1",
    "- **Adoption window:** met, 2027-02-01, 2.0.0 out since 2026-12-01 with 2.0.1 and 2.0.2",
    "- **No open migrate data-loss defect:** met, 2027-02-01, no open issue labelled migrate",
    "- **Documented path:** met, 2027-02-01, docs/migration.md",
  ].join("\n");

  it("035:FR-002: the repository's switch is allowed by its decision record", () => {
    const file = existsSync(decisions)
      ? readdirSync(decisions)
          .filter((f) => /^ADR-\d+\.md$/.test(f))
          .map((f) => readFileSync(join(decisions, f), "utf8"))
          .find((t) => new RegExp(`^title:\s*${LEGACY_DECISION_TITLE.replace(/\./g, "\.")}\s*$`, "m").test(t))
      : undefined;
    expect(legacyOffProblems(LEGACY_READING, file), "LEGACY_READING is off without an accepted go decision").toEqual([]);
  });

  it("035:FR-002: while on nothing is required; off needs an accepted record with every condition met, dated and evidenced", () => {
    expect(legacyOffProblems("on", undefined)).toEqual([]);
    expect(legacyOffProblems("off", undefined)).toEqual([`no decision record titled '${LEGACY_DECISION_TITLE}' in .amby/decisions/`]);
    expect(legacyOffProblems("off", GOOD)).toEqual([]);
    expect(legacyOffProblems("off", GOOD.replace("status: accepted", "status: proposed"))).toEqual(["the decision record is 'proposed', not 'accepted'"]);
    expect(legacyOffProblems("off", GOOD.replace(/- \*\*Documented path:\*\*.*/, ""))).toEqual(["the decision records no 'Documented path'"]);
    expect(legacyOffProblems("off", GOOD.replace(/(Adoption window:\*\*) met.*/, "$1 not met, 2027-02-01, only five weeks"))).toEqual([
      "'Adoption window' is 'not met, 2027-02-01, only five weeks', not met",
    ]);
    expect(legacyOffProblems("off", GOOD.replace(/(Gate wording:\*\*) met.*/, "$1 met, confirmed"))).toEqual(["'Gate wording' has no date"]);
    expect(legacyOffProblems("off", GOOD.replace(/(Gate wording:\*\*) met.*/, "$1 met, 2027-02-01"))).toEqual(["'Gate wording' has no evidence"]);
  });
});
