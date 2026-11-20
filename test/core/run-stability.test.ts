import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RunCommand } from "../../src/cli/run.js";
import { dogfoodProblems, isExperimental, RUN_STABILITY, stabilityLabel, stabilityProblems, withStability } from "../../src/core/run-stability.js";

/**
 * Feature 033 (US-3, FR-006, Principle 6): `run` loses its experimental label only after one fleet has built two dependent features of
 * this repository with a verified runner, and the record of that run exists. One constant switches every label (T012).
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOGFOOD = join(ROOT, "specs", "033-stable-run-and-plugin-api", "dogfood.md");

const GOOD = [
  "# Dogfood",
  "",
  "- **Fleet run id:** fleet-4",
  "- **Runner:** claude 1.2.3 on windows",
  "- **Versions:** ambykit 2.0.0-rc.1; claude 1.2.3",
  "- **Features:** 034 and 035 (035 depends on 034)",
  "- **Result:** passed, both features merged with no manual start, order or merge step",
].join("\n");

describe("run stability (feature 033)", () => {
  it("033:FR-006: the constant may be stable only if dogfood.md records a fleet run id, runner, versions, features and a passed result", () => {
    const text = existsSync(DOGFOOD) ? readFileSync(DOGFOOD, "utf8") : undefined;
    expect(stabilityProblems(RUN_STABILITY, text), "RUN_STABILITY is stable without a recorded, passed dogfood").toEqual([]);
  });

  it("033:FR-006: while experimental nothing is required; once stable, a missing or incomplete or failed record is refused", () => {
    expect(stabilityProblems("experimental", undefined)).toEqual([]);
    expect(stabilityProblems("stable", undefined)).toEqual(["specs/033-stable-run-and-plugin-api/dogfood.md does not exist"]);
    expect(stabilityProblems("stable", GOOD)).toEqual([]);
    expect(dogfoodProblems(GOOD.replace("- **Fleet run id:** fleet-4", ""))).toEqual(["dogfood.md records no 'Fleet run id'"]);
    expect(dogfoodProblems(GOOD.replace(/- \*\*Runner:\*\*.*/, "- **Runner:**"))).toEqual(["dogfood.md records no 'Runner'"]);
    expect(dogfoodProblems(GOOD.replace(/passed.*/, "failed: lane 2 stalled"))).toEqual(["dogfood.md records the result 'failed: lane 2 stalled', not 'passed'"]);
  });

  it("033:FR-006: while experimental the label is the one every surface prints; stable removes it everywhere at once", () => {
    expect(isExperimental("experimental")).toBe(true);
    expect(stabilityLabel("experimental")).toBe("(experimental)");
    expect(withStability("Run plan", "experimental")).toBe("Run plan (experimental)");
    expect(isExperimental("stable")).toBe(false);
    expect(stabilityLabel("stable")).toBe("");
    expect(withStability("Run plan", "stable")).toBe("Run plan");
  });

  it("033:FR-006: the command's summary follows the constant", () => {
    const summary = new RunCommand().summary;
    expect(summary.includes("(experimental)")).toBe(isExperimental());
    expect(summary).toContain("Run a feature's prepared lanes headless");
  });

  it("033:FR-006: no source file outside run-stability.ts spells the label itself", () => {
    const files = ["src/cli/run.ts", "src/cli/run-fleet.ts", "src/cli/run-script.ts", "src/core/fleet-plan/format.ts"];
    for (const f of files) expect(readFileSync(join(ROOT, f), "utf8"), f).not.toContain("(experimental)");
  });
});
