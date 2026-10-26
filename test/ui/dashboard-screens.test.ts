import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { StoryProgress, TaskLine } from "../../src/core/dashboard.js";
import { readFeatures } from "../../src/core/features.js";
import type { FeatureSnapshot } from "../../src/core/overview-types.js";
import { renderHelp } from "../../src/cli/ui/dashboard/help-overlay.js";
import { visibleWidth } from "../../src/cli/ui/dashboard/panel.js";
import { blocksOf, maxScroll, renderStoryDetail, type StoryDetailView } from "../../src/cli/ui/dashboard/story-detail.js";
import {
  initOverviewTui,
  reduceOverviewTui,
  renderOverviewTui,
  type OverviewTuiData,
  type OverviewTuiState,
} from "../../src/cli/ui/interactive/overview.js";
import type { Capabilities } from "../../src/cli/ui/types.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { fakeCapabilities, hasAnsi, stripAnsi } from "./helpers.js";

/** Every US-4 screen in wide / narrow / plain, NO_COLOR and ASCII (feature 017, FR-028–FR-033, SC-005). */

const WIDE = fakeCapabilities({ color: false, columns: 120 });
const NARROW = fakeCapabilities({ color: false, columns: 80 });
const PLAIN = fakeCapabilities({ color: false, columns: 120, isTTY: false });
const ASCII = fakeCapabilities({ color: false, unicode: false, columns: 120 });
const COLOR = fakeCapabilities({ columns: 120 });
const MODES: [string, Capabilities][] = [
  ["wide", WIDE],
  ["narrow", NARROW],
  ["plain", PLAIN],
  ["ascii", ASCII],
];

const { features, issues } = readFeatures(dashboardFixture());
const data = (over: Partial<OverviewTuiData> = {}): OverviewTuiData => ({
  features,
  issues,
  meta: { crumb: [], cwd: "~/proj", version: "1.3.0" },
  upNextCap: 5,
  burndownFor: () => ({ status: "no-history", reason: "not-a-repo", points: [] }),
  ...over,
});
const press = (d: OverviewTuiData, s: OverviewTuiState, ...keys: (string | { name?: string; sequence?: string })[]) =>
  keys.reduce((st, k) => reduceOverviewTui(d, st, typeof k === "string" ? { name: k } : k), s);

const story = (id: number, extra: Partial<StoryProgress> = {}): StoryProgress => ({
  id: `US${id}`,
  displayId: `US-${id}`,
  featureRef: "017",
  key: `017:US${id}`,
  title: `Story ${id}`,
  priority: "P1",
  status: "in-progress",
  dependsOn: [],
  blockedBy: [],
  feature: "017-live",
  tasksTotal: 0,
  tasksDone: 0,
  percent: 0,
  ...extra,
});
const tasks = (n: number, done: number): TaskLine[] =>
  Array.from({ length: n }, (_, i) => ({ id: `T${String(i + 1).padStart(3, "0")}`, done: i < done, story: "US1", description: `task ${i + 1}` }));

const us1 = story(1, { tasksTotal: 20, tasksDone: 4 });
const feature: FeatureSnapshot = {
  dir: "017-live",
  ref: "017",
  displayRef: "017",
  stories: [us1, story(2, { dependsOn: ["US1"] }), story(3, { dependsOn: ["US-1"] })],
  tasks: tasks(20, 4),
  artifacts: { spec: true, ui: true, uiSignedOff: true, plan: true, tasks: true },
  clarifications: [],
  checkout: { root: "/r/.worktrees/017-live", kind: "worktree", branch: "017-live", dirty: true, stale: false },
};
const detail = (over: Partial<StoryDetailView> = {}): StoryDetailView => ({
  feature,
  story: us1,
  tasks: tasks(20, 4),
  meta: { crumb: [], cwd: "~/p", version: "1.3.0" },
  scroll: 0,
  maxTasks: 12,
  now: 0,
  presence: { agent: "claude", source: "reported", phase: "implement", task: "T005", state: "active", since: 0, others: [] },
  ...over,
});

describe("StoryDetail (FR-028)", () => {
  it.each(MODES)("%s: TASKS, RELATIONS and CHECKOUT & AGENT", (_name, caps) => {
    const out = renderStoryDetail(caps, detail());
    expect(out).toMatch(/TASKS (·|-) 4 of 20 done/);
    expect(out).toContain("RELATIONS");
    expect(out).toContain("CHECKOUT & AGENT");
    expect(out).toMatch(/blocks +US-2, US-3/);
    expect(out).toMatch(/017-live/);
    expect(hasAnsi(out)).toBe(false);
  });

  it("frames are exactly the terminal width (wide and narrow)", () => {
    for (const caps of [WIDE, NARROW]) {
      const lines = renderStoryDetail(caps, detail()).split("\n").slice(3);
      for (const l of lines.filter((x) => x.trim())) expect(visibleWidth(l), l).toBeLessThanOrEqual(caps.columns);
    }
    const top = renderStoryDetail(WIDE, detail()).split("\n").find((l) => l.startsWith("╭─ TASKS"))!;
    expect(top).toMatch(/^╭─ TASKS.*╮ ╭─ RELATIONS.*╮$/);
    expect(visibleWidth(top)).toBe(120);
  });

  it("scrolls with elision markers that keep the panel height", () => {
    const top = stripAnsi(renderStoryDetail(WIDE, detail()));
    expect(top).toContain("T011  task 11");
    expect(top).not.toContain("T012  task 12");
    expect(top).toContain("⋮  9 more");
    const mid = stripAnsi(renderStoryDetail(WIDE, detail({ scroll: 5 })));
    expect(mid).toContain("⋮  5 above");
    expect(mid).toContain("T006  task 6");
    const end = stripAnsi(renderStoryDetail(WIDE, detail({ scroll: maxScroll(20, 12) })));
    expect(end).toContain("T020  task 20");
    expect(end).not.toContain("more");
  });

  it("empty state and reverse relations", () => {
    expect(stripAnsi(renderStoryDetail(WIDE, detail({ tasks: [] })))).toContain("No tasks tagged [US1] yet.");
    expect(blocksOf(feature, feature.stories[1]!)).toEqual([]);
  });

  it("the reducer scrolls within bounds and esc returns to the list", () => {
    const d = data();
    const opened = press(d, initOverviewTui(), "return", "return");
    expect(opened.story?.mode).toBe("detail");
    expect(press(d, opened, "up").story?.scroll).toBe(0);
    expect(press(d, opened, "escape").story?.mode).toBe("list");
  });
});

