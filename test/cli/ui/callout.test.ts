import { describe, expect, it } from "vitest";
import { versionWarning } from "../../../src/cli/ui/callout.js";
import type { Capabilities } from "../../../src/cli/ui/types.js";

const caps = (over: Partial<Capabilities> = {}): Capabilities => ({
  isTTY: true,
  color: true,
  unicode: true,
  columns: 80,
  ...over,
});

describe("versionWarning callout (feature 010 / US-1)", () => {
  it("shows both versions and an actionable line when outdated", () => {
    const out = versionWarning(caps({ color: false }), "0.2.0", "1.0.0");
    expect(out).toContain("Update available");
    expect(out).toContain("0.2.0");
    expect(out).toContain("1.0.0");
    expect(out).toContain("ambykit update");
  });

  it("is suppressed when current, newer, dev placeholder, or latest unknown", () => {
    expect(versionWarning(caps(), "1.0.0", "1.0.0")).toBe("");
    expect(versionWarning(caps(), "1.1.0", "1.0.0")).toBe("");
    expect(versionWarning(caps(), "0.0.0", "1.0.0")).toBe(""); // dev placeholder (FR-013)
    expect(versionWarning(caps(), "0.2.0", null)).toBe(""); // offline (FR-005)
  });

  it("uses a unicode box + arrow when supported", () => {
    const out = versionWarning(caps({ color: false }), "0.2.0", "1.0.0");
    expect(out).toContain("┌");
    expect(out).toContain("│");
    expect(out).toContain("→");
  });

  it("degrades to an ASCII box + arrow without unicode (FR-003)", () => {
    const out = versionWarning(caps({ color: false, unicode: false }), "0.2.0", "1.0.0");
    expect(out).toContain("+");
    expect(out).toContain("|");
    expect(out).toContain("->");
    expect(out).not.toContain("┌");
    expect(out).not.toContain("→");
  });

  it("emits no ANSI when color is off; yellow SGR when on", () => {
    expect(versionWarning(caps({ color: false }), "0.2.0", "1.0.0")).not.toContain("\x1b[");
    expect(versionWarning(caps({ color: true }), "0.2.0", "1.0.0")).toContain("\x1b[33m");
  });
});
