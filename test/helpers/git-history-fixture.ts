import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dashboardFixture } from "./dashboard-fixture.js";

/**
 * A git-backed AmbyKit project whose `tasks.md` check-offs are committed on fixed dates (feature 014,
 * US-7). Each step sets how many of `total` tasks are done and commits at `date` (ISO, UTC noon).
 */
export interface HistoryStep {
  date: string; // "2026-08-10"
  done: number;
  total?: number; // defaults to the previous step's total
}

export function gitHistoryFixture(feature: string, steps: HistoryStep[]): string {
  const root = dashboardFixture({ features: [] });
  const git = (args: string[], date?: string): void => {
    const env = date
      ? { ...process.env, GIT_AUTHOR_DATE: `${date}T12:00:00Z`, GIT_COMMITTER_DATE: `${date}T12:00:00Z` }
      : process.env;
    execFileSync("git", args, { cwd: root, env, stdio: "ignore" });
  };
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);
  git(["config", "commit.gpgsign", "false"]);

  const dir = join(root, "specs", feature);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "spec.md"), `# ${feature}\n\n### US-1 — Story  (priority: P1)\n\n- **status:** in-progress\n`);
  let total = 0;
  for (const step of steps) {
    total = step.total ?? total;
    const lines = Array.from({ length: total }, (_, i) => {
      const id = `T${String(i + 1).padStart(3, "0")}`;
      return `- [${i < step.done ? "x" : " "}] [${id}] [US1] task ${id} (src/x.ts)`;
    });
    writeFileSync(join(dir, "tasks.md"), lines.join("\n") + "\n");
    git(["add", "-A"]);
    git(["commit", "-q", "-m", `progress ${step.date}`], step.date);
  }
  return root;
}
