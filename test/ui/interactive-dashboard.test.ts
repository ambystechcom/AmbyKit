import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  initDashboardTui,
  isDashboardDone,
  reduceDashboard,
  renderDashboardTui,
  type DashboardTuiState,
} from "../../src/cli/ui/interactive/dashboard.js";
import { runFullscreen, type FullscreenApp } from "../../src/cli/ui/interactive/fullscreen.js";
import type { StoryProgress } from "../../src/core/dashboard.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

function story(id: string, done: number, total: number): StoryProgress {
  return {
    id: id.replace("-", ""),
    displayId: id,
    featureRef: "006",
    key: `006:${id}`,
    title: `${id} title`,
    priority: "P1",
    status: "in-progress",
    dependsOn: [],
    blockedBy: [],
    feature: "006-x",
    tasksTotal: total,
    tasksDone: done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

const STORIES = [story("US-1", 7, 10), story("US-2", 10, 10), story("US-3", 0, 10)];
const key = (name: string) => ({ name });

describe("reduceDashboard (US-6, FR-013)", () => {
  it("down/up moves the cursor and wraps", () => {
    let s = initDashboardTui(STORIES);
    s = reduceDashboard(s, key("down"));
    expect(s.cursor).toBe(1);
    s = reduceDashboard(reduceDashboard(s, key("down")), key("down"));
    expect(s.cursor).toBe(0); // wrapped
    expect(reduceDashboard(initDashboardTui(STORIES), key("up")).cursor).toBe(2);
  });

  it("enter opens detail; left/esc returns to list", () => {
    let s = reduceDashboard(initDashboardTui(STORIES), key("return"));
    expect(s.mode).toBe("detail");
    s = reduceDashboard(s, key("escape"));
    expect(s.mode).toBe("list");
  });

  it("q quits from either mode", () => {
    expect(isDashboardDone(reduceDashboard(initDashboardTui(STORIES), key("q")))).toBe(true);
    const detail = reduceDashboard(initDashboardTui(STORIES), key("return"));
    expect(isDashboardDone(reduceDashboard(detail, key("q")))).toBe(true);
  });

  it("empty story list is immediately done", () => {
    expect(isDashboardDone(initDashboardTui([]))).toBe(true);
  });
});

describe("renderDashboardTui", () => {
  const tasksFor = () => [
    { id: "T001", description: "a", done: true, story: "US1" },
    { id: "T002", description: "b", done: false, story: "US1" },
  ];

  it("list view shows the cursor and progress bars", () => {
    const out = stripAnsi(renderDashboardTui(fakeCapabilities(), initDashboardTui(STORIES), tasksFor));
    expect(out).toContain("AmbyKit · dashboard");
    expect(out).toContain("▸"); // cursor on the first row
    expect(out).toContain("q quit");
  });

  it("detail view lists the story's tasks", () => {
    const detail: DashboardTuiState = { stories: STORIES, cursor: 0, mode: "detail" };
    const out = stripAnsi(renderDashboardTui(fakeCapabilities(), detail, tasksFor));
    expect(out).toContain("tasks:");
    expect(out).toContain("[x] T001 a");
    expect(out).toContain("[ ] T002 b");
  });
});

describe("runFullscreen host (FR-013)", () => {
  it("enters the alt screen, restores it on quit, and toggles raw mode", async () => {
    const written: string[] = [];
    const output = { write: (s: string) => (written.push(s), true) };
    const rawCalls: boolean[] = [];
    const input = Object.assign(new EventEmitter(), {
      isTTY: true,
      isRaw: false,
      setRawMode: (m: boolean) => void rawCalls.push(m),
      resume: () => {},
      pause: () => {},
    }) as unknown as NodeJS.ReadStream;

    const app: FullscreenApp<{ n: number; done: boolean }> = {
      initial: { n: 0, done: false },
      render: (s) => `frame ${s.n}`,
      reduce: (s, k) => (k.name === "q" ? { ...s, done: true } : { ...s, n: s.n + 1 }),
      isDone: (s) => s.done,
    };

    const done = runFullscreen(app, { input, output });
    input.emit("keypress", "", { name: "down" }); // advances a frame
    input.emit("keypress", "", { name: "q" }); // quits
    const final = await done;

    expect(final.n).toBe(1);
    const all = written.join("");
    expect(all).toContain("\x1b[?1049h"); // entered alt screen
    expect(all).toContain("\x1b[?1049l"); // restored normal screen
    expect(rawCalls).toEqual([true, false]); // raw mode on then restored
  });
});
