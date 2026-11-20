import { describe, expect, it } from "vitest";
import { nextTab, prevTab, tabByNumber, tabForKey, TABS } from "../../src/cli/ui/interactive/tabs.js";

describe("tab slice (feature 032, US-2)", () => {
  it("032:FR-004: there are four tabs in a fixed order", () => {
    expect([...TABS]).toEqual(["overview", "fleet", "graph", "quality"]);
  });

  it("032:FR-004: next and previous wrap around", () => {
    expect(nextTab("quality")).toBe("overview");
    expect(prevTab("overview")).toBe("quality");
    expect(nextTab("overview")).toBe("fleet");
  });

  it("032:FR-004: number keys 1-4 select a tab and anything else is a no-op", () => {
    expect(tabByNumber("3")).toBe("graph");
    expect(tabByNumber("5")).toBeNull();
    expect(tabByNumber("x")).toBeNull();
    expect(tabByNumber(undefined)).toBeNull();
  });

  it("032:FR-004: ] and [ move between tabs, an unknown key gives null", () => {
    expect(tabForKey("overview", { sequence: "]" })).toBe("fleet");
    expect(tabForKey("overview", { sequence: "[" })).toBe("quality");
    expect(tabForKey("graph", { sequence: "1" })).toBe("overview");
    expect(tabForKey("graph", { sequence: "z" })).toBeNull();
  });
});
