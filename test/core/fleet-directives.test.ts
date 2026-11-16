import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { directiveAction, directivePath, directiveStatus, readDirective, writeDirective } from "../../src/core/fleet/directives.js";
import { createRun, updateRun } from "../../src/core/fleet/runs.js";
import { addLaneCheckout } from "../mcp/fixture.js";

const root = () => {
  const r = mkdtempSync(join(tmpdir(), "ambykit-dir-"));
  mkdirSync(join(r, ".amby"));
  return r;
};
const runOf = (r: string): string => {
  const out = createRun(r, "a-one");
  if (!out.ok) throw new Error(out.warning);
  return out.run.run;
};
const put = (r: string, run: string, lane: string, body: unknown): void => {
  const p = directivePath(r, run, lane);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body));
};
const T0 = "2026-11-16T10:00:00.000Z";
const before = "2026-11-16T09:59:00.000Z";
const after = "2026-11-16T10:01:00.000Z";

describe("directive reader", () => {
  it("025:FR-010: lives at .amby/fleet/<run>/directives/<short lane>.json", () => {
    const r = root();
    const run = runOf(r);
    expect(directivePath(r, run, "a-one.lane-2-1").replace(/\\/g, "/")).toMatch(/\.amby\/fleet\/a-one\.1\/directives\/lane-2-1\.json$/);
    expect(directivePath(r, run, "lane-2-1")).toBe(directivePath(r, run, "a-one.lane-2-1"));
  });

  it("025:FR-011: a missing file means continue", () => {
    const r = root();
    const run = runOf(r);
    expect(readDirective(r, run, "lane-1-1")).toBeNull();
    expect(directiveAction(null)).toBe("continue");
  });

  it("025:FR-010: reads { action, at }; the directive keeps being returned until a new one is written", () => {
    const r = root();
    const run = runOf(r);
    put(r, run, "lane-1-1", { action: "pause", at: T0 });
    expect(readDirective(r, run, "lane-1-1")).toEqual({ action: "pause", at: T0 });
    expect(readDirective(r, run, "lane-1-1")).toEqual({ action: "pause", at: T0 });
    put(r, run, "lane-1-1", { action: "stop", at: after });
    expect(readDirective(r, run, "a-one.lane-1-1")?.action).toBe("stop");
  });

  it("025:FR-011: an unreadable or malformed directive is read as continue, never a failure", () => {
    const r = root();
    const run = runOf(r);
    for (const body of ["{nope", { action: "explode", at: T0 }, { action: "pause" }, { action: "pause", at: "yesterday" }]) {
      put(r, run, "lane-1-1", body);
      expect(readDirective(r, run, "lane-1-1")).toBeNull();
    }
  });
});

describe("directiveStatus (FR-022)", () => {
  const pause = { action: "pause", at: T0 } as const;
  const stop = { action: "stop", at: T0 } as const;
  const cont = { action: "continue", at: T0 } as const;

  it("025:FR-022: no directive: none", () => {
    expect(directiveStatus(null, { at: T0, state: "working" })).toBe("none");
  });

  it("025:FR-022: pause requested while a pause exists and the lane is not paused", () => {
    expect(directiveStatus(pause, { at: before, state: "working" })).toBe("pause requested");
    expect(directiveStatus(pause, { at: after, state: "working" })).toBe("pause requested");
    expect(directiveStatus(pause, null)).toBe("pause requested");
  });

  it("025:FR-022: paused when the lane's state is paused", () => {
    expect(directiveStatus(pause, { at: after, state: "paused" })).toBe("paused");
  });

  it("025:FR-022: pending while a directive is newer than the lane's latest report, or there is none", () => {
    expect(directiveStatus(stop, { at: before, state: "working" })).toBe("pending");
    expect(directiveStatus(cont, null)).toBe("pending");
    expect(directiveStatus(stop, { at: T0, state: "working" })).toBe("pending"); // a tie counts as before
  });

  it("025:FR-022: obeyed when the lane's next report is dated after the directive", () => {
    expect(directiveStatus(stop, { at: after, state: "done" })).toBe("obeyed");
    expect(directiveStatus(cont, { at: after, state: "working" })).toBe("obeyed");
  });
});

