import { describe, expect, it } from "vitest";
import type { AttentionItem, Overview } from "../../src/core/overview-types.js";
import { attentionPanel, plainAttention } from "../../src/cli/ui/dashboard/attention.js";
import { plainUpNext, upNextPanel } from "../../src/cli/ui/dashboard/up-next.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const caps = fakeCapabilities({ color: false });
const items: AttentionItem[] = [
  { key: "015:US-3", kind: "graph-problem", refs: ["US-9"], reason: "depends-on US-9 — unknown story" },
  { key: "015:US-4", kind: "blocked", refs: ["US-2"], reason: "blocked-by US-2" },
  { key: "014:US-6", kind: "waiting", refs: ["US-3", "US-4"], reason: "waiting on US-3, US-4" },
];

describe("attention panel (US-3)", () => {
  it("shows a kind glyph, the key and the reason", () => {
    expect(attentionPanel(caps, items, 49).map(stripAnsi)).toEqual([
      "╭─ ATTENTION · 3 ───────────────────────────────╮",
      "│ ⚠ 015:US-3  depends-on US-9 — unknown story   │",
      "│ ✗ 015:US-4  blocked-by US-2                   │",
      "│ → 014:US-6  waiting on US-3, US-4             │",
      "╰───────────────────────────────────────────────╯",
    ]);
  });

  it("never disappears: empty reads Nothing blocked.", () => {
    expect(stripAnsi(attentionPanel(caps, [], 30)[1]!)).toContain("Nothing blocked.");
    expect(plainAttention(caps, [])).toEqual(["ATTENTION", "  Nothing blocked."]);
  });

  it("more than max-items ends with +N more", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...items[1]!, key: `001:US-${i + 1}` }));
    const out = attentionPanel(caps, many, 40).map(stripAnsi);
    expect(out).toHaveLength(10);
    expect(out[8]).toContain("+5 more");
  });

  it("plain uses ASCII glyphs", () => {
    expect(plainAttention(fakeCapabilities({ color: false, unicode: false }), items)).toEqual([
      "ATTENTION",
      "  [!] 015:US-3  depends-on US-9 - unknown story",
      "  [x] 015:US-4  blocked-by US-2",
      "  [>] 014:US-6  waiting on US-3, US-4",
    ]);
  });
});

describe("up next panel (US-4)", () => {
  const upNext: Overview["upNext"] = {
    items: [
      { taskId: "T010", storyKey: "014:US-3", description: "Attention widget model", feature: "014-x" },
      { taskId: "T090", storyKey: null, description: "cleanup", feature: "014-x" },
    ],
    eligible: 17,
    allDone: false,
  };

  it("title shows shown of eligible; unassigned tasks say so", () => {
    expect(upNextPanel(caps, upNext, 50).map(stripAnsi)).toEqual([
      "╭─ UP NEXT · 2 of 17 ────────────────────────────╮",
      "│ T010  014:US-3    Attention widget model       │",
      "│ T090  unassigned  cleanup                      │",
      "╰────────────────────────────────────────────────╯",
    ]);
  });

  it("all done suggests /amby.converge", () => {
    const done = { items: [], eligible: 0, allDone: true };
    expect(upNextPanel(caps, done, 50).map(stripAnsi)[0]).toMatch(/^╭─ UP NEXT ─/);
    expect(stripAnsi(upNextPanel(caps, done, 50)[1]!)).toContain("All tasks done — run /amby.converge.");
    expect(plainUpNext(fakeCapabilities({ color: false, unicode: false }), done)).toEqual([
      "UP NEXT",
      "  All tasks done - run /amby.converge.",
    ]);
  });

  it("descriptions truncate at the panel edge; the task id never does", () => {
    const long = { ...upNext, items: [{ ...upNext.items[0]!, description: "x".repeat(100) }] };
    const line = stripAnsi(upNextPanel(caps, long, 40)[1]!);
    expect(line).toContain("T010");
    expect(line).toContain("…");
  });
});
