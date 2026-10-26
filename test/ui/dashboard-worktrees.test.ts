import { describe, expect, it } from "vitest";
import type { Presence } from "../../src/core/activity.js";
import type { Checkout, FeatureRow } from "../../src/core/overview-types.js";
import { featureChart, plainFeatureChart } from "../../src/cli/ui/dashboard/feature-chart.js";
import { visibleWidth } from "../../src/cli/ui/dashboard/panel.js";
import { plainWorktrees, worktreeItems, worktreesPanel, type PresenceView } from "../../src/cli/ui/dashboard/worktrees-panel.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

/** Renderer tests for the checkout tag and WORKTREES & AGENTS panel (feature 017, US-1/US-3, FR-033). */

const wt = (id: string, extra: Partial<Checkout> = {}): Checkout => ({ root: `/r/.worktrees/${id}`, kind: "worktree", branch: id, dirty: false, stale: false, ...extra });

const row = (name: string, percent: number, checkout?: Checkout): FeatureRow => ({
  ref: name.slice(0, 3),
  name,
  tasks: { done: percent / 10, total: 10 },
  percent,
  phase: "implementing",
  clarifications: 0,
  ...(checkout ? { checkout } : {}),
});

const rows = [row("001-alpha", 100), row("002-beta", 40, wt("002-beta", { dirty: true })), row("003-gamma", 0, wt("003-gamma", { stale: true }))];

const presence = (agent: string, state: Presence["state"], since: number, extra: Partial<Presence> = {}): Presence => ({
  agent,
  source: "reported",
  state,
  since,
  others: [],
  ...extra,
});

const NOW = 1_800_000_000_000;
const view: PresenceView = {
  byFeature: new Map([
    ["002-beta", presence("codex", "idle", NOW - 18 * 60_000, { phase: "tasks" })],
    ["001-alpha", presence("claude", "active", NOW - 12_000, { phase: "implement", task: "T014" })],
  ]),
  unlocated: [{ agent: "cursor-cli", where: "unknown" }],
  now: NOW,
};

const wide = fakeCapabilities({ color: false, columns: 120 });
const ascii = fakeCapabilities({ color: false, unicode: false, columns: 120 });

describe("feature chart checkout tag (US-1, FR-005, FR-008)", () => {
  it("reserves the tag column only when some row comes from a worktree", () => {
    const tagged = featureChart(wide, rows, "wide").map(stripAnsi);
    expect(tagged[2]).toContain("⎇●");
    expect(tagged[3]).toContain("⎇⊘");
    const untagged = featureChart(wide, [row("001-alpha", 100)], "wide").map(stripAnsi);
    expect(untagged.join("\n")).not.toContain("⎇");
  });

  it("tagged rows keep the same width as untagged ones", () => {
    const lines = featureChart(wide, rows, "wide").slice(1).map(visibleWidth);
    expect(new Set(lines).size).toBe(1);
  });

  it("ASCII spells the tag; plain appends `wt`, `*` and `merged`", () => {
    expect(stripAnsi(featureChart(ascii, rows, "wide")[2]!)).toContain("wt*");
    const plain = plainFeatureChart(ascii, rows);
    expect(plain[1]).not.toContain(" wt");
    expect(plain[2]).toMatch(/  wt\*$/);
    expect(plain[3]).toMatch(/  wt merged$/);
  });

  it("an agent column appears before phase when any feature has an agent", () => {
    const lines = featureChart(wide, rows, "wide", undefined, { agents: view.byFeature }).map(stripAnsi);
    expect(lines[1]).toMatch(/100%\s+\S\s+implementing/);
    expect(lines[3]).toMatch(/0%\s+·\s+implementing/);
  });
});

describe("WORKTREES & AGENTS panel (US-3, FR-029)", () => {
  it("orders rows active → idle → none, then by feature number; unlocated agents last", () => {
    expect(worktreeItems(rows, view).map((i) => i.feature.name)).toEqual(["001-alpha", "002-beta", "003-gamma"]);
    const out = worktreesPanel(wide, rows, view, 120).map(stripAnsi);
    expect(out[0]).toContain("WORKTREES & AGENTS · 4");
    expect(out[1]).toMatch(/001 alpha .*main .*Claude .*implement · T014 .*● active 12s/);
    expect(out[2]).toMatch(/002 beta .*⎇ 002-beta · dirty .*Codex .*tasks .*○ idle 18m/);
    expect(out[3]).toMatch(/003 gamma .*⊘ merged/);
    expect(out[4]).toMatch(/\(unknown location\) +~ \S+ Cursor CLI +running/);
  });

  it("every line is exactly the panel width", () => {
    for (const w of [120, 70]) {
      const out = worktreesPanel(wide, rows, view, w, { narrow: w < 100 });
      expect(new Set(out.map(visibleWidth))).toEqual(new Set([w]));
    }
  });

  it("narrow uses the short tag and glyph-only badges", () => {
    const out = worktreesPanel(wide, rows, view, 70, { narrow: true }).map(stripAnsi).join("\n");
    expect(out).not.toContain("Codex");
    expect(out).toContain("⎇●");
  });

  it("interactive cursor marks the selected openable row", () => {
    const out = worktreesPanel(wide, rows, view, 120, { cursor: 1, focused: true }).map(stripAnsi);
    expect(out[2]).toMatch(/^┃ ▸ 002 beta/);
    expect(out[1]).toMatch(/^┃   001 alpha/);
  });

  it("empty state names the command to start a worktree", () => {
    const out = worktreesPanel(wide, [row("001-alpha", 0)], undefined, 120).map(stripAnsi).join("\n");
    expect(out).toContain("No feature worktrees yet — run ambykit worktree NNN-slug to start one.");
  });

  it("elides rows past the panel maximum", () => {
    const many = Array.from({ length: 12 }, (_, i) => row(`0${String(i + 10)}-f`, 0, wt(`0${String(i + 10)}-f`)));
    const out = worktreesPanel(wide, many, undefined, 120).map(stripAnsi);
    expect(out.length).toBe(8 + 2);
    expect(out.at(-2)).toContain("5 more");
  });

  it("NO_COLOR emits no escapes; ASCII uses tags, never box glyphs from the unicode set", () => {
    const out = worktreesPanel(ascii, rows, view, 120).join("\n");
    expect(hasAnsi(out)).toBe(false);
    expect(out).toContain("[CC] Claude");
    expect(out).not.toMatch(/[⎇●○⊘┃]/);
  });

  it("plain layout: static rows with ~ for detected agents", () => {
    const lines = plainWorktrees(ascii, rows, view);
    expect(lines[0]).toBe("WORKTREES & AGENTS");
    expect(lines[2]).toMatch(/002 beta  wt 002-beta dirty  \[CX\] Codex  tasks  idle 18m/);
    expect(lines.at(-1)).toMatch(/^  \(unknown location\)  ~\[\w+\] Cursor CLI  running$/);
    expect(plainWorktrees(ascii, [row("001-alpha", 0)], undefined)).toEqual([]);
  });
});
