import { execFile } from "node:child_process";
import { parseCatFileBatch } from "../burndown.js";
import { git, gitAsync, gitWithInput } from "../git.js";
import type { FeatureHistory, Revision, Touch } from "./types.js";

/**
 * The git edge of the metrics (feature 032, T020): which commits touched each feature's spec, plan and tasks, and
 * their text at those commits. Two read-only git processes: one `git log`, one `git cat-file --batch`, reusing
 * burndown's batch reader. Capped at the most recent `cap` commits so a very large history stays cheap (plan R3).
 */

export const DEFAULT_COMMIT_CAP = 500;

const FILE = /^specs\/([^/]+)\/(spec|plan|tasks)\.md$/;

interface Touched {
  commit: string;
  time: number;
  files: { feature: string; kind: "spec" | "plan" | "tasks" }[];
}

/** Parse `git log --format=%x01%H %ct --name-only` output, newest first as git prints it. */
export function parseLog(out: string): Touched[] {
  const commits: Touched[] = [];
  for (const block of out.split("\x01").slice(1)) {
    const [head, ...names] = block.split("\n");
    const [commit, time] = (head ?? "").trim().split(" ");
    if (!commit || !time) continue;
    const files: Touched["files"] = [];
    for (const n of names) {
      const m = FILE.exec(n.trim());
      if (m) files.push({ feature: m[1]!, kind: m[2] as "spec" | "plan" | "tasks" });
    }
    if (files.length) commits.push({ commit, time: Number(time), files });
  }
  return commits;
}

type Request = { commit: string; time: number; feature: string; kind: "spec" | "tasks" };

function requestsOf(commits: Touched[]): Request[] {
  const requests: Request[] = [];
  for (const c of commits) for (const f of c.files) if (f.kind !== "plan") requests.push({ commit: c.commit, time: c.time, feature: f.feature, kind: f.kind });
  return requests;
}

const batchInput = (requests: Request[]): string => requests.map((r) => `${r.commit}:./specs/${r.feature}/${r.kind}.md`).join("\n") + "\n";
const logArgs = (cap: number): string[] => ["log", "-n", String(cap), "--reverse", "--relative", "--format=%x01%H %ct", "--name-only", "--", "specs"];

function assemble(commits: Touched[], requests: Request[], blobs: (string | null)[]): FeatureHistory[] {
  const by = new Map<string, FeatureHistory>();
  const of = (feature: string): FeatureHistory => {
    let h = by.get(feature);
    if (!h) by.set(feature, (h = { feature, spec: [], plan: [], tasks: [] }));
    return h;
  };
  requests.forEach((r, i) => {
    const text = blobs[i];
    if (text == null) return; // the file did not exist at that commit (a deletion)
    const rev: Revision = { commit: r.commit, time: r.time, text };
    of(r.feature)[r.kind].push(rev);
  });
  for (const c of commits) for (const f of c.files) if (f.kind === "plan") of(f.feature).plan.push({ commit: c.commit, time: c.time } satisfies Touch);
  return [...by.values()].sort((a, b) => a.feature.localeCompare(b.feature));
}

/** Per-feature histories (oldest first) from the last `cap` commits touching `specs/`. Throws when git fails. */
export function readHistories(root: string, cap = DEFAULT_COMMIT_CAP): FeatureHistory[] {
  const commits = parseLog(git(root, logArgs(cap)));
  const requests = requestsOf(commits);
  const blobs = requests.length ? parseCatFileBatch(gitWithInput(root, ["cat-file", "--batch"], batchInput(requests)), requests.length) : [];
  return assemble(commits, requests, blobs);
}

/** `git cat-file --batch` without blocking the event loop: the interactive dashboard reads metrics with this. */
function catFileAsync(cwd: string, input: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = execFile("git", ["cat-file", "--batch"], { cwd, encoding: "buffer", maxBuffer: 256 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr.toString() || err.message).trim()));
      else resolve(stdout);
    });
    child.stdin?.on("error", () => undefined);
    child.stdin?.end(input);
  });
}

/** Same result as `readHistories`, with both git processes run asynchronously. */
export async function readHistoriesAsync(root: string, cap = DEFAULT_COMMIT_CAP): Promise<FeatureHistory[]> {
  const commits = parseLog(await gitAsync(root, logArgs(cap)));
  const requests = requestsOf(commits);
  const blobs = requests.length ? parseCatFileBatch(await catFileAsync(root, batchInput(requests)), requests.length) : [];
  return assemble(commits, requests, blobs);
}
