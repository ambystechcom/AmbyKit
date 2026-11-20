import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DashboardCommand } from "../src/cli/dashboard.js";
import { migrateProject } from "../src/core/migrate/run.js";
import { ownSpecsCopy } from "./helpers/spec-project.js";

/**
 * 030:FR-022, SC-008 — the one-shot dashboard on AmbyKit's own specs, migrated to v2 in a temporary copy, stays inside the
 * dashboard's one-second budget (026:R-8). The 1.x original is timed beside it so the cost of the v2 reader is visible.
 * The medians are logged; they are recorded in specs/030-spec-v2-and-migrate/notes.md.
 */
let v1: string;
let v2: string;
beforeAll(() => {
  v1 = ownSpecsCopy();
  v2 = mkdtempSync(join(tmpdir(), "ambykit-030-perf-"));
  cpSync(v1, v2, { recursive: true });
  migrateProject(v2, {});
});

async function once(root: string, flags: Record<string, string | boolean>): Promise<number> {
  const orig = [console.log, console.warn, console.error];
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  const t0 = performance.now();
  try {
    await new DashboardCommand().run({ cwd: root, positionals: [], flags });
  } finally {
    [console.log, console.warn, console.error] = orig as [typeof console.log, typeof console.warn, typeof console.error];
  }
  return performance.now() - t0;
}

async function median(root: string, flags: Record<string, string | boolean>, n = 5): Promise<number> {
  await once(root, flags); // warm up (module loading, JIT)
  const times: number[] = [];
  for (let i = 0; i < n; i++) times.push(await once(root, flags));
  times.sort((a, b) => a - b);
  return times[Math.floor(n / 2)] as number;
}

describe("dashboard performance with the v2 reader (030, FR-022, SC-008)", () => {
  it("030:FR-022: one-shot on the migrated own specs stays under 1 s", async () => {
    const m1 = await median(v1, {});
    const m2 = await median(v2, {});
    console.log(`PERF one-shot median: 1.x ${m1.toFixed(0)} ms, v2 ${m2.toFixed(0)} ms`);
    expect(m2).toBeLessThan(1000);
  });

  it("030:FR-022: --json --overview on the migrated own specs stays under 1 s", async () => {
    const m1 = await median(v1, { json: true, overview: true });
    const m2 = await median(v2, { json: true, overview: true });
    console.log(`PERF overview median: 1.x ${m1.toFixed(0)} ms, v2 ${m2.toFixed(0)} ms`);
    expect(m2).toBeLessThan(1000);
  });
});
