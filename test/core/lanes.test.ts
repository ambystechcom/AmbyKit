import { describe, expect, it } from "vitest";
const BS = String.fromCharCode(92);
import { laneName, normalizePath, overlaps, parseLaneName } from "../../src/core/lanes.js";

describe("normalizePath", () => {
  it("converts backslashes, drops ./ and trailing /, collapses //, lower-cases", () => {
    expect(normalizePath(["src", "Core", "Lanes.ts"].join(BS))).toBe("src/core/lanes.ts");
    expect(normalizePath("./src//core/")).toBe("src/core");
    expect(normalizePath("././a/B/")).toBe("a/b");
  });
});

describe("overlaps", () => {
  it("is true for equal paths and for a directory and anything beneath it", () => {
    expect(overlaps("src/a.ts", "src/a.ts")).toBe(true);
    expect(overlaps("src/core", "src/core/lanes.ts")).toBe(true);
    expect(overlaps("src/core/lanes.ts", "src/core")).toBe(true);
  });
  it("is false for siblings and for a shared string prefix that is not a path prefix", () => {
    expect(overlaps("src/a.ts", "src/b.ts")).toBe(false);
    expect(overlaps("src/core", "src/core-extra/x.ts")).toBe(false);
    expect(overlaps("test/a.test.ts", "test/a.ts")).toBe(false);
  });
});

describe("lane names", () => {
  it("round-trips", () => {
    const name = laneName("015-parallel-lanes", 3, 2);
    expect(name).toBe("015-parallel-lanes.lane-3-2");
    expect(parseLaneName(name)).toEqual({ feature: "015-parallel-lanes", phase: 3, index: 2 });
  });
  it("rejects feature ids and malformed names", () => {
    expect(parseLaneName("015-parallel-lanes")).toBeNull();
    expect(parseLaneName("015-x.lane-a-1")).toBeNull();
    expect(parseLaneName("x.lane-1-1")).toBeNull();
  });
});
