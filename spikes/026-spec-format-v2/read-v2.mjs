// v2 reader (T020). Frontmatter via gray-matter's YAML engine; fenced yaml blocks only for per-task data.
// Errors carry file:line and are never guessed around; warnings flag drift and legacy leftovers.
import { dashboard, markers, yaml, storyOut, taskOut, phaseOut, metaOf, stripOwnerGroup } from "./model.mjs";

const STATUSES = new Set(["draft", "ready", "in-progress", "blocked", "done"]);
const canon = dashboard.canonicalStoryId;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const FENCE_OPEN = /^(\s*)(`{3,})\s*yaml\s*$/;
const FENCE_CLOSE = /^\s*(`{3,})\s*$/;

/** Split `---` frontmatter: {raw, start (1-based first yaml line), end (1-based closing line)} or null. */
export function splitFrontmatter(lines) {
  if (lines[0] !== "---") return null;
  const end = lines.indexOf("---", 1);
  if (end === -1) return { error: "frontmatter is not closed with ---", line: 1 };
  return { raw: lines.slice(1, end).join("\n"), start: 2, end: end + 1 };
}

function parseYaml(src, baseLine, where, errors, file) {
  try {
    return yaml.parse(src);
  } catch (e) {
    const mark = e.mark?.line;
    errors.push({
      file,
      line: baseLine + (typeof mark === "number" ? mark : 0),
      message: `${where}: invalid YAML (${String(e.reason ?? e.message).split("\n")[0]})`,
    });
    return undefined;
  }
}

export function frontmatterOf(text, errors, file = "spec.md") {
  const lines = text.split(/\r?\n/);
  const fm = splitFrontmatter(lines);
  if (!fm) return { data: {}, lines, fm: null };
  if (fm.error) {
    errors.push({ file, line: fm.line, message: fm.error });
    return { data: {}, lines, fm: null };
  }
  const data = parseYaml(fm.raw, fm.start, "frontmatter", errors, file);
  return { data: data && typeof data === "object" ? data : {}, lines, fm };
}

export function isV2Spec(text) {
  const errs = [];
  const { data, fm } = frontmatterOf(text, errs);
  if (Array.isArray(data.stories)) return true;
  // broken frontmatter that still declares `stories:` is v2 intent: surface its error instead of falling back to v1
  return errs.length > 0 && !!fm && /^stories\s*:/m.test(fm.raw);
}

