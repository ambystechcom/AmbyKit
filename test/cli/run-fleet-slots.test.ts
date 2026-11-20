import { describe, expect, it } from "vitest";
import { harness, preparedProject, script } from "../helpers/run-fakes.js";
import { launchQueued } from "../../src/cli/run-launch.js";

describe("Session.slots hook (feature 031)", () => {
  it("031:FR-010: lanes running in other sessions count toward the total cap", async () => {
    const p = await preparedProject("031-a", 4, 2);
    const h = harness(p, { settings: { concurrency: { total: 3, perType: 2 } } });
    script(h, p, { hang: true });
    h.s.slots = () => [{ lane: "032-b.lane-1-1", assistant: "claude" }, { lane: "032-b.lane-1-2", assistant: "codex" }];
    expect(launchQueued(h.s, 1)).toBe(1); // 2 elsewhere + 1 here = the cap of 3
    expect(h.port.starts).toHaveLength(1);
  });

  it("031:FR-012: the per-type cap holds across sessions", async () => {
    const p = await preparedProject("031-a", 4, 2);
    const h = harness(p, { assistants: ["claude", "claude"], settings: { concurrency: { total: 5, perType: 2 } } });
    script(h, p, { hang: true });
    h.s.slots = () => [{ lane: "032-b.lane-1-1", assistant: "claude" }];
    expect(launchQueued(h.s, 1)).toBe(1); // one claude elsewhere, so only one more of that type
  });

  it("031:FR-019: without a slots hook a session behaves exactly as before", async () => {
    const p = await preparedProject("031-a", 4, 2);
    const h = harness(p, { settings: { concurrency: { total: 3, perType: 2 } } });
    script(h, p, { hang: true });
    expect(launchQueued(h.s, 1)).toBe(2);
  });
});
