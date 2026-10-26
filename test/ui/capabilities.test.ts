import { describe, expect, it } from "vitest";
import { detectCapabilities, iconMode } from "../../src/cli/ui/capabilities.js";

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

describe("detectCapabilities — truecolor + background (feature 014, R-3)", () => {
  it("COLORTERM=truecolor|24bit enables truecolor on a color TTY", () => {
    for (const v of ["truecolor", "24bit"]) {
      const caps = detectCapabilities({ env: { COLORTERM: v }, stdout: { isTTY: true } });
      expect(caps.truecolor).toBe(true);
    }
  });

  it("other or missing COLORTERM falls back to ansi16", () => {
    expect(detectCapabilities({ env: {}, stdout: { isTTY: true } }).truecolor).toBe(false);
    expect(detectCapabilities({ env: { COLORTERM: "yes" }, stdout: { isTTY: true } }).truecolor).toBe(false);
  });

  it("COLORFGBG background 7 or 15 is light; anything else or unset is dark", () => {
    const bg = (v?: string) =>
      detectCapabilities({ env: v === undefined ? {} : { COLORFGBG: v }, stdout: { isTTY: true } }).background;
    expect(bg("0;15")).toBe("light");
    expect(bg("0;default;7")).toBe("light");
    expect(bg("15;0")).toBe("dark");
    expect(bg()).toBe("dark");
  });

  it("no color ⇒ neither field is set", () => {
    const caps = detectCapabilities({ env: { COLORTERM: "truecolor", NO_COLOR: "1" }, stdout: { isTTY: true } });
    expect(caps.truecolor).toBeUndefined();
    expect(caps.background).toBeUndefined();
  });
});

describe("icon mode (feature 017, FR-025)", () => {
  const utf8 = { LANG: "en_US.UTF-8" };
  it("unicode by default, nerd only when AMBYKIT_ICONS=nerd", () => {
    expect(iconMode(detectCapabilities({ env: utf8, stdout: { isTTY: true } }))).toBe("unicode");
    const nerd = detectCapabilities({ env: { ...utf8, AMBYKIT_ICONS: "Nerd" }, stdout: { isTTY: true } });
    expect(nerd.icons).toBe("nerd");
    expect(iconMode(nerd)).toBe("nerd");
  });

  it("ASCII terminals ignore the opt-in", () => {
    const caps = detectCapabilities({ env: { LANG: "C", AMBYKIT_ICONS: "nerd" }, stdout: { isTTY: true } });
    expect(caps.icons).toBeUndefined();
    expect(iconMode(caps)).toBe("ascii");
  });
});
