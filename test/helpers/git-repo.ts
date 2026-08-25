import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitAvailable } from "../../src/core/git.js";

/** True when git is on PATH — tests that need a real repo `it.skipIf(!HAS_GIT)`. */
export const HAS_GIT = gitAvailable();

function run(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/**
 * A throwaway AmbyKit project inside a fresh git repo: one commit on `main`, `.amby/config.json`,
 * and `specs/<id>/spec.md` for each id in `features` (feature 012 test fixture).
 */
export function gitProject(features: string[] = ["003-foo"]): string {
  const root = mkdtempSync(join(tmpdir(), "ambykit-wt-"));
  run(root, ["init", "-q", "-b", "main"]);
  run(root, ["config", "user.email", "test@example.com"]);
  run(root, ["config", "user.name", "Test"]);
  run(root, ["config", "commit.gpgsign", "false"]);
  mkdirSync(join(root, ".amby"), { recursive: true });
  writeFileSync(join(root, ".amby", "config.json"), JSON.stringify({ version: "0.0.0", tools: ["claude"] }) + "\n");
  for (const id of features) {
    mkdirSync(join(root, "specs", id), { recursive: true });
    writeFileSync(join(root, "specs", id, "spec.md"), `---\nfeature: ${id}\nstatus: draft\n---\n# ${id}\n`);
  }
  writeFileSync(join(root, "README.md"), "# fixture\n");
  run(root, ["add", "-A"]);
  run(root, ["commit", "-q", "-m", "init"]);
  return root;
}

export { run as gitRun };
