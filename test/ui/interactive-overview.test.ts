import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { readFeatures } from "../../src/core/features.js";
import { runFullscreen } from "../../src/cli/ui/interactive/fullscreen.js";
import {
  initOverviewTui,
  isOverviewDone,
  reduceOverviewTui,
  renderOverviewTui,
  type OverviewTuiData,
  type OverviewTuiState,
} from "../../src/cli/ui/interactive/overview.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { fakeCapabilities, stripAnsi } from "./helpers.js";

const { features, issues } = readFeatures(dashboardFixture());
const data: OverviewTuiData = {
  features,
  issues,
  meta: { crumb: [], cwd: "~/proj", version: "1.2.0" },
  upNextCap: 5,
  burndownFor: () => ({ status: "no-history", reason: "not-a-repo", points: [] }),
};
const caps = fakeCapabilities({ color: false, columns: 100 });
const press = (s: OverviewTuiState, ...keys: (string | { name?: string; sequence?: string; shift?: boolean })[]) =>
  keys.reduce((st, k) => reduceOverviewTui(data, st, typeof k === "string" ? { name: k } : k), s);
const render = (s: OverviewTuiState) => stripAnsi(renderOverviewTui(caps, data, s, () => []));

describe("interactive overview reducer (US-5, ui.md Interactive mode)", () => {
  it("tab / shift-tab cycle focus across Attention → Up next → Feature completion", () => {
    const s = initOverviewTui();
    expect(press(s, "tab").focus).toBe(1);
    expect(press(s, "tab", "tab", "tab").focus).toBe(0);
    expect(press(s, { name: "tab", shift: true }).focus).toBe(2);
  });

  it("up/down move within the focused panel and wrap", () => {
    const s = initOverviewTui();
    expect(press(s, "down").cursors).toEqual([1, 0, 0]);
    expect(press(s, "down", "down").cursors).toEqual([0, 0, 0]); // 2 attention items
    expect(press(s, "tab", "tab", "up").cursors).toEqual([0, 0, 2]); // 3 features
  });

  it("enter on an attention item opens its feature with the story selected; esc goes back", () => {
    const opened = press(initOverviewTui(), "return");
    expect(opened.view).toBe("feature");
    expect(opened.feature).toBe("002-widgets");
    expect(opened.story?.cursor).toBe(2); // US-3
    const back = press(opened, "escape");
    expect(back.view).toBe("overview");
  });

  it("feature view delegates story navigation and detail to the 006 module", () => {
    const opened = press(initOverviewTui(), "tab", "tab", "down", "return"); // 002-widgets row
    expect(opened.feature).toBe("002-widgets");
    const detail = press(opened, "down", "return");
    expect(detail.story?.mode).toBe("detail");
    expect(press(detail, "escape").story?.mode).toBe("list");
    expect(press(detail, "escape", "escape").view).toBe("overview");
  });

  it("f types a feature filter; enter applies, esc cancels", () => {
    const typing = press(initOverviewTui(), "f", { sequence: "0" }, { sequence: "0" }, { sequence: "3" });
    expect(typing.input).toBe("003");
    expect(press(typing, "return").filters.feature).toBe("003");
    expect(press(typing, "backspace").input).toBe("00");
    expect(press(typing, "escape").filters.feature).toBeUndefined();
  });

  it("s cycles the status filter; q quits from any view", () => {
    expect(press(initOverviewTui(), "s").filters.status).toBe("draft");
    expect(press(initOverviewTui(), "s", "s").filters.status).toBe("ready");
    expect(isOverviewDone(press(initOverviewTui(), "q"))).toBe(true);
    expect(isOverviewDone(press(initOverviewTui(), "return", "q"))).toBe(true);
  });
});

describe("interactive overview rendering", () => {
  it("the focused panel has the heavy frame and a cursor; key hints at the bottom", () => {
    const out = render(initOverviewTui());
    expect(out).toContain("┏━ ATTENTION · 2");
    expect(out).toContain("▸ ✗ 002:US-3");
    expect(out).toContain("╭─ UP NEXT");
    expect(out.trimEnd().split("\n").at(-1)).toBe("tab panel  ↑↓ move  ⏎ open  f filter  s status  q quit");
    expect(out.split("\n")[0]).toMatch(/v1\.2\.0 · interactive$/);
  });

  it("burndown shows computing until history is ready", () => {
    expect(render(initOverviewTui())).toContain("computing history…");
    expect(render({ ...initOverviewTui(), burndownReady: true })).toContain("No history available: not a git repository.");
  });

  it("filters are applied to every widget and shown in the hints", () => {
    const out = render(press(initOverviewTui(), "f", { sequence: "3" }, "return"));
    expect(out).toContain("FEATURES");
    expect(out).toContain("[feature=3]");
    const filtered = render({ ...initOverviewTui({ feature: "003" }) });
    expect(filtered).toContain("ATTENTION · 0");
  });

  it("the feature view renders panels; detail mode renders the existing detail view", () => {
    const opened = press(initOverviewTui(), "return");
    expect(render(opened)).toContain("╭─ ARTIFACTS");
    expect(render(opened)).toContain("esc back");
    expect(render(press(opened, "return"))).toContain("AmbyKit · 002 US-3");
  });
});

describe("runFullscreen start hook (feature 014)", () => {
  it("redraws after an update arriving post-start", async () => {
    const written: string[] = [];
    const input = Object.assign(new EventEmitter(), {
      isTTY: true,
      isRaw: false,
      setRawMode: () => {},
      resume: () => {},
      pause: () => {},
    }) as unknown as NodeJS.ReadStream;
    let push: ((fn: (s: { n: number; done: boolean }) => { n: number; done: boolean }) => void) | undefined;
    const done = runFullscreen(
      {
        initial: { n: 0, done: false },
        render: (s) => `frame ${s.n}`,
        reduce: (s, k) => (k.name === "q" ? { ...s, done: true } : s),
        isDone: (s) => s.done,
        start: (update) => (push = update),
      },
      { input, output: { write: (s: string) => (written.push(s), true) } },
    );
    push!((s) => ({ ...s, n: 42 }));
    input.emit("keypress", "", { name: "q" });
    const final = await done;
    expect(final.n).toBe(42);
    expect(written.join("")).toContain("frame 42");
  });
});
