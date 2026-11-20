import { describe, expect, it } from "vitest";
import { superviseFleet } from "../../src/cli/run-fleet-loop.js";
import { feature, loop, states } from "../helpers/fleet-loop-fixture.js";

const dep = (on: string) => [{ feature: on, why: "depends-on" as const }];

describe("fleet supervisor (feature 031, US-3)", () => {
  it("031:FR-007: a feature starts only when everything it waits for is done", async () => {
    const h = loop([feature("031-a"), feature("032-b", dep("031-a"))]);
    expect(await h.sup.tick()).toBeNull();
    expect(h.begun).toEqual(["031-a"]);
    expect(states(h)).toEqual({ "031-a": "running", "032-b": "waiting" });
    await h.sup.tick();
    expect(h.begun).toEqual(["031-a"]); // still waiting while A runs
    h.fakes.get("031-a")!.finish();
    await h.sup.tick(); // A reports done
    expect(states(h)["031-a"]).toBe("done");
    await h.sup.tick(); // B may start now
    expect(h.begun).toEqual(["031-a", "032-b"]);
  });

  it("031:FR-007: a chain of dependencies starts in dependency order", async () => {
    const h = loop([feature("033-c", dep("032-b")), feature("032-b", dep("031-a")), feature("031-a")]);
    for (const name of ["031-a", "032-b", "033-c"]) {
      await h.sup.tick();
      await h.sup.tick();
      expect(h.begun.at(-1)).toBe(name);
      h.fakes.get(name)!.finish();
    }
    expect(h.begun).toEqual(["031-a", "032-b", "033-c"]);
  });

  it("031:FR-001: independent features start in the same tick and run side by side", async () => {
    const h = loop([feature("031-a"), feature("032-b")]);
    await h.sup.tick();
    expect(h.begun).toEqual(["031-a", "032-b"]);
  });

  it("031:FR-017: each started feature gets its run id in the fleet record, saved on change", async () => {
    const h = loop([feature("031-a")]);
    await h.sup.tick();
    expect(h.rec.features[0]!.run).toBe("031-a.1");
    expect(h.saved.at(-1)!.features[0]).toMatchObject({ state: "running", run: "031-a.1" });
  });

  it("031:FR-019: the fleet is done when every feature is done, and says so", async () => {
    const h = loop([feature("031-a"), feature("032-b")]);
    await h.sup.tick();
    h.fakes.get("031-a")!.finish();
    h.fakes.get("032-b")!.finish();
    const out = await h.sup.tick();
    expect(out).toMatchObject({ kind: "done" });
    expect(h.rec.status).toBe("done");
    expect(out!.message).toContain("2 features");
  });

  it("031:FR-015: an interrupt asks every started feature to stop and leaves the fleet resumable", async () => {
    const h = loop([feature("031-a"), feature("032-b", dep("031-a"))]);
    await h.sup.tick();
    const out = h.sup.interrupt();
    expect(out.kind).toBe("interrupted");
    expect(out.message).toContain("--continue-fleet=fleet-1");
    expect(h.fakes.get("031-a")!.interrupted).toBe(true);
    expect(h.rec.status).toBe("paused");
  });

  it("031:FR-007: superviseFleet ticks until the fleet is done, sleeping between ticks", async () => {
    const h = loop([feature("031-a")]);
    let sleeps = 0;
    const out = await superviseFleet(h.sup, {
      tickMs: 1000,
      interrupted: () => false,
      sleep: async () => {
        sleeps += 1;
        h.fakes.get("031-a")?.finish();
      },
    });
    expect(out.kind).toBe("done");
    expect(sleeps).toBeGreaterThan(0);
  });

  it("031:FR-008: a skipped feature counts as satisfied for what waits for it", async () => {
    const h = loop([feature("031-a"), feature("032-b", dep("031-a"))]);
    h.rec.features[0]!.state = "skipped"; // B waits on a skipped feature
    await h.sup.tick();
    expect(h.begun).toEqual(["032-b"]); // skipped counts as satisfied
  });
});
