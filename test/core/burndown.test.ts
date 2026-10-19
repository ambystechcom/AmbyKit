import { describe, expect, it } from "vitest";
import {
  buildBurndown,
  choosePeriods,
  parseCatFileBatch,
  periodStart,
  readBurndown,
  scopeOf,
} from "../../src/core/burndown.js";
import { readFeatures } from "../../src/core/features.js";
import { applyFilters } from "../../src/core/overview.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { gitHistoryFixture } from "../helpers/git-history-fixture.js";

const utc = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

describe("burndown periods (pure)", () => {
  it("weeks start on Monday (UTC)", () => {
    expect(new Date(periodStart(utc("2026-08-13"), "weekly")).toISOString().slice(0, 10)).toBe("2026-08-10");
    expect(new Date(periodStart(utc("2026-08-13"), "monthly")).toISOString().slice(0, 10)).toBe("2026-08-01");
  });

  it("picks the finest period that fits, else the most recent months", () => {
    expect(choosePeriods(utc("2026-08-01"), utc("2026-08-05"), 10).period).toBe("daily");
    expect(choosePeriods(utc("2026-08-01"), utc("2026-09-30"), 10).period).toBe("weekly");
    const m = choosePeriods(utc("2024-01-01"), utc("2026-08-01"), 6);
    expect(m.period).toBe("monthly");
    expect(m.starts).toHaveLength(6);
  });

  it("carries values forward, ends on the working tree, and needs min points (I-8)", () => {
    const starts = [utc("2026-08-03"), utc("2026-08-10"), utc("2026-08-17")];
    const b = buildBurndown("weekly", starts, [{ total: 10, remaining: 8 }, null], { total: 10, remaining: 3 }, 2);
    expect(b.points.map((p) => p.remaining)).toEqual([8, 8, 3]);
    expect(b.deltaRemaining).toBe(-5);
    expect(buildBurndown("daily", [utc("2026-08-03")], [], { total: 1, remaining: 1 }, 2)).toEqual({
      status: "no-history",
      reason: "too-little-history",
      points: [],
    });
  });

  it("parses cat-file --batch output, including missing objects", () => {
    const out = Buffer.from("abc blob 5\nhello\nxyz:./a missing\ndef blob 3\nhé\n");
    expect(parseCatFileBatch(out, 3)).toEqual(["hello", null, "hé"]);
  });
});

describe.skipIf(!HAS_GIT)("readBurndown from git history (US-7, FR-018, FR-019)", () => {
  const steps = [
    { date: "2026-08-03", done: 0, total: 10 },
    { date: "2026-08-12", done: 4 },
    { date: "2026-08-20", done: 7, total: 12 },
  ];
  const now = utc("2026-08-26");

  function burndownFor(root: string, filters = {}, maxPeriods = 10) {
    const { features } = readFeatures(root);
    const { scope, current } = scopeOf(applyFilters(features, filters), false);
    return readBurndown({ root, scope, current, maxPeriods, minPoints: 2, now });
  }

  it("remaining per period matches the committed check-offs", () => {
    const b = burndownFor(gitHistoryFixture("001-x", steps));
    expect(b.status).toBe("ready");
    expect(b.period).toBe("weekly");
    expect(b.points).toEqual([
      { periodStart: "2026-08-03", total: 10, remaining: 10 },
      { periodStart: "2026-08-10", total: 10, remaining: 6 },
      { periodStart: "2026-08-17", total: 12, remaining: 5 },
      { periodStart: "2026-08-24", total: 12, remaining: 5 },
    ]);
    expect(b.deltaRemaining).toBe(0);
  });

  it("daily periods when they fit", () => {
    expect(burndownFor(gitHistoryFixture("001-x", steps), {}, 30).period).toBe("daily");
  });

  it("scopes to the filtered features only", () => {
    const root = gitHistoryFixture("001-x", steps);
    const b = burndownFor(root, { feature: "002" });
    expect(b.status).toBe("no-history"); // no such feature → empty scope
  });

  it("not a git repo → no-history: not-a-repo", () => {
    expect(burndownFor(dashboardFixture())).toEqual({ status: "no-history", reason: "not-a-repo", points: [] });
  });

  it("too little history → no-history", () => {
    const root = gitHistoryFixture("001-x", [{ date: "2026-08-26", done: 1, total: 3 }]);
    expect(burndownFor(root, {}, 30)).toEqual({ status: "no-history", reason: "too-little-history", points: [] });
  });
});
