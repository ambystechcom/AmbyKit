import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { fleetViewApi } from "../../src/cli/ui/dashboard/fleet-view.js";
import { runFullscreen, type FullscreenApp } from "../../src/cli/ui/interactive/fullscreen.js";
import { initOverviewTui, isOverviewDone, reduceOverviewTui, renderOverviewTui, type OverviewTuiData, type OverviewTuiState } from "../../src/cli/ui/interactive/overview.js";
import { readFeatures } from "../../src/core/features.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";
import { fleetView } from "../helpers/fleet-fixture.js";
import { fakeCapabilities } from "./helpers.js";

/**
 * Terminal restore with the Fleet view open (feature 029, FR-016): the alternate screen is left, the cursor shown, raw
 * mode restored, listeners removed and `stop()` called once on every way out — quit, Ctrl-C, SIGTERM, SIGHUP, a closed
 * input, an app that throws — and a resize repaints at the new width.
 */

const ESC = "\x1b";
const ENTER = `${ESC}[?1049h`;
const EXIT = `${ESC}[?25h${ESC}[?1049l`;
const { features, issues } = readFeatures(dashboardFixture());
const data: OverviewTuiData = {
  features,
  issues,
  meta: { crumb: [], cwd: "~/proj", version: "1.5.0" },
  upNextCap: 5,
  burndownFor: () => ({ status: "no-history", reason: "not-a-repo", points: [] }),
  fleetView: fleetViewApi,
  fleet: fleetView([{ lane: "lane-1-1" }, { lane: "lane-1-2" }]),
  rows: 24,
};

function terminal() {
  const written: string[] = [];
  const raw: boolean[] = [];
  const output = Object.assign(new EventEmitter(), { columns: 100, write: (s: string) => (written.push(s), true) });
  const input = Object.assign(new EventEmitter(), {
    isTTY: true,
    isRaw: false,
    setRawMode: (m: boolean) => void raw.push(m),
    resume: () => {},
    pause: () => {},
  }) as unknown as NodeJS.ReadStream;
  return { written, raw, output, input, all: () => written.join("") };
}

function fleetApp(extra: Partial<FullscreenApp<OverviewTuiState>> = {}): FullscreenApp<OverviewTuiState> & { stops: number } {
  const app = {
    stops: 0,
    initial: reduceOverviewTui(data, initOverviewTui(), { name: "l", sequence: "l" }),
    render: (s: OverviewTuiState) => renderOverviewTui(fakeCapabilities({ color: false, columns: 100 }), data, s),
    reduce: (s: OverviewTuiState, k: Parameters<typeof reduceOverviewTui>[2]) => reduceOverviewTui(data, s, k),
    isDone: isOverviewDone,
    stop() {
      app.stops++;
    },
    ...extra,
  };
  return app as FullscreenApp<OverviewTuiState> & { stops: number };
}

const signalListeners = () => (["SIGINT", "SIGTERM", "SIGHUP"] as const).map((n) => process.listenerCount(n));

/** A listener the host added for `sig` (called directly: emitting a real signal would reach vitest's own handlers). */
function hostListener(sig: "SIGTERM" | "SIGHUP", before: Function[]): () => void {
  const added = process.listeners(sig).filter((l) => !before.includes(l));
  expect(added.length).toBeGreaterThan(0);
  return added[0] as () => void;
}

