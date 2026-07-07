import { describe, expect, it } from "vitest";
import {
  initPromptState,
  reducePrompt,
  renderPromptLines,
  selectedValues,
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
