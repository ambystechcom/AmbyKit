import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FullscreenApp } from "../../src/cli/ui/interactive/fullscreen.js";
import { directivesDir, readRun } from "../../src/core/fleet/index.js";
import { fleetProject } from "../helpers/fleet-fixture.js";
import { capsFor, fakeTerminal, io, until } from "../helpers/fleet-e2e.js";

/** Approving a story checkpoint from the Fleet view releases 028's gate and writes no directive (feature 029, US-5, FR-009). */

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

async function open(gates: { id: string; after: string; state: "pending" | "approved" }[]) {
  const f = fleetProject([{ k: 1, assistant: "claude", reportMinutesAgo: 1, state: "paused" }], { now: Date.now(), status: "waiting-person", needsDecision: true, gates });
  const term = fakeTerminal();
  const cmd = new DashboardCommand();
  (cmd as unknown as { caps: unknown }).caps = capsFor();
  const run = cmd.run({ cwd: f.root, positionals: [], flags: { interactive: true } });
  expect(await until(() => term.frames.some((fr) => fr.includes("l fleet")), 8000)).toBe(true);
  term.press("l");
  expect(await until(() => term.last().includes("lane-1-1"), 3000)).toBe(true);
  return { f, term, run };
}

describe("Fleet view: gates end to end (feature 029, US-5)", () => {
  it("029:FR-009: a lane at a gate is shown awaiting approval; a approves it, the gate reads approved and no directive is written", async () => {
    const { f, term, run } = await open([{ id: "phase-1", after: "US-1", state: "pending" }]);
    expect(term.last()).toContain("phase-1 · after US-1 · awaiting approval");
    expect(term.last()).toContain("NEEDS A DECISION");

    term.press("a");
    expect(await until(() => term.last().includes("phase-1 · after US-1 · approved"), 4000)).toBe(true);
    expect(term.last()).toContain("Approved phase-1.");
    const rec = readRun(f.root, f.run)!;
    expect(rec.gates[0]?.state).toBe("approved");
    expect(rec.status).toBe("active"); // 028: no gate left waiting, so the run continues
    expect(existsSync(directivesDir(f.root, f.run))).toBe(false); // approval is not a continue directive
    term.press("q");
    expect(await run).toBe(0);
  }, 40_000);

  it("029:FR-009: leaving without approving writes nothing: the gate stays pending and the lane stays paused", async () => {
    const { f, term, run } = await open([{ id: "phase-1", after: "US-1", state: "pending" }]);
    term.press("escape");
    expect(await until(() => term.last().includes("WORKTREES & AGENTS"), 3000)).toBe(true);
    expect(readRun(f.root, f.run)!.gates[0]?.state).toBe("pending");
    expect(existsSync(directivesDir(f.root, f.run))).toBe(false);
    term.press("q");
    await run;
  }, 40_000);

  it("029:FR-009: several waiting gates are listed together, and a approves the one under the gate cursor", async () => {
    const { f, term, run } = await open([
      { id: "phase-1", after: "US-1", state: "pending" },
      { id: "phase-2", after: "US-2", state: "pending" },
    ]);
    expect(term.last()).toContain("phase-1 · after US-1");
    expect(term.last()).toContain("phase-2 · after US-2");
    term.press("right");
    term.press("a");
    expect(await until(() => term.last().includes("Approved phase-2."), 4000)).toBe(true);
    const gates = readRun(f.root, f.run)!.gates;
    expect(gates.find((g) => g.id === "phase-1")?.state).toBe("pending");
    expect(gates.find((g) => g.id === "phase-2")?.state).toBe("approved");
    term.press("q");
    await run;
  }, 40_000);

  it("029:FR-009: a with no gate waiting says so and writes nothing", async () => {
    const { f, term, run } = await open([]);
    term.press("a");
    expect(await until(() => term.last().includes("No gate is waiting for approval."), 3000)).toBe(true);
    expect(existsSync(directivesDir(f.root, f.run))).toBe(false);
    term.press("q");
    await run;
  }, 40_000);
});
