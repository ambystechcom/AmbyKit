import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FullscreenApp } from "../../src/cli/ui/interactive/fullscreen.js";
import { fleetProject } from "../helpers/fleet-fixture.js";
import { capsFor, fakeTerminal, io, until } from "../helpers/fleet-e2e.js";

/** `--icons` > `AMBYKIT_ICONS` > `dashboard.icons` > auto, on the Fleet view (feature 029, FR-011). */

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

const saved = process.env["AMBYKIT_ICONS"];
beforeEach(() => void delete process.env["AMBYKIT_ICONS"]);
afterEach(() => {
  io.current = null;
  if (saved === undefined) delete process.env["AMBYKIT_ICONS"];
  else process.env["AMBYKIT_ICONS"] = saved;
});

/** Open the Fleet view and return its first frame. */
async function fleetFrame(opts: { config?: unknown; flag?: string; env?: string; caps?: Record<string, unknown> }): Promise<string> {
  if (opts.env !== undefined) process.env["AMBYKIT_ICONS"] = opts.env;
  const f = fleetProject([{ k: 1, reportMinutesAgo: 0, state: "working" }], {
    now: Date.now(),
    ...(opts.config !== undefined ? { config: { dashboard: { icons: opts.config } } } : {}),
  });
  const term = fakeTerminal();
  const cmd = new DashboardCommand();
  (cmd as unknown as { caps: unknown }).caps = capsFor(opts.caps);
  const run = cmd.run({ cwd: f.root, positionals: [], flags: { interactive: true, ...(opts.flag ? { icons: opts.flag } : {}) } });
  expect(await until(() => term.frames.some((fr) => fr.includes("l fleet")), 8000)).toBe(true);
  term.press("l");
  expect(await until(() => term.last().includes("lane-1-1"), 3000)).toBe(true);
  const frame = term.last();
  term.press("q");
  await run;
  return frame;
}

describe("Fleet view: icon precedence end to end (feature 029, FR-011)", () => {
  it("029:FR-011: auto on a unicode terminal draws the unicode glyphs", async () => {
    expect(await fleetFrame({})).toMatch(/▶ working/);
  }, 30_000);

  it("029:FR-011: dashboard.icons in the config applies when nothing overrides it", async () => {
    const frame = await fleetFrame({ config: "ascii" });
    expect(frame).toMatch(/\[>\] working/);
    expect(frame).toContain("[CC] Claude");
  }, 30_000);

  it("029:FR-011: AMBYKIT_ICONS beats the config", async () => {
    expect(await fleetFrame({ config: "unicode", env: "ascii" })).toMatch(/\[>\] working/);
  }, 30_000);

  it("029:FR-011: --icons beats the environment and the config", async () => {
    expect(await fleetFrame({ config: "ascii", env: "ascii", flag: "unicode" })).toMatch(/▶ working/);
    expect(await fleetFrame({ config: "unicode", env: "unicode", flag: "ascii" })).toMatch(/\[>\] working/);
  }, 60_000);

  it("029:FR-011: Nerd mode draws the same glyphs as Unicode (signed-off default)", async () => {
    expect(await fleetFrame({ flag: "nerd" })).toMatch(/▶ working/);
  }, 30_000);

  it("029:FR-011: a terminal without unicode is ASCII whatever was asked for", async () => {
    expect(await fleetFrame({ flag: "nerd", config: "nerd", caps: { unicode: false } })).toMatch(/\[>\] working/);
  }, 30_000);

  it("029:FR-011: an unknown AMBYKIT_ICONS value is ignored, falling through to the config", async () => {
    expect(await fleetFrame({ config: "ascii", env: "emoji" })).toMatch(/\[>\] working/);
  }, 30_000);
});
