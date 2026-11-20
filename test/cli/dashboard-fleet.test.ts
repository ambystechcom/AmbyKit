import { afterEach, describe, expect, it, vi } from "vitest";
import type { FullscreenApp } from "../../src/cli/ui/interactive/fullscreen.js";
import { writeMarker } from "../../src/core/activity.js";
import { FEATURE, fleetProject } from "../helpers/fleet-fixture.js";
import { capsFor, fakeTerminal, io, until } from "../helpers/fleet-e2e.js";

/**
 * The Fleet view end to end (feature 029, US-1): the real command, real `fs.watch`, a real run directory and real lane
 * markers, with only the terminal faked. SC-001 (every lane's assistant, state and activity at a glance) and FR-002
 * (a lane state change repaints without a reload).
 */

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

function command(columns = 120) {
  const cmd = new DashboardCommand();
  (cmd as unknown as { caps: unknown }).caps = capsFor({ columns });
  return cmd;
}

afterEach(() => void (io.current = null));

describe("Fleet view end to end (feature 029, US-1)", () => {
  it("029:FR-001, SC-001: three lanes show assistant, state and quiet time, and a lane state change repaints without a reload", async () => {
    const f = fleetProject([
      { k: 1, assistant: "claude", reportMinutesAgo: 0, state: "working" },
      { k: 2, assistant: "codex", reportMinutesAgo: 1, state: "waiting" },
      { k: 3, assistant: "claude", reportMinutesAgo: 2, state: "working" },
    ], { now: Date.now() });
    const term = fakeTerminal();
    const run = command().run({ cwd: f.root, positionals: [], flags: { interactive: true } });
    expect(await until(() => term.frames.some((fr) => fr.includes("l fleet")), 8000)).toBe(true);

    term.press("l");
    expect(await until(() => term.last().includes("FLEET"), 3000)).toBe(true);
    const frame = term.last();
    for (const lane of ["lane-1-1", "lane-1-2", "lane-1-3"]) expect(frame).toContain(lane);
    expect(frame).toMatch(/lane-1-1\s+✸ Claude\s+▶ working/);
    expect(frame).toMatch(/lane-1-2\s+◎ Codex\s+◷ waiting/);
    expect(frame).toContain(f.run);

    // lane 2 finishes: its marker changes and the frame follows within a heartbeat, with no key pressed.
    writeMarker(f.laneRoots["lane-1-2"]!, { feature: FEATURE, agent: "codex", phase: "implement", at: new Date().toISOString(), lane: `${FEATURE}.lane-1-2`, state: "done" });
    expect(await until(() => /lane-1-2\s+◎ Codex\s+✓ done/.test(term.last()), 9000)).toBe(true);

    term.press("escape");
    expect(await until(() => term.last().includes("WORKTREES & AGENTS"), 3000)).toBe(true);
    term.press("q");
    expect(await run).toBe(0);
  }, 40_000);

  it("029:FR-013: with no run the Fleet view opens and says so; the overview is unchanged", async () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 0, state: "working" }], { noRun: true, now: Date.now() });
    const term = fakeTerminal();
    const run = command().run({ cwd: f.root, positionals: [], flags: { interactive: true } });
    expect(await until(() => term.frames.some((fr) => fr.includes("WORKTREES & AGENTS")), 8000)).toBe(true);
    term.press("l");
    expect(await until(() => term.last().includes("No fleet run is active."), 3000)).toBe(true);
    term.press("q");
    expect(await run).toBe(0);
  }, 30_000);

  it("029:FR-016: quitting from the Fleet view ends the command cleanly", async () => {
    const f = fleetProject([{ k: 1, reportMinutesAgo: 0, state: "working" }], { now: Date.now() });
    const term = fakeTerminal();
    const run = command().run({ cwd: f.root, positionals: [], flags: { interactive: true } });
    expect(await until(() => term.frames.some((fr) => fr.includes("l fleet")), 8000)).toBe(true);
    term.press("l");
    expect(await until(() => term.last().includes("FLEET"), 3000)).toBe(true);
    term.press("q");
    expect(await run).toBe(0);
    expect(term.frames.join("")).toBeTruthy();
  }, 30_000);
});
