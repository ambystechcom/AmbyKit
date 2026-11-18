import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FullscreenApp } from "../../src/cli/ui/interactive/fullscreen.js";
import { writeMarker } from "../../src/core/activity.js";
import { directivePath, readDirective } from "../../src/core/fleet/directives.js";
import { FEATURE, fleetProject } from "../helpers/fleet-fixture.js";
import { capsFor, fakeTerminal, io, until } from "../helpers/fleet-e2e.js";

/** Pause, continue and stop from the Fleet view, end to end (feature 029, US-4: SC-003, FR-006, FR-007, FR-008). */

vi.mock("../../src/cli/ui/interactive/fullscreen.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/cli/ui/interactive/fullscreen.js")>();
  return { ...real, runFullscreen: <S>(app: FullscreenApp<S>) => real.runFullscreen(app, io.current as never) };
});
vi.mock("../../src/cli/ui/interactive/agent-scan.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/cli/ui/interactive/agent-scan.js")>()),
  listAgentProcesses: async () => [],
}));
vi.mock("../../src/cli/ui/callout.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/cli/ui/callout.js")>()),
  outdatedWarning: async () => "",
}));

const { DashboardCommand } = await import("../../src/cli/dashboard.js");

afterEach(() => void (io.current = null));

async function open() {
  const f = fleetProject([
    { k: 1, assistant: "claude", reportMinutesAgo: 1, state: "working" },
    { k: 2, assistant: "codex", reportMinutesAgo: 1, state: "working" },
  ], { now: Date.now() });
  const term = fakeTerminal();
  const cmd = new DashboardCommand();
  (cmd as unknown as { caps: unknown }).caps = capsFor();
  const run = cmd.run({ cwd: f.root, positionals: [], flags: { interactive: true } });
  expect(await until(() => term.frames.some((fr) => fr.includes("l fleet")), 8000)).toBe(true);
  term.press("l");
  expect(await until(() => /lane-1-1\s+✸ Claude\s+▶ working/.test(term.last()), 3000)).toBe(true);
  const row = (lane: string) => term.last().split("\n").find((l) => l.includes(lane)) ?? "";
  const report = (k: number, state: string) =>
    writeMarker(f.laneRoots[`lane-1-${k}`]!, { feature: FEATURE, agent: k === 1 ? "claude" : "codex", phase: "implement", at: new Date().toISOString(), lane: `${FEATURE}.lane-1-${k}`, state: state as never });
  return { f, term, run, row, report };
}

describe("Fleet view: controls end to end (feature 029, US-4)", () => {
  it("029:FR-006, FR-007, SC-003: pause shows 'pause requested' until the lane reports paused; continue then resumes it", async () => {
    const { f, term, run, row, report } = await open();
    term.press("p");
    expect(await until(() => row("lane-1-1").includes("pause requested"), 3000)).toBe(true);
    expect(readDirective(f.root, f.run, "lane-1-1")?.action).toBe("pause");
    expect(readDirective(f.root, f.run, "lane-1-2")).toBeNull(); // only the selected lane

    await new Promise((r) => setTimeout(r, 1100)); // the worker's report must be dated after the directive
    report(1, "paused");
    expect(await until(() => /lane-1-1.*paused\s+\d+m\s+paused/.test(row("lane-1-1")) || / paused /.test(row("lane-1-1")) && row("lane-1-1").trimEnd().endsWith("paused"), 8000)).toBe(true);

    term.press("u");
    expect(await until(() => row("lane-1-1").includes("continue pending"), 3000)).toBe(true);
    expect(readDirective(f.root, f.run, "lane-1-1")?.action).toBe("continue");

    await new Promise((r) => setTimeout(r, 1100));
    report(1, "working");
    expect(await until(() => row("lane-1-1").includes("obeyed"), 8000)).toBe(true);
    term.press("q");
    expect(await run).toBe(0);
  }, 60_000);

  it("029:FR-007: opposite directives in a row show the last write", async () => {
    const { f, term, run, row } = await open();
    term.press("p");
    expect(await until(() => row("lane-1-1").includes("pause requested"), 3000)).toBe(true);
    term.press("u");
    expect(await until(() => row("lane-1-1").includes("continue pending"), 3000)).toBe(true);
    expect(row("lane-1-1")).not.toContain("pause requested");
    expect(readDirective(f.root, f.run, "lane-1-1")?.action).toBe("continue");
    term.press("q");
    await run;
  }, 40_000);

  it("029:FR-008: stop asks first; n cancels and writes nothing; y writes a stop for that lane only", async () => {
    const { f, term, run, row } = await open();
    term.press("x");
    expect(await until(() => term.last().includes("STOP LANE"), 3000)).toBe(true);
    expect(term.last()).toContain("Stop lane-1-1");
    term.press("n");
    expect(await until(() => !term.last().includes("STOP LANE"), 3000)).toBe(true);
    expect(existsSync(directivePath(f.root, f.run, "lane-1-1"))).toBe(false);

    term.press("x");
    expect(await until(() => term.last().includes("STOP LANE"), 3000)).toBe(true);
    term.press("y");
    expect(await until(() => row("lane-1-1").includes("stop pending"), 3000)).toBe(true);
    expect(readDirective(f.root, f.run, "lane-1-1")?.action).toBe("stop");
    expect(existsSync(directivePath(f.root, f.run, "lane-1-2"))).toBe(false);
    term.press("q");
    await run;
  }, 40_000);

  it("029:FR-006, FR-008: shift-P pauses the whole run after a confirmation; every lane gets a pause", async () => {
    const { f, term, run, row } = await open();
    term.pressShift("P");
    expect(await until(() => term.last().includes("PAUSE ALL LANES"), 3000)).toBe(true);
    expect(term.last()).toMatch(/all 2 lanes of/);
    term.press("y");
    expect(await until(() => row("lane-1-1").includes("pause requested") && row("lane-1-2").includes("pause requested"), 3000)).toBe(true);
    expect(readDirective(f.root, f.run, "lane-1-1")?.action).toBe("pause");
    expect(readDirective(f.root, f.run, "lane-1-2")?.action).toBe("pause");
    term.press("q");
    await run;
  }, 40_000);

  it("029:FR-008: shift-U (continue all) also confirms first, and cancelling writes nothing", async () => {
    const { f, term, run } = await open();
    term.pressShift("U");
    expect(await until(() => term.last().includes("CONTINUE ALL LANES"), 3000)).toBe(true);
    term.press("escape");
    expect(await until(() => !term.last().includes("CONTINUE ALL LANES"), 3000)).toBe(true);
    expect(existsSync(directivePath(f.root, f.run, "lane-1-1"))).toBe(false);
    term.press("q");
    await run;
  }, 40_000);

  it("029:FR-006: c is not a Fleet key: it writes nothing (c stays the overview's quality view)", async () => {
    const { f, term, run } = await open();
    term.press("c");
    await new Promise((r) => setTimeout(r, 300));
    expect(existsSync(directivePath(f.root, f.run, "lane-1-1"))).toBe(false);
    expect(term.last()).toContain("FLEET");
    term.press("q");
    await run;
  }, 40_000);
});
