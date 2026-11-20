// v2 spec reader (030:FR-001, FR-003, FR-004, FR-019). Story metadata lives in frontmatter `stories:`; headings keep titles.
// Errors carry file:line and are never guessed around; warnings flag drift and legacy leftovers. The result is the same
// `StoryProgress` the 1.x parser returns, so nothing downstream changes shape (026:D-1).
import { canonicalStoryId, parseStories, type StoryProgress } from "../dashboard.js";
import { readFrontmatter } from "./frontmatter.js";
import { readSpecMeta } from "./meta.js";
import type { FormatIssue, SpecRead } from "./model.js";

/** The five canonical statuses. Any other string is read as written, with a warning (026 "What 027 may assume"). */
export const KNOWN_STATUSES = ["draft", "ready", "in-progress", "blocked", "done"] as const;
const KNOWN = new Set<string>(KNOWN_STATUSES);
const STORY_KEYS = new Set(["id", "priority", "status", "depends-on", "blocked-by"]);

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Entry {
  [key: string]: unknown;
  id: string;
}

export function readSpecV2(feature: string, text: string, file: string, marker: boolean): SpecRead {
  const issues: FormatIssue[] = [];
  const warn = (line: number, kind: string, message: string): void => void issues.push({ file, line, severity: "warning", kind, message });
  const err = (line: number, kind: string, message: string): void => void issues.push({ file, line, severity: "error", kind, message });

  const fm = readFrontmatter(text, file, issues);
  const lines = fm.lines;
  // headings (and any leftover 1.x bullets of a dual-written file) via the shipped parser
  const heads = parseStories(text, feature);

  if (!marker) warn(1, "missing-format-marker", "story data found without `format: 2` in the frontmatter; read as format 2 (add the marker)");

  const lineOfEntry = (id: string): number => {
    if (!fm.present) return 1;
    const re = new RegExp(`^\\s*-?\\s*id:\\s*["']?${esc(id)}["']?\\s*$`);
    const i = lines.findIndex((l, k) => k >= fm.start - 1 && k < fm.end && re.test(l));
    return i === -1 ? fm.start : i + 1;
  };

  const entries = new Map<string, Entry>();
  const list = Array.isArray(fm.data["stories"]) ? (fm.data["stories"] as unknown[]) : [];
  list.forEach((raw, i) => {
    const e = raw as Record<string, unknown> | null;
    if (!e || typeof e !== "object" || typeof e["id"] !== "string" || !/^US-?\d+$/i.test(e["id"])) {
      err(fm.start || 1, "bad-story-entry", `stories[${i}]: needs an \`id\` like US-1`);
      return;
    }
    const id = e["id"];
    const key = canonicalStoryId(id);
    if (entries.has(key)) err(lineOfEntry(id), "duplicate-story", `duplicate story id ${id} in frontmatter`);
    for (const k of ["depends-on", "blocked-by"]) {
      if (e[k] !== undefined && !Array.isArray(e[k])) err(lineOfEntry(id), "not-a-list", `${id}: \`${k}\` must be a list`);
    }
    for (const k of Object.keys(e)) {
      if (!STORY_KEYS.has(k)) warn(lineOfEntry(id), "unknown-key", `${id}: unknown key \`${k}\` ignored`);
    }
    if (e["status"] !== undefined && !KNOWN.has(String(e["status"]).toLowerCase())) {
      warn(lineOfEntry(id), "unknown-status", `${id}: status \`${String(e["status"])}\` is not one of ${KNOWN_STATUSES.join("|")}`);
    }
    entries.set(key, e as Entry);
  });

  const stories: StoryProgress[] = heads.map((head) => {
    const e = entries.get(head.id);
    const headRe = new RegExp(`^#{2,4}\\s+${esc(head.displayId)}\\b`);
    const headLine = lines.findIndex((l) => headRe.test(l)) + 1;
    if (!e) {
      const hasBullets = head.status !== "" || head.dependsOn.length > 0 || head.blockedBy.length > 0;
      warn(
        headLine || 1,
        "story-not-in-frontmatter",
        hasBullets
          ? `${head.displayId} is not in frontmatter stories; read from its 1.x bullets`
          : `${head.displayId} has no metadata in frontmatter stories`,
      );
      return head;
    }
    entries.delete(head.id);
    const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => canonicalStoryId(String(x))) : []);
    const fmStatus = e["status"] === undefined ? "" : String(e["status"]).toLowerCase();
    const fmDeps = asList(e["depends-on"]);
    const fmBlk = asList(e["blocked-by"]);
    const fmPri = e["priority"] === undefined ? head.priority : String(e["priority"]).toUpperCase();
    // dual-write and stale headings: leftover 1.x data that disagrees with the frontmatter (frontmatter wins)
    const drift: string[] = [];
    if (head.status && head.status !== fmStatus) drift.push(`status ${head.status} vs ${fmStatus}`);
    if (head.dependsOn.length && head.dependsOn.join() !== fmDeps.join()) drift.push("depends-on");
    if (head.blockedBy.length && head.blockedBy.join() !== fmBlk.join()) drift.push("blocked-by");
    if (e["priority"] !== undefined && head.priority && head.priority !== fmPri) drift.push(`priority ${head.priority} vs ${fmPri}`);
    if (drift.length) warn(headLine || 1, "v1-data-disagrees", `${head.displayId}: 1.x data disagrees with frontmatter (${drift.join(", ")}); frontmatter wins`);
    return { ...head, priority: fmPri, status: fmStatus, dependsOn: fmDeps, blockedBy: fmBlk };
  });
  for (const e of entries.values()) {
    err(lineOfEntry(e.id), "story-without-heading", `frontmatter story ${e.id} has no heading in the body`);
  }

  // feature-level depends-on: a list of feature numbers or directory names, as written
  let dependsOn: string[] = [];
  const raw = fm.data["depends-on"];
  if (raw !== undefined) {
    if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string" && typeof x !== "number")) {
      const at = lines.findIndex((l, k) => k >= fm.start - 1 && k < fm.end && /^depends-on\s*:/.test(l));
      err(at === -1 ? fm.start : at + 1, "not-a-list", "feature-level `depends-on` must be a list of feature numbers or names");
    } else {
      dependsOn = raw.map((x) => String(x));
    }
  }

  return { format: 2, stories, meta: readSpecMeta(text), dependsOn, issues };
}
