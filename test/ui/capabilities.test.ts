import { describe, expect, it } from "vitest";
import { detectCapabilities } from "../../src/cli/ui/capabilities.js";

describe("detectCapabilities", () => {
  it("non-TTY ⇒ no color, no unicode, default width (FR-002/012)", () => {
    const caps = detectCapabilities({ env: { LANG: "en_US.UTF-8" }, stdout: { isTTY: false } });
    expect(caps).toEqual({ isTTY: false, color: false, unicode: false, columns: 80 });
  });

  it("NO_COLOR disables color on a TTY but keeps width/unicode (FR-003)", () => {
    const caps = detectCapabilities({
      env: { NO_COLOR: "1", LANG: "C.UTF-8" },
      stdout: { isTTY: true, columns: 120 },
    });
    expect(caps.color).toBe(false);
    expect(caps.unicode).toBe(true);
    expect(caps.columns).toBe(120);
  });

  it("empty NO_COLOR is treated as unset (color stays on)", () => {
    const caps = detectCapabilities({ env: { NO_COLOR: "", LANG: "C.UTF-8" }, stdout: { isTTY: true } });
    expect(caps.color).toBe(true);
  });

  it("TERM=dumb disables color", () => {
    const caps = detectCapabilities({ env: { TERM: "dumb", LANG: "C.UTF-8" }, stdout: { isTTY: true } });
    expect(caps.color).toBe(false);
  });

  it("non-UTF-8 locale ⇒ ASCII fallback (unicode=false) (FR-012)", () => {
    const caps = detectCapabilities({ env: { LANG: "C" }, stdout: { isTTY: true } });
    expect(caps.unicode).toBe(false);
  });

  it("UTF-8 locale on a TTY ⇒ unicode", () => {
    const caps = detectCapabilities({ env: { LC_ALL: "en_US.UTF-8" }, stdout: { isTTY: true } });
    expect(caps.unicode).toBe(true);
  });

  it("Windows Terminal signal implies unicode", () => {
    const caps = detectCapabilities({ env: { WT_SESSION: "abc" }, stdout: { isTTY: true } });
    expect(caps.unicode).toBe(true);
  });

  it("invariant: non-TTY forces color+unicode off even with UTF-8 + WT_SESSION", () => {
    const caps = detectCapabilities({
      env: { WT_SESSION: "x", LANG: "en_US.UTF-8" },
      stdout: { isTTY: false },
    });
    expect(caps.color).toBe(false);
    expect(caps.unicode).toBe(false);
  });

  it("zero/undefined columns fall back to 80 (FR-007)", () => {
    expect(detectCapabilities({ stdout: { isTTY: true, columns: 0 } }).columns).toBe(80);
    expect(detectCapabilities({ stdout: { isTTY: true } }).columns).toBe(80);
  });
});
