import { describe, expect, it } from "vitest";
import { listRunners, runnable } from "../../src/core/runners.js";
import { registryFixture } from "../helpers/runner-registry-fixture.js";

/** Feature 033 (US-2): a runner is runnable only where and for the versions its live check was recorded. */

describe("runner verification by platform and version (feature 033)", () => {
  const registry = registryFixture();

  it("033:FR-004: a verified runner is runnable on a platform its record lists", () => {
    expect(runnable("alpha", registry, { platform: "linux" }).ok).toBe(true);
    expect(runnable("alpha", registry, { platform: "darwin", version: "1.4.0" }).ok).toBe(true);
  });

  it("033:FR-004, FR-005: a platform the record does not list is refused and the reason says so", () => {
    const can = runnable("alpha", registry, { platform: "win32" });
    expect(can.ok).toBe(false);
    if (!can.ok) {
      expect(can.reason).toContain("unverified on this platform");
      expect(can.reason).toContain("win32");
      expect(can.reason).toContain("linux, darwin");
    }
  });

  it("033:FR-004, FR-005: a version outside the recorded range is refused and the reason names both", () => {
    const can = runnable("alpha", registry, { platform: "linux", version: "3.1.0" });
    expect(can.ok).toBe(false);
    if (!can.ok) {
      expect(can.reason).toContain("unverified for version 3.1.0");
      expect(can.reason).toContain(">=1.0.0 <3.0.0");
    }
  });

  it("033:FR-004: a version is checked only when it is known; an unknown one does not refuse", () => {
    expect(runnable("alpha", registry, { platform: "linux" }).ok).toBe(true);
  });

  it("033:FR-005: an unverified runner is not runnable by default and the reason says it is unverified", () => {
    const can = runnable("beta", registry, { platform: "linux" });
    expect(can.ok).toBe(false);
    if (!can.ok) expect(can.reason).toContain("not verified yet");
  });

  it("033:FR-004: a runner written for 1.6, with no platform list, keeps the old rule (verified means runnable)", () => {
    expect(runnable("gamma", registry, { platform: "win32" }).ok).toBe(true);
  });

  it("033:FR-004: the second argument may be the registry (as before) or the environment", () => {
    expect(runnable("alpha", registry).ok).toBe(runnable("alpha", registry, {}).ok);
    expect(runnable("alpha", { platform: "linux" }).ok).toBe(false); // the shipped registry has no verified runner
  });

  it("033:FR-004, FR-005: the listing carries the record and applies the platform", () => {
    const rows = listRunners(registry, { platform: "win32" });
    const alpha = rows.find((r) => r.id === "alpha")!;
    expect(alpha.verifiedOn).toEqual(["linux", "darwin"]);
    expect(alpha.verifiedRange).toBe(">=1.0.0 <3.0.0");
    expect(alpha.runnable).toBe(false);
    expect(alpha.reason).toContain("unverified on this platform");
    expect(rows.find((r) => r.id === "gamma")!.runnable).toBe(true);
  });
});
