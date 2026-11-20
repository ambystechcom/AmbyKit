import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readBurndown, scopeOf } from "../src/core/burndown.js";
import { readFeatures } from "../src/core/features.js";
import { convertSpec } from "../src/core/migrate/convert-spec.js";
import { convertTasks } from "../src/core/migrate/convert-tasks.js";
import { readTasks } from "../src/core/spec-format/dispatch.js";
import { HAS_GIT } from "./helpers/git-repo.js";

/**
 * 030:FR-021, SC-008 — a repository whose old revisions are 1.x and whose head is v2 is read correctly by the history readers,
 * because every reader goes through the per-file dispatcher and the format is decided from each revision's own content.
 */
const utc = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const FEATURE = "010-mixed";

const SPEC_V1 = `---\nfeature: ${FEATURE}\n---\n\n### US-1 — Story  (priority: P1)\n\n- **status:** in-progress\n`;
const tasksV1 = (done: number): string =>
  ["## Phase 1 — Go", "", ...Array.from({ length: 4 }, (_, i) => `- [${i < done ? "x" : " "}] [T00${i + 1}] [US1] task ${i + 1} (src/f${i + 1}.ts)`), "- **Verify:** `npm test` ✓ passed", ""].join("\n");

function repoWithMixedHistory(): { root: string; revisions: { v1: string; v2: string } } {
  const root = mkdtempSync(join(tmpdir(), "ambykit-030-history-"));
  const git = (args: string[], date?: string): string => {
    const env = date ? { ...process.env, GIT_AUTHOR_DATE: `${date}T12:00:00Z`, GIT_COMMITTER_DATE: `${date}T12:00:00Z` } : process.env;
    return execFileSync("git", args, { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  };
  git(["init", "-q", "-b", "main"]);
  for (const [k, v] of [["user.email", "t@example.com"], ["user.name", "Test"], ["commit.gpgsign", "false"], ["gc.auto", "0"], ["maintenance.auto", "false"]] as const) git(["config", k, v]);
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: [] }));
  const dir = join(root, "specs", FEATURE);
  mkdirSync(dir, { recursive: true });

  // 1.x revisions
  writeFileSync(join(dir, "spec.md"), SPEC_V1);
  writeFileSync(join(dir, "tasks.md"), tasksV1(0));
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "start"], "2026-08-03");
  writeFileSync(join(dir, "tasks.md"), tasksV1(1));
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "one done"], "2026-08-10");
  const v1 = git(["rev-parse", "HEAD"]);

  // head: migrated to v2, two more tasks done
  writeFileSync(join(dir, "spec.md"), convertSpec(SPEC_V1, FEATURE).text);
  writeFileSync(join(dir, "tasks.md"), convertTasks(tasksV1(3)).text);
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "migrate and finish more"], "2026-08-17");
  const v2 = git(["rev-parse", "HEAD"]);
  return { root, revisions: { v1, v2 } };
}

describe.skipIf(!HAS_GIT)("history across a format change (030, FR-021)", () => {
  const now = utc("2026-08-26");

  it("030:FR-021: the fixture really holds both formats", () => {
    const { root, revisions } = repoWithMixedHistory();
    const show = (rev: string): string => execFileSync("git", ["show", `${rev}:specs/${FEATURE}/tasks.md`], { cwd: root, encoding: "utf8" });
    expect(readTasks(show(revisions.v1)).format).toBe(1);
    expect(readTasks(show(revisions.v2)).format).toBe(2);
  });

  it("030:FR-021: the burndown counts the 1.x revisions and the v2 head the same way", () => {
    const { root } = repoWithMixedHistory();
    const { features } = readFeatures(root);
    const { scope, current } = scopeOf(features, false);
    expect(current).toEqual({ total: 4, remaining: 1 });
    const b = readBurndown({ root, scope, current, maxPeriods: 10, minPoints: 2, now });
    expect(b.status).toBe("ready");
    expect(b.points.map((p) => [p.periodStart, p.total, p.remaining])).toEqual([
      ["2026-08-03", 4, 4],
      ["2026-08-10", 4, 3],
      ["2026-08-17", 4, 1],
      ["2026-08-24", 4, 1],
    ]);
  });

  it("030:FR-021: the lane's `git show <rev>:tasks.md` read gives the same tasks in either format", () => {
    const { root, revisions } = repoWithMixedHistory();
    const tasksAt = (rev: string) => readTasks(execFileSync("git", ["show", `${rev}:specs/${FEATURE}/tasks.md`], { cwd: root, encoding: "utf8" })).tasks;
    const old = tasksAt(revisions.v1);
    const head = tasksAt(revisions.v2);
    expect(old.map((t) => t.id)).toEqual(head.map((t) => t.id));
    expect(old.map((t) => t.paths)).toEqual(head.map((t) => t.paths));
    expect(old.filter((t) => t.done).map((t) => t.id)).toEqual(["T001"]);
    expect(head.filter((t) => t.done).map((t) => t.id)).toEqual(["T001", "T002", "T003"]);
  });
});
