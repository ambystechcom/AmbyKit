import { describe, expect, it } from "vitest";
import {
  elide,
  fitVisible,
  panel,
  sideBySide,
  truncateVisible,
  visibleWidth,
} from "../../src/cli/ui/dashboard/panel.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const plain = fakeCapabilities({ color: false });
const ascii = fakeCapabilities({ color: false, unicode: false });

describe("dashboard panel (feature 014)", () => {
  it("draws a rounded frame with the title in the top edge", () => {
    expect(panel(plain, { title: "FEATURES", width: 20 }, ["16", "13 done"])).toEqual([
      "╭─ FEATURES ───────╮",
      "│ 16               │",
      "│ 13 done          │",
      "╰──────────────────╯",
    ]);
  });

  it("focused panels use the heavy frame; right text sits before the corner", () => {
    const [top, , bottom] = panel(plain, { title: "ATTENTION · 3", right: "x", width: 24, focused: true }, ["a"]);
    expect(top).toBe("┏━ ATTENTION · 3 ━━ x ━┓");
    expect(bottom).toBe("┗" + "━".repeat(22) + "┛");
  });

  it("ASCII terminals get + - | frames", () => {
    expect(panel(ascii, { title: "T", width: 8 }, ["ab"])).toEqual(["+- T --+", "| ab   |", "+------+"]);
  });

  it("every line is exactly the panel width, even with colored or long content", () => {
    const color = fakeCapabilities();
    const lines = panel(color, { title: "UP NEXT", width: 30 }, ["\x1b[35m" + "x".repeat(50) + "\x1b[0m"]);
    for (const l of lines) expect(visibleWidth(l)).toBe(30);
    expect(stripAnsi(lines[1]!)).toContain("…");
  });

  it("truncates and pads by visible width, keeping ANSI balanced", () => {
    const s = "\x1b[1mhello world\x1b[0m";
    expect(stripAnsi(truncateVisible(plain, s, 6))).toBe("hello…");
    expect(truncateVisible(plain, s, 6).endsWith("\x1b[0m…")).toBe(true);
    expect(stripAnsi(truncateVisible(ascii, "hello world", 6))).toBe("hello~");
    expect(fitVisible(plain, "ab", 4)).toBe("ab  ");
  });

  it("elide replaces overflow with +N more", () => {
    expect(elide(["a", "b", "c", "d"], 3)).toEqual(["a", "b", "+2 more"]);
    expect(elide(["a", "b"], 3)).toEqual(["a", "b"]);
  });

  it("sideBySide pads shorter blocks", () => {
    expect(sideBySide([["ab", "c"], ["x"]], [3, 1], 1)).toEqual(["ab  x", "c"]);
  });
});
