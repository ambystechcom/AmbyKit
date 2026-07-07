import { describe, expect, it } from "vitest";
import { paint, symbols, spinnerFrames } from "../../src/cli/ui/theme.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

describe("theme.paint", () => {
  it("wraps with ANSI when color is enabled, and the plain text survives stripping", () => {
    const out = paint(fakeCapabilities({ color: true }), "success", "done");
    expect(out).not.toBe("done");
    expect(hasAnsi(out)).toBe(true);
    expect(stripAnsi(out)).toBe("done");
  });

  it("emits zero ANSI when color is disabled (FR-003)", () => {
    const out = paint(fakeCapabilities({ color: false }), "success", "done");
    expect(out).toBe("done");
    expect(hasAnsi(out)).toBe(false);
  });
});

describe("theme.symbols", () => {
  it("uses unicode glyphs when unicode is enabled", () => {
    const s = symbols(fakeCapabilities({ unicode: true }));
    expect(s.success).toBe("✓");
    expect(s.barFill).toBe("█");
    expect(s.error).toBe("✗");
  });

  it("falls back to ASCII when unicode is disabled (FR-012)", () => {
    const s = symbols(fakeCapabilities({ unicode: false }));
    expect(s.success).toBe("[ok]");
    expect(s.barFill).toBe("#");
    expect(s.error).toBe("x");
    expect(s.checked).toBe("(*)");
  });
});

describe("theme.spinnerFrames", () => {
  it("switches the frame set by unicode capability", () => {
    expect(spinnerFrames(fakeCapabilities({ unicode: true }))[0]).toBe("⠋");
    expect(spinnerFrames(fakeCapabilities({ unicode: false }))).toContain("|");
  });
});
