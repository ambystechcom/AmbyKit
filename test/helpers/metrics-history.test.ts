import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { HAS_GIT } from "./git-repo.js";
import { fullHistory, metricsRepo, T0 } from "./metrics-history.js";

describe.skipIf(!HAS_GIT)("metrics history fixture (feature 032, T002)", () => {
  it("builds a repo whose log has the scripted commits at the scripted times", () => {
    const root = metricsRepo("100-x", fullHistory("100-x", 0));
    const log = execFileSync("git", ["log", "--reverse", "--format=%ct"], { cwd: root, encoding: "utf8" }).trim().split("\n").map(Number);
    expect(log).toHaveLength(7);
    expect(log[0]).toBe(T0);
    expect(log.at(-1)).toBe(T0 + 12 * 3600);
  });
});
