import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readMetrics } from "../../src/core/metrics/index.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { fullHistory, HOUR, metricsRepo, specText, tasksText, type ScriptStep } from "../helpers/metrics-history.js";

const features = (n: number, opts: { v2?: boolean } = {}): ScriptStep[] =>
  Array.from({ length: n }, (_, i) => fullHistory(`${100 + i}-f${i}`, i * 20 * HOUR, opts))
    .flat()
    .sort((a, b) => a.at - b.at);

describe.skipIf(!HAS_GIT)("readMetrics over git history (feature 032, US-4)", () => {
  it("032:FR-007: a 1.x history with three finished features gives cycle times and a converge trend", () => {
    const m = readMetrics(metricsRepo("x", features(3)));
    expect(m.enough).toBe(true);
    const by = Object.fromEntries(m.phases.map((p) => [p.phase, p.typicalMs! / 1000 / HOUR]));
    expect(by).toEqual({ spec: 2, plan: 1, tasks: 4, converge: 3 });
    expect(m.phases.find((p) => p.phase === "spec")!.perFeature).toHaveLength(3);
    expect(m.gap).toHaveLength(3);
    expect(m.gap.map((g) => g.rate)).toEqual([0.5, 0.5, 0.5]);
    expect(m.skipped).toBe(0);
  });

  it("032:FR-008: too little history says so instead of showing numbers", () => {
    const m = readMetrics(metricsRepo("x", features(2)));
    expect(m.enough).toBe(false);
    expect(m.reason).toBe("too-little-history");
  });

  it("032:FR-008: no converge run means not enough data even with finished features", () => {
    const steps = features(3).filter((s) => !(s.file === "tasks.md" && /closes FR/.test(s.text)));
    expect(readMetrics(metricsRepo("x", steps)).enough).toBe(false);
  });

  it("032:FR-008: a directory that is not a git repository gives not-enough-data, never an error", () => {
    const m = readMetrics(join(process.cwd(), "node_modules", ".bin", "..", "..", "nonexistent-dir-032"));
    expect(m.enough).toBe(false);
  });

  it("032:FR-019: a revision that cannot be read is skipped and counted, and the rest still count", () => {
    const steps = features(3);
    steps.push({ at: 90 * HOUR, file: "spec.md", feature: "100-f0", text: "---\nformat: 2\nstories: [oops\n---\n# broken\n" });
    const m = readMetrics(metricsRepo("x", steps));
    expect(m.skipped).toBe(1);
    expect(m.enough).toBe(true);
  });

  it("032:FR-019: a history that mixes 1.x and 2.x revisions gives the same numbers as all 1.x", () => {
    const mixed = [...features(2), ...fullHistory("102-f2", 40 * HOUR, { v2: true })].sort((a, b) => a.at - b.at);
    const plain = features(3);
    const norm = (m: ReturnType<typeof readMetrics>) => JSON.stringify([m.enough, m.phases.map((p) => [p.phase, p.typicalMs]), m.gap.map((g) => g.rate)]);
    expect(norm(readMetrics(metricsRepo("x", mixed)))).toBe(norm(readMetrics(metricsRepo("x", plain))));
  });

  it("032:FR-007: a very large history is capped to the most recent commits", () => {
    const root = metricsRepo("x", features(3));
    const all = readMetrics(root);
    const capped = readMetrics(root, { cap: 2 });
    expect(all.enough).toBe(true);
    expect(capped.enough).toBe(false); // two commits cannot hold three finished features
  });

  it("032:FR-007: a spec whose status never becomes ready has an unfinished spec cycle", () => {
    const steps: ScriptStep[] = [
      { at: 0, file: "spec.md", feature: "100-a", text: specText("100-a", "draft") },
      { at: HOUR, file: "tasks.md", feature: "100-a", text: tasksText(0, 2) },
    ];
    const m = readMetrics(metricsRepo("x", steps));
    expect(m.phases.find((p) => p.phase === "spec")!.perFeature[0]).toMatchObject({ completedAt: null, ms: null });
  });
});

describe("metrics stay local (feature 032, FR-016)", () => {
  it("032:FR-016: the metrics code imports no network or model module", () => {
    const dir = join(import.meta.dirname, "..", "..", "src", "core", "metrics");
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).not.toMatch(/node:(http|https|net|dgram|tls|dns)|\bfetch\(|XMLHttpRequest|anthropic|openai/i);
    }
  });
});

describe.skipIf(!HAS_GIT)("metrics load without blocking (feature 032, US-4, T028)", () => {
  it("032:FR-007: the async read gives exactly the synchronous result", async () => {
    const { readMetricsAsync } = await import("../../src/core/metrics/index.js");
    const root = metricsRepo("x", features(3));
    expect(await readMetricsAsync(root)).toEqual(readMetrics(root));
  });

  it("032:FR-008: a failed read is an answer (not enough data), never an exception that could take other tabs down", async () => {
    const { readMetricsAsync } = await import("../../src/core/metrics/index.js");
    const m = await readMetricsAsync(join(process.cwd(), "nonexistent-dir-032"));
    expect(m.enough).toBe(false);
  });
});
