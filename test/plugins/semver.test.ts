import { describe, expect, it } from "vitest";
import { isExactVersion, parseVersion, satisfies } from "../../src/plugins/semver.js";

const ok = (v: string, r: string) => {
  const res = satisfies(v, r);
  if (!res.supported) throw new Error(res.reason);
  return res.satisfied;
};

describe("plugin range check (feature 027)", () => {
  it("027:FR-010: exact versions match only themselves", () => {
    expect(ok("1.0.0", "1.0.0")).toBe(true);
    expect(ok("1.0.1", "1.0.0")).toBe(false);
    expect(ok("1.0.0", "=1.0.0")).toBe(true);
  });

  it("027:FR-010: ^1 contains 1.0.0 and excludes 2.0.0", () => {
    expect(ok("1.0.0", "^1")).toBe(true);
    expect(ok("1.9.3", "^1")).toBe(true);
    expect(ok("2.0.0", "^1")).toBe(false);
    expect(ok("1.0.0", "^1.2")).toBe(false);
  });

  it("027:FR-010: ^0.x pins the minor and ^0.0.x the patch", () => {
    expect(ok("0.2.5", "^0.2.3")).toBe(true);
    expect(ok("0.3.0", "^0.2.3")).toBe(false);
    expect(ok("0.0.3", "^0.0.3")).toBe(true);
    expect(ok("0.0.4", "^0.0.3")).toBe(false);
  });

  it("027:FR-010: ~ allows patch changes, or minor when only the major is given", () => {
    expect(ok("1.2.9", "~1.2.3")).toBe(true);
    expect(ok("1.3.0", "~1.2.3")).toBe(false);
    expect(ok("1.9.0", "~1")).toBe(true);
    expect(ok("2.0.0", "~1")).toBe(false);
  });

  it("027:FR-010: comparators combine with a space (AND) and || (OR)", () => {
    expect(ok("1.5.0", ">=1.2.0 <2.0.0")).toBe(true);
    expect(ok("2.0.0", ">=1.2.0 <2.0.0")).toBe(false);
    expect(ok("3.1.0", "^1 || ^3")).toBe(true);
    expect(ok("2.1.0", "^1 || ^3")).toBe(false);
    expect(ok("1.0.0", ">1.0.0")).toBe(false);
    expect(ok("1.0.0", "<=1.0.0")).toBe(true);
  });

  it("027:FR-010: an unsupported range says why instead of guessing", () => {
    for (const range of ["latest", "1.x", "1", "", "^1 ||", ">=1.0.0-beta"]) {
      const res = satisfies("1.0.0", range);
      expect(res.supported, range).toBe(false);
      if (!res.supported) expect(res.reason.length, range).toBeGreaterThan(0);
    }
  });

  it("027:FR-006: only x.y.z is an exact pin", () => {
    expect(isExactVersion("1.2.3")).toBe(true);
    for (const v of ["^1.2.3", "1.2", "latest", "1.2.3-beta", " "]) expect(isExactVersion(v), v).toBe(false);
    expect(parseVersion("10.20.30")).toEqual({ major: 10, minor: 20, patch: 30 });
  });
});
