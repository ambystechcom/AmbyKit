import { describe, expect, it } from "vitest";
import { readFeatures } from "../../src/core/features.js";
import { THREE, fleetProject, model } from "../helpers/fleet-plan-fixture.js";

describe("fleet plan fixture (031 phase 1)", () => {
  it("builds a three-feature project with a dependency and an overlap, as files and as models", () => {
    const { features } = readFeatures(fleetProject(THREE));
    expect(features.map((f) => f.dir)).toEqual(["030-base", "031-mid", "032-top"]);
    expect(features.find((f) => f.dir === "031-mid")?.dependsOn).toEqual(["030"]);
    expect(features[2]!.tasks?.[0]?.paths).toEqual(["src/shared.ts"]);
    expect(model(THREE[1]!).tasks[0]!.paths).toEqual(["src/shared.ts"]);
  });
});
