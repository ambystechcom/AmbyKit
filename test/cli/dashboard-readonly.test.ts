import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { DashboardCommand } from "../../src/cli/dashboard.js";
import { HAS_GIT } from "../helpers/git-repo.js";
import { gitHistoryFixture } from "../helpers/git-history-fixture.js";
import { dashboardFixture } from "../helpers/dashboard-fixture.js";

/** Every file (outside .git internals' lock-free reads) with its size, mtime and content. */
function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(relative(root, p), `${statSync(p).mtimeMs}:${readFileSync(p, "utf8").length}`);
    }
  };
  walk(root);
  return out;
}

async function run(root: string, flags: Record<string, string | boolean>): Promise<void> {
  const orig = console.log;
  console.log = () => {};
  try {
    await new DashboardCommand().run({ cwd: root, positionals: [], flags });
  } finally {
    console.log = orig;
  }
}

describe("dashboard is read-only (FR-017)", () => {
  it("writes nothing in a plain project, for every output mode", async () => {
    const root = dashboardFixture({ edges: true });
    const before = snapshot(root);
    for (const flags of [{}, { stories: true }, { json: true }, { json: true, overview: true }, { feature: "002" }]) {
      await run(root, flags);
    }
    expect(snapshot(root)).toEqual(before);
  });

  it.skipIf(!HAS_GIT)("reading git history leaves the repository untouched", async () => {
    const root = gitHistoryFixture("001-x", [
      { date: "2026-08-03", done: 0, total: 4 },
      { date: "2026-08-12", done: 2 },
    ]);
    const before = snapshot(root);
    await run(root, {});
    await run(root, { json: true, overview: true });
    expect(snapshot(root)).toEqual(before);
  });
});