describe("terminal restore with the Fleet view open (feature 029, FR-016)", () => {
  it("029:FR-016: the Fleet view is on screen when the terminal is taken over, and q restores everything", async () => {
    const t = terminal();
    const before = signalListeners();
    const app = fleetApp();
    const done = runFullscreen(app, { input: t.input, output: t.output });
    expect(t.all()).toContain(ENTER);
    expect(t.all()).toContain("FLEET");
    t.input.emit("keypress", "", { name: "q" });
    await done;
    expect(t.all()).toContain(EXIT);
    expect(t.raw).toEqual([true, false]);
    expect(app.stops).toBe(1);
    expect(signalListeners()).toEqual(before);
    expect(t.output.listenerCount("resize")).toBe(0);
    expect(t.input.listenerCount("keypress")).toBe(0);
  });

  it("029:FR-016: Ctrl-C restores and stops once", async () => {
    const t = terminal();
    const app = fleetApp();
    const done = runFullscreen(app, { input: t.input, output: t.output });
    t.input.emit("keypress", "", { name: "c", ctrl: true });
    await done;
    expect(t.all()).toContain(EXIT);
    expect(app.stops).toBe(1);
  });

  it("029:FR-016: Ctrl-C while a stop confirmation is open restores and writes nothing", async () => {
    const t = terminal();
    const app = fleetApp();
    const done = runFullscreen(app, { input: t.input, output: t.output });
    t.input.emit("keypress", "x", { name: "x", sequence: "x" });
    expect(t.all()).toContain("STOP LANE");
    t.input.emit("keypress", "", { name: "c", ctrl: true });
    const final = await done;
    expect(t.all()).toContain(EXIT);
    expect(final.fleet?.intent ?? null).toBeNull();
  });

  for (const sig of ["SIGTERM", "SIGHUP"] as const) {
    it(`029:FR-016: ${sig} restores the terminal and removes the listeners`, async () => {
      const t = terminal();
      const before = process.listeners(sig);
      const app = fleetApp();
      const done = runFullscreen(app, { input: t.input, output: t.output });
      hostListener(sig, before)();
      await done;
      expect(t.all()).toContain(EXIT);
      expect(t.raw).toEqual([true, false]);
      expect(app.stops).toBe(1);
      expect(process.listeners(sig)).toEqual(before);
    });
  }

  it("029:FR-016: a closed input (the terminal was detached) restores and stops", async () => {
    const t = terminal();
    const app = fleetApp();
    const done = runFullscreen(app, { input: t.input, output: t.output });
    t.input.emit("end");
    await done;
    expect(t.all()).toContain(EXIT);
    expect(app.stops).toBe(1);
    expect(t.input.listenerCount("end")).toBe(0);
  });

  it("029:FR-016: an app that throws while drawing or reducing still restores the terminal, then rejects", async () => {
    for (const where of ["reduce", "render", "resize"] as const) {
      const t = terminal();
      let armed = false;
      const app = fleetApp({
        reduce: (s, k) => {
          if (where === "reduce" && armed) throw new Error("boom");
          return reduceOverviewTui(data, s, k);
        },
        render: (s) => {
          if (where === "render" && armed) throw new Error("boom");
          return renderOverviewTui(fakeCapabilities({ color: false, columns: 100 }), data, s);
        },
        resize: () => {
          if (where === "resize") throw new Error("boom");
        },
      });
      const done = runFullscreen(app, { input: t.input, output: t.output });
      armed = true;
      if (where === "resize") t.output.emit("resize");
      else t.input.emit("keypress", "", { name: "down" });
      await expect(done, where).rejects.toThrow("boom");
      expect(t.all(), where).toContain(EXIT);
      expect(t.raw, where).toEqual([true, false]);
      expect((app as unknown as { stops: number }).stops, where).toBe(1);
    }
  });

  it("029:FR-016: a throw on the very first frame restores the terminal too", async () => {
    const t = terminal();
    const app = fleetApp({
      render: () => {
        throw new Error("first frame");
      },
    });
    await expect(runFullscreen(app, { input: t.input, output: t.output })).rejects.toThrow("first frame");
    expect(t.all()).toContain(EXIT);
    expect(t.raw).toEqual([true, false]);
  });

  it("029:FR-016: a resize repaints the Fleet view at the new width, in place, with no full clear", async () => {
    const t = terminal();
    let cols = 100;
    const app = fleetApp({ resize: (c) => void (cols = c), render: (s) => renderOverviewTui(fakeCapabilities({ color: false, columns: cols }), data, s) });
    const done = runFullscreen(app, { input: t.input, output: t.output });
    t.output.columns = 50;
    t.output.emit("resize");
    const before = t.written.length;
    const compact = t.written.slice(before - 1).join("");
    t.input.emit("keypress", "", { name: "q" });
    await done;
    expect(cols).toBe(50);
    expect(compact).toContain("FLEET · ph");
    expect(t.all()).not.toContain(`${ESC}[2J`);
  });
});
