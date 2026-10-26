import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DIR,
  classify,
  combinePresence,
  parseMarker,
  presenceOf,
  readMarkers,
  writeMarker,
  type ActivityMarker,
} from "../../src/core/activity.js";
import type { Checkout, FeatureSnapshot } from "../../src/core/overview-types.js";

const T = { activeMinutes: 2, idleMinutes: 30 };
const NOW = Date.parse("2026-10-26T12:00:00Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();
const marker = (agent: string, min: number, extra: Partial<ActivityMarker> = {}): ActivityMarker => ({
  feature: "017-live",
  agent,
  phase: "implement",
  at: ago(min),
  ...extra,
});

describe("parseMarker", () => {
  it("accepts a full marker and ignores corrupt or partial ones", () => {
    expect(parseMarker(JSON.stringify({ agent: "codex", phase: "tasks", at: ago(1), task: "T001", pid: 4 }), "f")).toEqual({
      feature: "f",
      agent: "codex",
      phase: "tasks",
      at: ago(1),
      task: "T001",
      pid: 4,
    });
    expect(parseMarker("{", "f")).toBeNull();
    expect(parseMarker(JSON.stringify({ agent: "codex" }), "f")).toBeNull();
    expect(parseMarker(JSON.stringify({ agent: "../x", phase: "p", at: ago(1) }), "f")).toBeNull();
    expect(parseMarker(JSON.stringify({ agent: "codex", phase: "p", at: "yesterday-ish" }), "f")).toBeNull();
  });
});

describe("presence classification (FR-021)", () => {
  it("active < 2 min ≤ idle < 30 min ≤ stale", () => {
    expect(classify(60_000, T)).toBe("active");
    expect(classify(2 * 60_000, T)).toBe("idle");
    expect(classify(30 * 60_000, T)).toBe("stale");
  });

  it("an old marker stays active when the feature's tasks changed recently", () => {
    const p = presenceOf([marker("claude", 45)], NOW - 30_000, NOW, T)!;
    expect(p.state).toBe("active");
  });

  it("clamps a future timestamp to now", () => {
    const p = presenceOf([marker("claude", -10)], null, NOW, T)!;
    expect(p.since).toBe(NOW);
    expect(p.state).toBe("active");
  });

  it("most recent agent leads, the others are kept", () => {
    const p = presenceOf([marker("codex", 120, { phase: "tasks" }), marker("claude", 1, { task: "T014" })], null, NOW, T)!;
    expect(p).toMatchObject({ agent: "claude", task: "T014", state: "active", source: "reported" });
    expect(p.others.map((o) => [o.agent, o.state])).toEqual([["codex", "stale"]]);
  });
});

describe("combinePresence (FR-022/FR-023)", () => {
  const f = (dir: string) => ({ dir }) as FeatureSnapshot;
  const wt: Checkout = { root: "/r/.worktrees/002-b", kind: "worktree" };
  const main: Checkout = { root: "/r", kind: "main" };
  const base = {
    features: [f("001-a"), f("002-b")],
    tasksMtime: () => null,
    worktreeFeature: (c: Checkout) => (c === wt ? "002-b" : null),
    now: NOW,
    thresholds: T,
  };

  it("detection fills in only where no fresh marker exists", () => {
    const r = combinePresence({
      ...base,
      markers: [{ ...marker("claude", 1), feature: "002-b" }],
      matches: [{ agent: "codex", pid: 1, checkout: wt }],
    });
    expect(r.byFeature.get("002-b")).toMatchObject({ agent: "claude", source: "reported" });
  });

  it("a stale marker yields to a detected process, keeping the marker as other", () => {
    const r = combinePresence({
      ...base,
      markers: [{ ...marker("claude", 90), feature: "002-b" }],
      matches: [{ agent: "codex", pid: 1, checkout: wt }],
    });
    const p = r.byFeature.get("002-b")!;
    expect(p).toMatchObject({ agent: "codex", source: "detected", state: "active" });
    expect(p.others[0]).toMatchObject({ agent: "claude", state: "stale" });
  });

  it("main-checkout and unknown-cwd detections are never attributed to a feature", () => {
    const r = combinePresence({
      ...base,
      markers: [],
      matches: [
        { agent: "claude", pid: 1, checkout: main },
        { agent: "cursor-cli", pid: 2, checkout: null },
      ],
    });
    expect(r.byFeature.size).toBe(0);
    expect(r.unlocated).toEqual([
      { agent: "claude", where: "main" },
      { agent: "cursor-cli", where: "unknown" },
    ]);
  });
});

describe("marker files (FR-018/FR-019)", () => {
  it("round-trips and self-ignores via .amby/activity/.gitignore", () => {
    const root = mkdtempSync(join(tmpdir(), "ambykit-act-"));
    const path = writeMarker(root, marker("codex", 0, { task: "T001" }));
    expect(path).toMatch(/017-live\.codex\.json$/);
    expect(readFileSync(join(root, ACTIVITY_DIR, ".gitignore"), "utf8")).toContain("*");
    writeFileSync(join(root, ACTIVITY_DIR, "017-live.broken.json"), "{oops");
    expect(readMarkers(root)).toEqual([marker("codex", 0, { task: "T001" })]);
    expect(existsSync(join(root, ".gitignore"))).toBe(false);
  });
});