describe("writeDirective (FR-023)", () => {
  const withLanes = (r: string, run: string, lanes: string[]): void => {
    updateRun(r, run, { lanes: lanes.map((lane) => ({ lane, assistant: "claude", tasks: [] })) });
  };

  it("025:FR-023: writes { action, at } to the short-lane file and returns it", () => {
    const r = root();
    const run = runOf(r);
    withLanes(r, run, ["a-one.lane-1-1"]);
    const out = writeDirective(r, { feature: "a-one", lane: "a-one.lane-1-1", action: "pause", now: new Date(T0) });
    expect(out).toEqual({ ok: true, run, lane: "lane-1-1", directive: { action: "pause", at: T0 } });
    expect(readDirective(r, run, "lane-1-1")).toEqual({ action: "pause", at: T0 });
  });

  it("025:FR-011: the last write wins, and continue is a normal action (resume)", () => {
    const r = root();
    const run = runOf(r);
    withLanes(r, run, ["a-one.lane-1-1"]);
    writeDirective(r, { feature: "a-one", lane: "1-1", action: "pause" });
    writeDirective(r, { feature: "a-one", lane: "lane-1-1", action: "stop" });
    writeDirective(r, { feature: "a-one", lane: "1-1", action: "continue" });
    expect(readDirective(r, run, "lane-1-1")?.action).toBe("continue");
  });

  it("025:FR-023: refuses a lane that is not in the run, naming it and the real lanes", () => {
    const r = root();
    const run = runOf(r);
    withLanes(r, run, ["a-one.lane-1-1", "a-one.lane-1-2"]);
    const out = writeDirective(r, { feature: "a-one", lane: "lane-9-9", action: "pause" });
    expect(out).toMatchObject({ ok: false });
    expect(!out.ok && out.error).toMatch(/lane 'lane-9-9' not found in run a-one\.1; lanes: lane-1-1, lane-1-2/);
    expect(readDirective(r, run, "lane-9-9")).toBeNull();
  });

  it("025:FR-023: a lane checkout on disk counts as a lane even before the run records it", () => {
    const r = root();
    runOf(r);
    addLaneCheckout(r, "a-one", 2, 1, ["T001"], "");
    expect(writeDirective(r, { feature: "a-one", lane: "2-1", action: "stop" })).toMatchObject({ ok: true, lane: "lane-2-1" });
  });

  it("025:FR-024: no unfinished run: refused with the reason, nothing is created", () => {
    const r = root();
    const out = writeDirective(r, { feature: "a-one", lane: "1-1", action: "pause" });
    expect(!out.ok && out.error).toMatch(/no unfinished run/);
  });

  it("025:FR-023: an explicit run among several, and an invalid action refused", () => {
    const r = root();
    runOf(r);
    const second = runOf(r);
    withLanes(r, second, ["a-one.lane-1-1"]);
    expect(writeDirective(r, { feature: "a-one", lane: "1-1", action: "pause", run: second })).toMatchObject({ ok: true, run: second });
    expect(writeDirective(r, { feature: "a-one", lane: "1-1", action: "explode" as never, run: second })).toMatchObject({ ok: false });
  });

  it("025:FR-010: lane worktrees write into the primary checkout's fleet directory", () => {
    const r = root();
    const run = runOf(r);
    withLanes(r, run, ["a-one.lane-1-1"]);
    const laneRoot = join(r, ".worktrees", "a-one.lane-1-1");
    mkdirSync(laneRoot, { recursive: true });
    writeDirective(laneRoot, { feature: "a-one", lane: "1-1", action: "pause" });
    expect(readDirective(r, run, "lane-1-1")?.action).toBe("pause");
  });

  it("025:FR-023: two writers racing leave one valid directive (never a torn file)", async () => {
    const r = root();
    const run = runOf(r);
    withLanes(r, run, ["a-one.lane-1-1"]);
    const actions = ["pause", "stop", "continue", "pause", "stop", "continue"] as const;
    await Promise.all(actions.map((action) => Promise.resolve().then(() => writeDirective(r, { feature: "a-one", lane: "1-1", action }))));
    expect(["pause", "stop", "continue"]).toContain(readDirective(r, run, "lane-1-1")?.action);
  });
});

describe("writeDirective across processes", () => {
  const dist = resolve(__dirname, "..", "..", "dist", "core", "fleet", "directives.js");
  it.skipIf(!existsSync(dist))("025:FR-023: separate processes racing leave one valid directive (needs `npm run build`)", async () => {
    const r = root();
    const run = runOf(r);
    updateRun(r, run, { lanes: [{ lane: "a-one.lane-1-1", assistant: "claude", tasks: [] }] });
    const script = `import { writeDirective } from ${JSON.stringify("file:///" + dist.replaceAll("\\", "/"))};
      const out = writeDirective(process.argv[1], { feature: "a-one", lane: "1-1", action: process.argv[2] });
      if (!out.ok) { console.error(out.error); process.exit(1); }`;
    const { execFile } = await import("node:child_process");
    await Promise.all(
      ["pause", "stop", "continue", "pause", "stop", "continue"].map(
        (action) => new Promise<void>((done, bad) => execFile(process.execPath, ["--input-type=module", "-e", script, r, action], (err) => (err ? bad(err) : done()))),
      ),
    );
    expect(["pause", "stop", "continue"]).toContain(readDirective(r, run, "lane-1-1")?.action);
  });
});