describe("HelpOverlay (FR-030)", () => {
  it("? opens it on every screen; any key closes it and is swallowed", () => {
    const d = data();
    for (const start of [initOverviewTui(), press(d, initOverviewTui(), "return"), press(d, initOverviewTui(), "return", "return")]) {
      const open = press(d, start, { sequence: "?" });
      expect(open.help).toBe(true);
      const closed = press(d, open, "q");
      expect(closed.help).toBe(false);
      expect(closed.done).toBe(false); // the closing key did not quit
      expect(closed.view).toBe(start.view);
    }
  });

  it("lists the screen's keys and the glyph legend, centered over a dimmed frame", () => {
    const d = data();
    const s = { ...initOverviewTui(), help: true };
    const out = stripAnsi(renderOverviewTui(WIDE, d, s));
    expect(out).toContain("┏━ KEYS · overview");
    expect(out).toContain("retry live updates (when paused)");
    expect(out).toContain("⎇ worktree  ● dirty  ⊘ merged  ~ detected agent");
    expect(out).toContain("✸ Claude ◎ Codex ◇ OpenCode ➤ Cursor ◉ Copilot");
    expect(out).toContain("any key to close");
    const box = out.split("\n").find((l) => l.includes("KEYS"))!;
    expect(box.indexOf("┏")).toBeGreaterThan(20); // centered
    const story = stripAnsi(renderOverviewTui(WIDE, d, { ...press(d, initOverviewTui(), "return", "return"), help: true }));
    expect(story).toContain("KEYS · story");
    expect(story).toContain("scroll tasks");
  });

  it("dims the frame with the backdrop color and uses ASCII frames on ASCII terminals", () => {
    const colored = renderHelp(COLOR, "line one\nline two\nline three", "feature");
    expect(hasAnsi(colored)).toBe(true);
    const ascii = renderHelp(ASCII, "x", "feature");
    expect(ascii).toContain("#= KEYS - feature");
    expect(ascii).not.toMatch(/[┏━┃]/);
  });

  it("collapses more than 3 skipped files into one notice; the list is in help", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ file: `specs/x${i}/tasks.md`, reason: "bad" }));
    const d = data({ issues: many });
    const out = stripAnsi(renderOverviewTui(WIDE, d, initOverviewTui()));
    expect(out).toContain("⚠ 5 files skipped — ? for details");
    expect(out).not.toContain("specs/x0");
    expect(stripAnsi(renderOverviewTui(WIDE, d, { ...initOverviewTui(), help: true }))).toContain("specs/x0/tasks.md: bad");
  });
});

describe("FilterInput and empty states (FR-031)", () => {
  it("the filter input lives in the hint row with a caret", () => {
    const d = data();
    const typing = press(d, initOverviewTui(), "f", { sequence: "0" }, { sequence: "1" });
    const last = stripAnsi(renderOverviewTui(WIDE, d, typing)).split("\n").at(-1)!;
    expect(last).toMatch(/^ filter  \( 01▏ +\)   ⏎ apply  esc cancel$/);
    expect(stripAnsi(renderOverviewTui(ASCII, d, typing)).split("\n").at(-1)).toMatch(/\( 01_ +\)   enter apply/);
  });

  it("no features: a centered title and the /amby.specify hint", () => {
    const out = stripAnsi(renderOverviewTui(WIDE, data({ features: [] }), initOverviewTui()));
    expect(out).toMatch(/^ {30,}No feature specs yet\.$/m);
    expect(out).toMatch(/Run \/amby\.specify to create one\./);
  });

  it("a filter that matches nothing says so; esc clears it", () => {
    const d = data();
    const s = initOverviewTui({ feature: "999" });
    expect(stripAnsi(renderOverviewTui(WIDE, d, s))).toContain('Nothing matches filter "999" — esc to clear.');
    expect(press(d, s, "escape").filters).toEqual({});
  });

  it("every footer offers ? help", () => {
    const d = data();
    for (const s of [initOverviewTui(), press(d, initOverviewTui(), "return"), press(d, initOverviewTui(), "return", "return")]) {
      expect(stripAnsi(renderOverviewTui(WIDE, d, s)).split("\n").at(-1)).toContain("? help");
    }
  });
});

describe("the 006 story views are gone (SC-005)", () => {
  it("no interactive/dashboard.ts module remains", () => {
    expect(existsSync(new URL("../../src/cli/ui/interactive/dashboard.ts", import.meta.url))).toBe(false);
  });
});
