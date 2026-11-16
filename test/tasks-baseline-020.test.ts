import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTasks } from "../src/core/dashboard.js";

/**
 * SC-002 / FR-012 (feature 020): every shipped `tasks.md` keeps parsing to the same tasks after the
 * marker work. The fixture was recorded from the parser BEFORE feature 020 touched it:
 * `UPDATE_BASELINE=1 npx vitest run test/tasks-baseline-020.test.ts`.
 * Scope: shipped features 001-018 only (frozen); later features' task files keep changing.
 */
const root = join(import.meta.dirname, "..");
const fixturePath = join(root, "test", "fixtures", "tasks-baseline-020.json");

function shippedTaskFiles(): string[] {
  const specs = join(root, "specs");
  return readdirSync(specs)
    .filter((d) => /^0(0\d|1[0-8])-/.test(d) && existsSync(join(specs, d, "tasks.md")))
    .sort();
}

function snapshot(): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const dir of shippedTaskFiles()) {
    const tasks = parseTasks(readFileSync(join(root, "specs", dir, "tasks.md"), "utf8"));
    out[dir] = tasks.map((t) => ({
      id: t.id,
      done: t.done,
      story: t.story,
      phase: t.phase,
      parallel: t.parallel,
      paths: t.paths,
      pathIssue: t.pathIssue ?? null,
      description: t.description,
    }));
  }
  return out;
}

describe("tasks.md baseline (feature 020, SC-002)", () => {
  it("parses every shipped tasks.md exactly as before the marker work", () => {
    const now = snapshot();
    if (process.env["UPDATE_BASELINE"] === "1") {
      writeFileSync(fixturePath, JSON.stringify(now, null, 2) + "\n", "utf8");
    }
    const recorded = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown[]>;
    expect(Object.keys(now)).toEqual(Object.keys(recorded));
    for (const dir of Object.keys(recorded)) expect(now[dir], dir).toEqual(recorded[dir]);
  });

  it("covers a meaningful number of tasks", () => {
    const total = Object.values(snapshot()).reduce((n, t) => n + t.length, 0);
    expect(total).toBeGreaterThan(50);
  });
});
