import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeGraph } from "../../src/core/analyze.js";
import type { StoryProgress } from "../../src/core/dashboard.js";
import { readFeatures } from "../../src/core/features.js";
import { attentionItems } from "../../src/core/overview.js";
import type { FeatureSnapshot } from "../../src/core/overview-types.js";

/**
 * FR-017 / SC-002 (feature 023): characterization goldens of today's dependency behaviour, recorded BEFORE
 * `analyzeGraph` and `attentionItems` were rebuilt on `buildGraph`; the refactor must leave them unchanged.
 * Re-record only deliberately: `UPDATE_GRAPH_GOLDEN=1 npx vitest run test/core/graph-golden.test.ts`.
 * Scope: shipped features 001-018 (frozen) plus synthetic fixtures for cycles, dangling references,
 * cross-feature edges and done blockers.
 */
const root = join(import.meta.dirname, "..", "..");
const goldenPath = join(root, "test", "fixtures", "graph", "golden.json");

function story(feature: string, id: string, p: Partial<StoryProgress> = {}): StoryProgress {
  const ref = feature.replace(/-.*$/, "");
  return {
    id,
    displayId: p.displayId ?? id.replace(/^US(\d+)$/, "US-$1"),
    featureRef: ref,
    key: `${ref}:${id}`,
    title: p.title ?? id,
    priority: p.priority ?? "P1",
    status: p.status ?? "draft",
    dependsOn: p.dependsOn ?? [],
    blockedBy: p.blockedBy ?? [],
    feature,
    tasksTotal: p.tasksTotal ?? 1,
    tasksDone: p.tasksDone ?? 0,
    percent: p.percent ?? 0,
  };
}

function feature(dir: string, stories: StoryProgress[]): FeatureSnapshot {
  const ref = dir.replace(/-.*$/, "");
  return {
    dir,
    ref,
    displayRef: ref,
    stories,
    tasks: null,
    artifacts: { spec: true, ui: false, uiSignedOff: false, plan: false, tasks: false },
    clarifications: [],
  };
}

const fixtures: Record<string, FeatureSnapshot[]> = {
  cycle: [
    feature("901-cycle", [
      story("901-cycle", "US1", { dependsOn: ["US2"] }),
      story("901-cycle", "US2", { dependsOn: ["US1"] }),
    ]),
  ],
  "self-dependency": [feature("902-self", [story("902-self", "US1", { dependsOn: ["US1"] })])],
  dangling: [
    feature("903-dangling", [
      story("903-dangling", "US1", { blockedBy: ["US9"] }),
      story("903-dangling", "US2", { dependsOn: ["999US1"] }),
    ]),
  ],
  "cross-feature": [
    feature("904-base", [
      story("904-base", "US1", { status: "done", tasksDone: 1, percent: 100 }),
      story("904-base", "US2", { status: "in-progress" }),
    ]),
    feature("905-top", [
      story("905-top", "US1", { dependsOn: ["904US1"] }),
      story("905-top", "US2", { dependsOn: ["904US2"] }),
      story("905-top", "US3", { blockedBy: ["904US1"] }),
      story("905-top", "US4", { blockedBy: ["904US2"] }),
      story("905-top", "US5", { status: "blocked" }),
      story("905-top", "US6", { dependsOn: ["US1", "US2"], blockedBy: ["US1"] }),
    ]),
  ],
  "no-dependencies": [feature("906-plain", [story("906-plain", "US1"), story("906-plain", "US2", { tasksTotal: 0 })])],
};

function shipped(): FeatureSnapshot[] {
  return readFeatures(root).features.filter((f) => /^0(0\d|1[0-8])-/.test(f.dir));
}

function capture(features: FeatureSnapshot[]): { analyze: unknown; attention: unknown } {
  return {
    analyze: analyzeGraph(features.flatMap((f) => f.stories)),
    attention: attentionItems(features, features),
  };
}

function snapshot(): Record<string, { analyze: unknown; attention: unknown }> {
  const out: Record<string, { analyze: unknown; attention: unknown }> = { "repo-001-018": capture(shipped()) };
  for (const [name, features] of Object.entries(fixtures)) out[name] = capture(features);
  return out;
}

describe("dependency behaviour goldens (feature 023, FR-017)", () => {
  it("analyzeGraph and attentionItems still produce exactly the recorded output", () => {
    const now = snapshot();
    if (process.env["UPDATE_GRAPH_GOLDEN"] === "1") {
      mkdirSync(dirname(goldenPath), { recursive: true });
      writeFileSync(goldenPath, JSON.stringify(now, null, 2) + "\n", "utf8");
    }
    const recorded = JSON.parse(readFileSync(goldenPath, "utf8")) as typeof now;
    expect(Object.keys(now)).toEqual(Object.keys(recorded));
    for (const name of Object.keys(recorded)) expect(now[name], name).toEqual(recorded[name]);
  });

  it("covers cycles, dangling references and blockers, and a meaningful number of stories", () => {
    const now = snapshot();
    const analyze = (name: string) => now[name]!.analyze as { issues: { kind: string }[]; blocked: unknown[] };
    expect(analyze("cycle").issues.some((i) => i.kind === "cycle")).toBe(true);
    expect(analyze("self-dependency").issues.some((i) => i.kind === "cycle")).toBe(true);
    expect(analyze("dangling").issues.filter((i) => i.kind === "dangling-reference").length).toBe(2);
    expect(analyze("cross-feature").blocked.length).toBeGreaterThan(0);
    expect(shipped().flatMap((f) => f.stories).length).toBeGreaterThan(30);
  });
});
