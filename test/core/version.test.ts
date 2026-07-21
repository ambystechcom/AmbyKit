import { describe, expect, it } from "vitest";
import { compareVersions, isDevPlaceholder, isOutdated } from "../../src/core/version.js";
import { packageVersion } from "../../src/core/paths.js";

describe("compareVersions (feature 010)", () => {
  it("orders by numeric x.y.z", () => {
    expect(compareVersions("1.0.0", "0.2.0")).toBe(1);
    expect(compareVersions("0.2.0", "1.0.0")).toBe(-1);
    expect(compareVersions("0.1.1", "0.1.2")).toBe(-1);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("ignores pre-release / build suffixes", () => {
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBe(0);
    expect(compareVersions("2.0.0-beta", "1.9.9")).toBe(1);
  });
});

describe("isDevPlaceholder", () => {
  it("treats 0.0.0 / empty as a placeholder", () => {
    expect(isDevPlaceholder("0.0.0")).toBe(true);
    expect(isDevPlaceholder("")).toBe(true);
    expect(isDevPlaceholder("1.0.0")).toBe(false);
  });
});

describe("isOutdated (FR-013)", () => {
  it("is true only for a real release strictly behind a known latest", () => {
    expect(isOutdated("0.2.0", "1.0.0")).toBe(true);
    expect(isOutdated("1.0.0", "1.0.0")).toBe(false);
    expect(isOutdated("1.1.0", "1.0.0")).toBe(false);
  });

  it("never outdated when latest is unknown or version is a dev placeholder", () => {
    expect(isOutdated("0.2.0", null)).toBe(false);
    expect(isOutdated("0.0.0", "1.0.0")).toBe(false);
  });
});

describe("packageVersion", () => {
  it("reads a non-empty version from the package", () => {
    expect(packageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
