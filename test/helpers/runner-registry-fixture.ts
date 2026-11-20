import type { RunnerSpec } from "../../src/core/runners.js";

/**
 * Fake runner registries for the verification rules (feature 033, FR-004, FR-005): one runner verified on given platforms and a
 * version range, one unverified, one verified without a platform list (the shape 1.6 used). No real assistant is involved.
 */

export function runner(over: Partial<RunnerSpec> & { id: string }): RunnerSpec {
  return {
    label: over.id.toUpperCase(),
    executable: over.id,
    invoke: () => ({ exe: over.id, args: [] }),
    exit: "0 = finished; non-zero = failed",
    reportsUsage: false,
    verified: false,
    toVerify: "everything",
    ...over,
  };
}

/** `alpha` verified on linux and darwin for 1.x and 2.x; `beta` unverified; `gamma` verified with no platform list. */
export function registryFixture(): RunnerSpec[] {
  return [
    runner({ id: "alpha", verified: true, verifiedVersion: "1.4.0", verifiedOn: ["linux", "darwin"], verifiedRange: ">=1.0.0 <3.0.0" }),
    runner({ id: "beta" }),
    runner({ id: "gamma", verified: true, verifiedVersion: "0.9.0" }),
  ];
}
