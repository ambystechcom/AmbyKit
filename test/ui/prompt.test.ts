import { describe, expect, it } from "vitest";
import {
  initPromptState,
  reducePrompt,
  renderPromptLines,
  selectedValues,
  viewportRows,
  type PromptKey,
  type PromptOption,
} from "../../src/cli/ui/interactive/prompt.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const OPTIONS: PromptOption[] = [
  { value: "claude", label: "Claude Code" },
  { value: "copilot", label: "GitHub Copilot" },
  { value: "cursor", label: "Cursor" },
];

/** Drive a key sequence through the reducer. */
function run(keys: PromptKey[], preselected: string[] = []) {
  let state = initPromptState(OPTIONS, preselected);
  for (const k of keys) state = reducePrompt(state, k);
  return state;
}

describe("reducePrompt (US-7, FR-015)", () => {
  it("space toggles the cursor item, enter confirms", () => {
    const s = run(["space", "down", "down", "space", "enter"]);
    expect(s.done).toBe(true);
    expect(s.cancelled).toBe(false);
    expect(selectedValues(s)).toEqual(["claude", "cursor"]);
  });

  it("preselected items start checked", () => {
    const s = run([], ["copilot"]);
    expect(selectedValues(s)).toEqual(["copilot"]);
  });

  it("up/down wraps around", () => {
    expect(run(["up"]).cursor).toBe(OPTIONS.length - 1);
    expect(run(["down", "down", "down"]).cursor).toBe(0);
  });

  it("escape cancels (done + cancelled)", () => {
    const s = run(["space", "escape"]);
    expect(s.done).toBe(true);
    expect(s.cancelled).toBe(true);
  });
});

describe("renderPromptLines", () => {
  it("marks the cursor and checked state with glyphs (ASCII fallback)", () => {
    const caps = fakeCapabilities({ color: false, unicode: false });
    const state = reducePrompt(initPromptState(OPTIONS), "space"); // check first item
    const lines = renderPromptLines(caps, "Select tools", state).map(stripAnsi);
    expect(lines[0]).toContain("? Select tools");
    expect(lines[1]).toContain("> (*) Claude Code"); // cursor + checked, ASCII
    expect(lines[2]).toContain("( ) GitHub Copilot"); // unchecked
  });
});

// Feature 016, FR-013: the selector stays usable at eighteen targets.
describe("selector viewport (feature 016)", () => {
  const MANY: PromptOption[] = Array.from({ length: 18 }, (_, i) => ({ value: `t${i}`, label: `Target ${i}` }));
  const unicode = fakeCapabilities({ color: false, unicode: true });
  const ascii = fakeCapabilities({ color: false, unicode: false });
  const render = (caps: ReturnType<typeof fakeCapabilities>, state: ReturnType<typeof initPromptState>) =>
    renderPromptLines(caps, "Select tools", state).map(stripAnsi);
  const downs = (n: number, rows = 12) => {
    let s = initPromptState(MANY, [], rows);
    for (let i = 0; i < n; i++) s = reducePrompt(s, "down");
    return s;
  };

  it("viewportRows leaves room for the message, hints and a margin", () => {
    expect(viewportRows(18, 18)).toBe(12);
    expect(viewportRows(18, 24)).toBe(18);
    expect(viewportRows(10, 40)).toBe(10);
    expect(viewportRows(18, 5)).toBe(3);
    expect(viewportRows(18, undefined)).toBe(18); // 24-row default
  });

  it("shows 12 of 18 options with only a down hint at the top of the list", () => {
    const lines = render(unicode, initPromptState(MANY, [], 12));
    expect(lines).toHaveLength(15);
    expect(lines[1]).toBe("");
    expect(lines[2]).toContain("Target 0");
    expect(lines[13]).toContain("Target 11");
    expect(lines[14]).toContain("↓ 6 more");
  });

  it("keeps every option reachable and the cursor visible while scrolling down", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 18; n++) {
      const lines = render(unicode, downs(n));
      expect(lines).toHaveLength(15);
      expect(lines.some((l) => l.includes(`Target ${n}`) && /^\s+[>›▸]/.test(l))).toBe(true);
      for (const l of lines) {
        const m = /Target \d+/.exec(l);
        if (m) seen.add(m[0]);
      }
    }
    expect(seen.size).toBe(18);
  });

  it("shows both hints mid-list and only the up hint at the end", () => {
    const mid = render(unicode, downs(13)); // window 2..13
    expect(mid[1]).toContain("↑ 2 more");
    expect(mid[14]).toContain("↓ 4 more");
    const end = render(unicode, downs(17));
    expect(end[1]).toContain("↑ 6 more");
    expect(end[14]).toBe("");
  });

  it("wraps from the first option to the last, scrolling to it", () => {
    const s = reducePrompt(initPromptState(MANY, [], 12), "up");
    expect(s.cursor).toBe(17);
    expect(render(unicode, s).join("\n")).toContain("Target 17");
  });

  it("falls back to ASCII hints", () => {
    expect(render(ascii, initPromptState(MANY, [], 12))[14]).toContain("v 6 more");
    expect(render(ascii, downs(17))[1]).toContain("^ 6 more");
  });

  it("is unchanged when everything fits", () => {
    const small = initPromptState(OPTIONS);
    expect(small.rows).toBe(3);
    expect(render(unicode, small)).toHaveLength(4);
  });

  it("selection still works for options outside the first window", () => {
    const s = reducePrompt(downs(15), "space");
    expect(selectedValues(s)).toEqual(["t15"]);
  });
});