export function readSpecV2(feature, text, errors, warnings, file = "spec.md") {
  const { data, lines, fm } = frontmatterOf(text, errors, file);
  const heads = dashboard.parseStories(text, feature); // headings (+ dual-write leftover bullets) via shipped code
  const entries = new Map();
  const lineOfEntry = (id) => {
    if (!fm) return 1;
    const re = new RegExp(`^\\s*-?\\s*id:\\s*["']?${esc(id)}["']?\\s*$`);
    const i = lines.findIndex((l, k) => k >= fm.start - 1 && k < fm.end && re.test(l));
    return i === -1 ? fm.start : i + 1;
  };
  const list = Array.isArray(data.stories) ? data.stories : [];
  list.forEach((e, i) => {
    if (!e || typeof e !== "object" || typeof e.id !== "string" || !/^US-?\d+$/i.test(e.id)) {
      errors.push({ file, line: fm ? fm.start : 1, message: `stories[${i}]: needs an \`id\` like US-1` });
      return;
    }
    const key = canon(e.id);
    if (entries.has(key)) errors.push({ file, line: lineOfEntry(e.id), message: `duplicate story id ${e.id} in frontmatter` });
    for (const k of ["depends-on", "blocked-by"]) {
      if (e[k] !== undefined && !Array.isArray(e[k])) errors.push({ file, line: lineOfEntry(e.id), message: `${e.id}: \`${k}\` must be a list` });
    }
    for (const k of Object.keys(e)) {
      if (!["id", "priority", "status", "depends-on", "blocked-by"].includes(k)) {
        warnings.push({ file, line: lineOfEntry(e.id), message: `${e.id}: unknown key \`${k}\` ignored` });
      }
    }
    if (e.status !== undefined && !STATUSES.has(String(e.status).toLowerCase())) {
      warnings.push({ file, line: lineOfEntry(e.id), message: `${e.id}: status \`${e.status}\` is not one of ${[...STATUSES].join("|")}` });
    }
    entries.set(key, e);
  });
  const stories = heads.map((s) => {
    const e = entries.get(s.id);
    const out = storyOut(s);
    const headRe = new RegExp(`^#{2,4}\\s+${esc(s.displayId)}\\b`);
    const headLine = lines.findIndex((l) => headRe.test(l)) + 1;
    if (!e) {
      const hasBullets = out.status || out.dependsOn.length || out.blockedBy.length;
      warnings.push({
        file,
        line: headLine,
        message: hasBullets ? `${s.displayId} is not in frontmatter stories; read from its v1 bullets` : `${s.displayId} has no metadata in frontmatter stories`,
      });
      return out;
    }
    entries.delete(s.id);
    const fmStatus = e.status === undefined ? "" : String(e.status).toLowerCase();
    const fmDeps = (Array.isArray(e["depends-on"]) ? e["depends-on"] : []).map((x) => canon(String(x)));
    const fmBlk = (Array.isArray(e["blocked-by"]) ? e["blocked-by"] : []).map((x) => canon(String(x)));
    const fmPri = e.priority === undefined ? out.priority : String(e.priority).toUpperCase();
    const drift = []; // dual-write: leftover bullets that disagree with the frontmatter (frontmatter wins)
    if (out.status && out.status !== fmStatus) drift.push(`status ${out.status} vs ${fmStatus}`);
    if (out.dependsOn.length && out.dependsOn.join() !== fmDeps.join()) drift.push("depends-on");
    if (out.blockedBy.length && out.blockedBy.join() !== fmBlk.join()) drift.push("blocked-by");
    if (e.priority !== undefined && out.priority && out.priority !== fmPri) drift.push(`priority ${out.priority} vs ${fmPri}`);
    if (drift.length) warnings.push({ file, line: headLine, message: `${s.displayId}: v1 data disagrees with frontmatter (${drift.join(", ")}); frontmatter wins` });
    return { ...out, priority: fmPri, status: fmStatus, dependsOn: fmDeps, blockedBy: fmBlk };
  });
  for (const e of entries.values()) {
    errors.push({ file, line: lineOfEntry(e.id), message: `frontmatter story ${e.id} has no heading in the body` });
  }
  return { meta: metaOf(text), stories };
}

/** All fenced yaml blocks in a tasks.md, with their phase ordinal and the task line they follow. */
export function scanBlocks(text) {
  const lines = text.split(/\r?\n/);
  const taskRe = /^\s*-\s*\[([ xX])\]\s*\[(T\d+)\]/;
  const blocks = [];
  let ordinal = 0;
  let lastTask = null;
  let sinceTask = 0; // non-blank, non-block lines since the last task line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      ordinal += 1;
      lastTask = null;
      continue;
    }
    const o = FENCE_OPEN.exec(line);
    if (o) {
      let j = i + 1;
      while (j < lines.length) {
        const c = FENCE_CLOSE.exec(lines[j]);
        if (c && c[1].length >= o[2].length) break;
        j++;
      }
      const body = lines.slice(i + 1, j).map((l) => (l.startsWith(o[1]) ? l.slice(o[1].length) : l));
      const src = body.join("\n");
      blocks.push({
        start: i + 1,
        end: j + 1,
        indent: o[1],
        src,
        ours: /^(files|verify):/m.test(src),
        ordinal,
        followsTask: lastTask && sinceTask === 0 ? lastTask : null,
        unclosed: j >= lines.length,
      });
      i = j;
      continue;
    }
    const t = taskRe.exec(line);
    if (t) {
      lastTask = t[2];
      sinceTask = 0;
      continue;
    }
    if (line.trim() !== "") sinceTask += 1;
  }
  return { lines, blocks };
}

export function hasV2TaskData(text) {
  return scanBlocks(text).blocks.some((b) => b.ours);
}

