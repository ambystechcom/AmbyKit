import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVITY_DIR, readMarkers } from "../../src/core/activity.js";
import { directivePath } from "../../src/core/fleet/directives.js";
import { createRun, listRuns, updateRun } from "../../src/core/fleet/runs.js";
import { fullLaneName, reportActivity } from "../../src/core/report.js";

const root = () => {
  const r = mkdtempSync(join(tmpdir(), "ambykit-report-"));
  mkdirSync(join(r, ".amby"));
  return r;
};
const base = { feature: "a-one", agent: "claude", phase: "implement", state: "working", fleet: true } as const;
const startRun = (r: string): string => {
  const out = createRun(r, "a-one");
  if (!out.ok) throw new Error(out.warning);
  return out.run.run;
};
const directive = (r: string, run: string, lane: string, action: string, at = new Date().toISOString()): void => {
  const p = directivePath(r, run, lane);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify({ action, at }));
};

describe("reportActivity", () => {
  it("025:FR-007: writes the marker and returns an acknowledgement with a continue directive", () => {
    const r = root();
    const run = startRun(r);
    const out = reportActivity(r, { ...base, task: "T001", lane: "1-1" });
    expect(out).toMatchObject({ ack: true, directive: "continue", run });
    expect(out.warning).toBeUndefined();
    expect(readMarkers(r)).toMatchObject([{ agent: "claude", phase: "implement", task: "T001", state: "working", lane: "a-one.lane-1-1", run }]);
  });

  it("025:FR-009: returns the lane's pause directive, and stop", () => {
    const r = root();
    const run = startRun(r);
    directive(r, run, "lane-1-1", "pause", "2026-01-01T00:00:00.000Z");
    expect(reportActivity(r, { ...base, lane: "lane-1-1" })).toMatchObject({ directive: "pause", directiveStatus: "pause requested" });
    directive(r, run, "lane-1-1", "stop", "2026-01-01T00:00:00.000Z");
    expect(reportActivity(r, { ...base, lane: "a-one.lane-1-1" })).toMatchObject({ directive: "stop", directiveStatus: "obeyed" });
  });

  it("025:FR-011: a directive is per lane: another lane continues", () => {
    const r = root();
    const run = startRun(r);
    directive(r, run, "lane-1-1", "pause");
    expect(reportActivity(r, { ...base, lane: "lane-1-2" }).directive).toBe("continue");
  });

  it("025:FR-008: two lanes of one agent leave two markers", () => {
    const r = root();
    startRun(r);
    reportActivity(r, { ...base, lane: "1-1" });
    reportActivity(r, { ...base, lane: "1-2" });
    expect(readdirSync(join(r, ACTIVITY_DIR)).filter((n) => n.endsWith(".json")).sort()).toEqual(["a-one.claude~lane-1-1.json", "a-one.claude~lane-1-2.json"]);
  });

  it("025:FR-024: no unfinished run: a warning, the marker is still written, no run is created", () => {
    const r = root();
    const out = reportActivity(r, { ...base, lane: "1-1" });
    expect(out.ack).toBe(true);
    expect(out.warning).toMatch(/no unfinished run/);
    expect(out.directive).toBe("continue");
    expect(readMarkers(r)).toHaveLength(1);
    expect(listRuns(r)).toEqual([]);
  });

  it("025:FR-024: several unfinished runs: a warning naming them, never a failure", () => {
    const r = root();
    startRun(r);
    startRun(r);
    const out = reportActivity(r, { ...base, lane: "1-1" });
    expect(out.ack).toBe(true);
    expect(out.warning).toMatch(/a-one\.1.*a-one\.2/);
  });

  it("025:FR-024: an explicit run picks the right one among several", () => {
    const r = root();
    startRun(r);
    const second = startRun(r);
    directive(r, second, "lane-1-1", "stop");
    expect(reportActivity(r, { ...base, lane: "1-1", run: second })).toMatchObject({ directive: "stop", run: second });
  });

  it("025:FR-024: a finished run is not an unfinished run", () => {
    const r = root();
    const run = startRun(r);
    updateRun(r, run, { status: "done" });
    expect(reportActivity(r, { ...base, lane: "1-1" }).warning).toMatch(/no unfinished run/);
  });

  it("025:FR-012: a bad state or agent is a warning, not an exception", () => {
    const r = root();
    expect(reportActivity(r, { ...base, state: "sleeping" })).toMatchObject({ ack: false, directive: "continue" });
    expect(reportActivity(r, { ...base, agent: "../x" }).warning).toMatch(/invalid agent/);
    expect(readMarkers(r)).toEqual([]);
  });

  it("025:FR-012: an unwritable marker directory is a warning, not an exception", () => {
    const r = root();
    mkdirSync(join(r, ".amby"), { recursive: true });
    writeFileSync(join(r, ".amby", "activity"), "i am a file, not a directory");
    const out = reportActivity(r, { ...base });
    expect(out.ack).toBe(false);
    expect(out.warning).toMatch(/not recorded/);
  });

  it("025:FR-021: without fleet lookups a plain report looks nothing up and warns nothing", () => {
    const r = root();
    const out = reportActivity(r, { feature: "a-one", agent: "claude", phase: "plan" });
    expect(out).toEqual({ ack: true, directive: "continue" });
  });

  it("025:FR-007: a plain marker body is byte-identical to a 017 marker", () => {
    const r = root();
    reportActivity(r, { feature: "a-one", agent: "claude", phase: "plan", task: "T001", pid: 9, now: new Date("2026-11-16T10:00:00.000Z") });
    expect(readFileSync(join(r, ACTIVITY_DIR, "a-one.claude.json"), "utf8")).toBe('{"agent":"claude","phase":"plan","task":"T001","at":"2026-11-16T10:00:00.000Z","pid":9}\n');
  });

  it("025:FR-006: fullLaneName accepts 1-2, lane-1-2 and the full name", () => {
    for (const l of ["1-2", "lane-1-2", "a-one.lane-1-2"]) expect(fullLaneName("a-one", l)).toBe("a-one.lane-1-2");
  });
});
