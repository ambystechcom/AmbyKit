import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { directiveAction, directivePath, directiveStatus, readDirective } from "../../src/core/fleet/directives.js";
import { createRun } from "../../src/core/fleet/runs.js";

const root = () => {
  const r = mkdtempSync(join(tmpdir(), "ambykit-dir-"));
  mkdirSync(join(r, ".amby"));
  return r;
};
const runOf = (r: string): string => {
  const out = createRun(r, "a-one");
  if (!out.ok) throw new Error(out.warning);
  return out.run.run;
};
const put = (r: string, run: string, lane: string, body: unknown): void => {
  const p = directivePath(r, run, lane);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body));
};
const T0 = "2026-11-16T10:00:00.000Z";
const before = "2026-11-16T09:59:00.000Z";
const after = "2026-11-16T10:01:00.000Z";

describe("directive reader", () => {
  it("025:FR-010: lives at .amby/fleet/<run>/directives/<short lane>.json", () => {
    const r = root();
    const run = runOf(r);
    expect(directivePath(r, run, "a-one.lane-2-1").replace(/\\/g, "/")).toMatch(/\.amby\/fleet\/a-one\.1\/directives\/lane-2-1\.json$/);
    expect(directivePath(r, run, "lane-2-1")).toBe(directivePath(r, run, "a-one.lane-2-1"));
  });

  it("025:FR-011: a missing file means continue", () => {
    const r = root();
    const run = runOf(r);
    expect(readDirective(r, run, "lane-1-1")).toBeNull();
    expect(directiveAction(null)).toBe("continue");
  });

  it("025:FR-010: reads { action, at }; the directive keeps being returned until a new one is written", () => {
    const r = root();
    const run = runOf(r);
    put(r, run, "lane-1-1", { action: "pause", at: T0 });
    expect(readDirective(r, run, "lane-1-1")).toEqual({ action: "pause", at: T0 });
    expect(readDirective(r, run, "lane-1-1")).toEqual({ action: "pause", at: T0 });
    put(r, run, "lane-1-1", { action: "stop", at: after });
    expect(readDirective(r, run, "a-one.lane-1-1")?.action).toBe("stop");
  });

  it("025:FR-011: an unreadable or malformed directive is read as continue, never a failure", () => {
    const r = root();
    const run = runOf(r);
    for (const body of ["{nope", { action: "explode", at: T0 }, { action: "pause" }, { action: "pause", at: "yesterday" }]) {
      put(r, run, "lane-1-1", body);
      expect(readDirective(r, run, "lane-1-1")).toBeNull();
    }
  });
});

describe("directiveStatus (FR-022)", () => {
  const pause = { action: "pause", at: T0 } as const;
  const stop = { action: "stop", at: T0 } as const;
  const cont = { action: "continue", at: T0 } as const;

  it("025:FR-022: no directive: none", () => {
    expect(directiveStatus(null, { at: T0, state: "working" })).toBe("none");
  });

  it("025:FR-022: pause requested while a pause exists and the lane is not paused", () => {
    expect(directiveStatus(pause, { at: before, state: "working" })).toBe("pause requested");
    expect(directiveStatus(pause, { at: after, state: "working" })).toBe("pause requested");
    expect(directiveStatus(pause, null)).toBe("pause requested");
  });

  it("025:FR-022: paused when the lane's state is paused", () => {
    expect(directiveStatus(pause, { at: after, state: "paused" })).toBe("paused");
  });

  it("025:FR-022: pending while a directive is newer than the lane's latest report, or there is none", () => {
    expect(directiveStatus(stop, { at: before, state: "working" })).toBe("pending");
    expect(directiveStatus(cont, null)).toBe("pending");
    expect(directiveStatus(stop, { at: T0, state: "working" })).toBe("pending"); // a tie counts as before
  });

  it("025:FR-022: obeyed when the lane's next report is dated after the directive", () => {
    expect(directiveStatus(stop, { at: after, state: "done" })).toBe("obeyed");
    expect(directiveStatus(cont, { at: after, state: "working" })).toBe("obeyed");
  });
});