export function readTasksV2(text, errors, warnings, file = "tasks.md") {
  const parsed = dashboard.parseTasks(text);
  const phases = markers.parsePhases(text);
  const tasks = parsed.map((t) => ({ raw: t, out: taskOut(t) }));
  const byId = new Map();
  for (const t of tasks) {
    if (!byId.has(t.raw.id)) byId.set(t.raw.id, []);
    byId.get(t.raw.id).push(t);
  }
  const { blocks } = scanBlocks(text);
  const filesSeen = new Set();
  const verifySeen = new Set();
  const applyFiles = (t, items, line) => {
    if (!Array.isArray(items) || items.some((x) => typeof x !== "string")) {
      errors.push({ file, line, message: `${t.raw.id}: files must be a list of strings` });
      return;
    }
    const { paths, pathIssue } = dashboard.parseDeclaredPaths(`(${items.join(", ")})`);
    const same = t.out.paths.join() === paths.join() && t.raw.pathIssue === pathIssue;
    if (t.out.paths.length && !same) {
      warnings.push({ file, line, message: `${t.raw.id}: trailing group on the line disagrees with the block; block wins` });
    }
    t.out.paths = paths;
    if (pathIssue) t.out.pathIssue = pathIssue;
    else delete t.out.pathIssue;
    // dual-write: the line still carries the same group, so it is not prose; otherwise the line is prose as written
    t.out.description = same ? stripOwnerGroup(t.raw.description, { paths, pathIssue }) : t.raw.description;
  };
  for (const b of blocks) {
    if (!b.ours) continue; // foreign yaml (documentation examples) is ignored
    if (b.unclosed) {
      errors.push({ file, line: b.start, message: "fenced yaml block is not closed" });
      continue;
    }
    const data = parseYaml(b.src, b.start + 1, "tasks block", errors, file);
    if (data === undefined) continue;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      errors.push({ file, line: b.start, message: "block must be a mapping with files and/or verify" });
      continue;
    }
    for (const k of Object.keys(data)) {
      if (!["files", "verify"].includes(k)) errors.push({ file, line: b.start, message: `unknown key \`${k}\` in tasks block (allowed: files, verify)` });
    }
    const ph = phases[b.ordinal - 1];
    if (data.files !== undefined) {
      if (Array.isArray(data.files)) {
        // task-scoped block: files only, attached to the task line it directly follows
        if ("verify" in data) errors.push({ file, line: b.start, message: "a task block carries files only; verify belongs to the phase block" });
        const cands = b.followsTask ? byId.get(b.followsTask) ?? [] : [];
        const t = cands.find((c) => c.raw.phase === ph?.phase) ?? cands[cands.length - 1];
        if (!t) errors.push({ file, line: b.start, message: "a task block must directly follow a task line" });
        else applyFiles(t, data.files, b.start);
      } else if (data.files && typeof data.files === "object") {
        // phase-scoped block: files maps T-id to a list
        for (const [id, items] of Object.entries(data.files)) {
          const inPhase = (byId.get(id) ?? []).filter((c) => c.raw.phase === ph?.phase);
          if (inPhase.length === 0) {
            errors.push({ file, line: b.start, message: `files lists ${id}, which is not a task of this phase` });
            continue;
          }
          if (inPhase.length > 1) {
            errors.push({ file, line: b.start, message: `${id} is ambiguous: defined ${inPhase.length} times in this phase` });
            continue;
          }
          applyFiles(inPhase[0], items, b.start);
        }
        if (filesSeen.has(b.ordinal)) warnings.push({ file, line: b.start, message: "second ownership block in one phase" });
        filesSeen.add(b.ordinal);
      } else {
        errors.push({ file, line: b.start, message: "`files` must be a mapping (phase block) or a list (task block)" });
      }
    }
    if (data.verify !== undefined) {
      const v = data.verify;
      if (!ph) {
        errors.push({ file, line: b.start, message: "verify block outside any phase" });
        continue;
      }
      if (!v || typeof v !== "object" || typeof v.check !== "string") {
        errors.push({ file, line: b.start, message: "verify needs a `check` string" });
        continue;
      }
      if (v.result !== undefined && !["passed", "failed", "unverified"].includes(v.result)) {
        errors.push({ file, line: b.start, message: `verify.result must be passed|failed|unverified, got ${JSON.stringify(v.result)}` });
        continue;
      }
      if (verifySeen.has(b.ordinal)) {
        errors.push({ file, line: b.start, message: "more than one verify block in a phase" });
        continue;
      }
      verifySeen.add(b.ordinal);
      if (ph.check !== undefined && (ph.check !== v.check || ph.result !== v.result)) {
        warnings.push({ file, line: b.start, message: `phase ${ph.phase}: the Verify line disagrees with the block; block wins` });
      }
      ph.check = v.check;
      if (v.result !== undefined) ph.result = v.result;
      else delete ph.result;
      if (v.result === "failed") ph.why = String(v.why ?? "");
      else delete ph.why;
    }
  }
  return { tasks: tasks.map((t) => t.out), phases: phases.map(phaseOut) };
}
