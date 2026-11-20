import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { fullHistory, HOUR, metricsRepo } from "../helpers/metrics-history.js";
import { runCommand } from "../helpers/run-command.js";

const history = () =>
  Array.from({ length: 3 }, (_, i) => fullHistory(`${100 + i}-f${i}`, i * 20 * HOUR))
    .flat()
    .sort((a, b) => a.at - b.at);

const json = async (root: string, flags: Record<string, string | boolean>) => {
  const r = await runCommand(new DashboardCommand(), root, [], flags);
  return { code: r.code, doc: JSON.parse(r.out) as Record<string, unknown> };
};

describe.skipIf(!HAS_GIT)("dashboard --json --metrics (feature 032, US-4)", () => {
  it("032:FR-007, 032:FR-010: --metrics adds a `metrics` field to the overview JSON and keeps every other field", async () => {
    const root = metricsRepo("x", history());
    const base = await json(root, { json: true, overview: true });
    const withMetrics = await json(root, { json: true, metrics: true });
    expect(withMetrics.code).toBe(0);
    expect(base.doc).not.toHaveProperty("metrics");
    const { metrics, ...rest } = withMetrics.doc;
    expect(rest).toEqual(base.doc);
    expect(metrics).toMatchObject({ enough: true });
  });

  it("032:FR-008: a project with too little history reports enough: false", async () => {
    const root = metricsRepo("x", fullHistory("100-a", 0));
    const { doc } = await json(root, { json: true, metrics: true });
    expect(doc["metrics"]).toMatchObject({ enough: false, reason: "too-little-history" });
  });

  it("032:FR-010, 032:FR-011: without the flag nothing about metrics is added", async () => {
    const root = metricsRepo("x", history());
    expect(await json(root, { json: true, overview: true })).toMatchObject({ code: 0 });
    const plain = await runCommand(new DashboardCommand(), root, [], { json: true });
    expect(JSON.parse(plain.out)).toBeInstanceOf(Array);
  });
});
