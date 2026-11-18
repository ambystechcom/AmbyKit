import { afterEach, describe, expect, it, vi } from "vitest";
import type { FullscreenApp } from "../../src/cli/ui/interactive/fullscreen.js";
import { writeMarker } from "../../src/core/activity.js";
import { FEATURE, fleetProject } from "../helpers/fleet-fixture.js";
import { capsFor, fakeTerminal, io, until } from "../helpers/fleet-e2e.js";

/** A quiet lane is highlighted within one refresh of crossing the stall limit, then cleared by its next report (029 SC-002). */

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

describe("Fleet view: stalled lane end to end (feature 029, US-3)", () => {
  it("029:FR-005, SC-002: highlights within a refresh of the limit, then clears on the next report", async () => {
    // fleet.stallMinutes is a fraction of a minute so the test crosses the limit in about 3 seconds.
    const f = fleetProject(
      [{ k: 1, assistant: "claude", reportMinutesAgo: 0, state: "working" }, { k: 2, assistant: "codex", reportMinutesAgo: 0, state: "waiting" }],
      { now: Date.now(), config: { fleet: { stallMinutes: 0.05 } } },
    );
    const term = fakeTerminal();
    const cmd = new DashboardCommand();
    (cmd as unknown as { caps: unknown }).caps = capsFor();
    const run = cmd.run({ cwd: f.root, positionals: [], flags: { interactive: true } });
    expect(await until(() => term.frames.some((fr) => fr.includes("l fleet")), 8000), term.last()).toBe(true);
    term.press("l");
    expect(await until(() => /lane-1-1\s+✸ Claude\s+▶ working/.test(term.last()), 3000), term.last()).toBe(true);
    expect(term.last()).not.toContain("STALLED");

    // The limit is crossed with no file change at all: the heartbeat re-read shows it (one refresh, 5 s).
    expect(await until(() => /lane-1-1.*STALLED \d+m/.test(term.last()), 12_000), term.last()).toBe(true);
    const row = (s: string, lane: string) => s.split("\n").find((l) => l.includes(lane)) ?? "";
    expect(row(term.last(), "lane-1-2")).not.toContain("STALLED"); // a waiting lane never stalls

    // The limit here (3 s) is shorter than the heartbeat (5 s), so a report dated "now" would already be quiet again at the
    // next read. A report dated a minute ahead is clamped to now (clock skew), so the lane stays fresh for the whole check.
    writeMarker(f.laneRoots["lane-1-1"]!, { feature: FEATURE, agent: "claude", phase: "implement", at: new Date(Date.now() + 60_000).toISOString(), lane: `${FEATURE}.lane-1-1`, state: "working" });
    expect(await until(() => !row(term.last(), "lane-1-1").includes("STALLED"), 6000), term.last()).toBe(true);

    term.press("q");
    expect(await run).toBe(0);
  }, 60_000);
});
