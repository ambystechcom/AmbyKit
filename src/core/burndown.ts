import { parseTasks, type TaskLine } from "./dashboard.js";
import { git, gitAvailable, gitWithInput, isRepo } from "./git.js";
import type { Burndown, BurndownPoint, FeatureSnapshot } from "./overview-types.js";

/**
 * Burndown over time from the git history of `specs/<dir>/tasks.md` (feature 014, US-7). Two
 * read-only git processes at most: one `git log`, one `git cat-file --batch` (R-2). The period math
 * and sampling are pure and exported for tests; the last point is always the working tree.
 */

export type Period = "daily" | "weekly" | "monthly";

/** Which tasks count: per feature dir, the allowed story ids (`null` = every task in the file). */
export type BurndownScope = Map<string, Set<string> | null>;

export interface HistoryCommit {
  sha: string;
  time: number; // unix seconds
}

export interface Counts {
  total: number;
  remaining: number;
}

const DAY = 86_400_000;
const PERIOD_NOUN: Record<Period, string> = { daily: "day", weekly: "week", monthly: "month" };

export function periodNoun(p: Period): string {
  return PERIOD_NOUN[p];
}

/** Start (UTC midnight) of the period containing `t`. Weeks start on Monday. */
export function periodStart(t: number, period: Period): number {
  const d = new Date(t);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (period === "daily") return day;
  if (period === "weekly") return day - ((d.getUTCDay() + 6) % 7) * DAY;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Start of the period after the one starting at `start`. */
export function nextPeriod(start: number, period: Period): number {
  if (period === "daily") return start + DAY;
  if (period === "weekly") return start + 7 * DAY;
  const d = new Date(start);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** Every period start from the one containing `first` through the one containing `now`. */
export function periodStarts(first: number, now: number, period: Period): number[] {
  const out: number[] = [];
  for (let s = periodStart(first, period); s <= now; s = nextPeriod(s, period)) out.push(s);
  return out;
}

/**
 * The finest period whose count fits `maxPeriods`; if even monthly does not fit, monthly keeping the
 * most recent `maxPeriods`.
 */
export function choosePeriods(first: number, now: number, maxPeriods: number): { period: Period; starts: number[] } {
  for (const period of ["daily", "weekly", "monthly"] as const) {
    const starts = periodStarts(first, now, period);
    if (starts.length <= maxPeriods || period === "monthly") {
      return { period, starts: starts.slice(Math.max(0, starts.length - maxPeriods)) };
    }
  }
  /* c8 ignore next */
  throw new Error("unreachable");
}

/** For each period except the last, the last commit before the period ends (or null). */
export function sampleCommits(commits: HistoryCommit[], starts: number[], period: Period): (HistoryCommit | null)[] {
  return starts.slice(0, -1).map((s) => {
    const end = nextPeriod(s, period);
    let pick: HistoryCommit | null = null;
    for (const c of commits) if (c.time * 1000 < end) pick = c;
    return pick;
  });
}

/**
 * Assemble points (pure): sampled counts per period, carrying the previous value forward when a
 * period has no commit, and the working tree as the last point (I-8).
 */
export function buildBurndown(
  period: Period,
  starts: number[],
  sampled: (Counts | null)[],
  current: Counts,
  minPoints: number,
): Burndown {
  const points: BurndownPoint[] = [];
  let carry: Counts | null = null;
  starts.forEach((s, i) => {
    const value: Counts | null = i === starts.length - 1 ? current : (sampled[i] ?? carry);
    if (value) {
      points.push({ periodStart: new Date(s).toISOString().slice(0, 10), ...value });
      carry = value;
    }
  });
  if (points.length < minPoints) return { status: "no-history", reason: "too-little-history", points: [] };
  const last = points.at(-1)!;
  const prev = points.at(-2)!;
  return { status: "ready", period, points, deltaRemaining: last.remaining - prev.remaining };
}

/** Count tasks in scope: all of them, or only those tagged with an allowed story. */
export function countTasks(tasks: TaskLine[], allowed: Set<string> | null): Counts {
  const inScope = allowed ? tasks.filter((t) => t.story !== null && allowed.has(t.story)) : tasks;
  return { total: inScope.length, remaining: inScope.filter((t) => !t.done).length };
}

/** The scope and working-tree counts for a set of (already filtered) features. */
export function scopeOf(features: FeatureSnapshot[], statusFiltered: boolean): { scope: BurndownScope; current: Counts } {
  const scope: BurndownScope = new Map();
  const current: Counts = { total: 0, remaining: 0 };
  for (const f of features) {
    const allowed = statusFiltered ? new Set(f.stories.map((s) => s.id)) : null;
    scope.set(f.dir, allowed);
    const c = countTasks(f.tasks ?? [], allowed);
    current.total += c.total;
    current.remaining += c.remaining;
  }
  return { scope, current };
}

/**
 * Parse `git cat-file --batch` output into one entry per request: the blob text, or null for a
 * `missing` object (the file did not exist at that commit).
 */
export function parseCatFileBatch(out: Buffer, requests: number): (string | null)[] {
  const results: (string | null)[] = [];
  let pos = 0;
  while (results.length < requests && pos < out.length) {
    const eol = out.indexOf(0x0a, pos);
    const header = out.subarray(pos, eol === -1 ? out.length : eol).toString("utf8");
    pos = eol === -1 ? out.length : eol + 1;
    const m = /^\S+ (\S+) (\d+)$/.exec(header);
    if (!m) {
      results.push(null); // "<object> missing" / "ambiguous"
      continue;
    }
    const size = Number(m[2]);
    results.push(out.subarray(pos, pos + size).toString("utf8"));
    pos += size + 1; // body + trailing LF
  }
  return results;
}

export interface BurndownInput {
  root: string;
  scope: BurndownScope;
  current: Counts;
  maxPeriods: number;
  minPoints: number;
  now?: number; // ms; injectable for tests
}

/** Read history and build the burndown (FR-018, FR-019). Never throws; failures become no-history. */
export function readBurndown(input: BurndownInput): Burndown {
  const { root, scope, current, maxPeriods, minPoints } = input;
  const now = input.now ?? Date.now();
  if (!gitAvailable()) return { status: "no-history", reason: "git-missing", points: [] };
  if (!isRepo(root)) return { status: "no-history", reason: "not-a-repo", points: [] };
  if (scope.size === 0) return { status: "no-history", reason: "too-little-history", points: [] };

  try {
    const pathspecs = [...scope.keys()].map((dir) => `specs/${dir}/tasks.md`);
    const log = git(root, ["log", "--relative", "--format=%H %ct", "--", ...pathspecs]);
    const commits: HistoryCommit[] = log
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const [sha, time] = l.split(" ");
        return { sha: sha ?? "", time: Number(time) };
      })
      .reverse(); // oldest first
    if (commits.length === 0) return buildBurndown("daily", [periodStart(now, "daily")], [], current, minPoints);

    const { period, starts } = choosePeriods(commits[0]!.time * 1000, now, maxPeriods);
    const samples = sampleCommits(commits, starts, period);
    const unique = [...new Set(samples.filter((c): c is HistoryCommit => c !== null).map((c) => c.sha))];
    const requests = unique.flatMap((sha) => pathspecs.map((p) => `${sha}:./${p}`));
    const blobs = requests.length
      ? parseCatFileBatch(gitWithInput(root, ["cat-file", "--batch"], requests.join("\n") + "\n"), requests.length)
      : [];

    const countsBySha = new Map<string, Counts>();
    unique.forEach((sha, i) => {
      const c: Counts = { total: 0, remaining: 0 };
      [...scope.values()].forEach((allowed, j) => {
        const body = blobs[i * pathspecs.length + j];
        if (body == null) return;
        const n = countTasks(parseTasks(body), allowed);
        c.total += n.total;
        c.remaining += n.remaining;
      });
      countsBySha.set(sha, c);
    });
    const sampled = samples.map((c) => (c ? (countsBySha.get(c.sha) ?? null) : null));
    return buildBurndown(period, starts, sampled, current, minPoints);
  } catch {
    return { status: "no-history", reason: "too-little-history", points: [] };
  }
}
