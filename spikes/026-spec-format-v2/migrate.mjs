// Prototype `migrate` v1 -> v2 (T030, T031). Moves metadata, never rewrites prose.
//   node migrate.mjs <specsDir> [--dry-run] [--layout=phase|task] [--dual-write]
// Rules: idempotent (an already-v2 file is untouched), previewable (--dry-run writes nothing), safe (a file it
// cannot convert provably is left untouched and listed; every conversion is read back and must equal the v1 model).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dashboard, markers, listFeatures, readText, readV1, isMain } from "./model.mjs";
import { splitFrontmatter, isV2Spec, hasV2TaskData } from "./read-v2.mjs";
import { readFeature } from "./read.mjs";
import { diffModels } from "./compare.mjs";

const HEADING = /^#{2,4}\s+(US-?\d+)\s*[—–-]\s*(.+?)\s*$/;
const RE_STATUS = /\*\*status:\*\*\s*([a-z-]+)/i;
const RE_DEP = /\*\*depends-on:\*\*\s*(.+)$/i;
const RE_BLK = /\*\*blocked-by:\*\*\s*(.+)$/i;
const RE_PRI = /\*\*priority:\*\*\s*(P\d)/i;
const BULLET = /^\s*[-*]\s+\*\*(status|depends-on|blocked-by|priority):\*\*/i;
const TASK = /^\s*-\s*\[([ xX])\]\s*\[(T\d+)\]\s*(.*)$/;
const VERIFY = /^\s*(?:-\s*)?\*\*Verify:\*\*\s*(.*?)\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

const q = (s) => JSON.stringify(s);
const plain = (s) => (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(s) ? s : q(s));
const skip = (reason) => ({ status: "skipped", reason });

function eolOf(text) {
  const crlf = /\r\n/.test(text);
  const bare = /(^|[^\r])\n/.test(text);
  if (crlf && bare) return null;
  return crlf ? "\r\n" : "\n";
}

/** Lines inside a non-yaml code fence (tilde or backtick), as a set of 0-based indexes. */
function fencedLines(lines) {
  const set = new Set();
  let open = null;
  lines.forEach((l, i) => {
    const m = FENCE.exec(l);
    if (open) {
      set.add(i);
      if (m && m[1][0] === open[0] && m[1].length >= open.length && l.trim() === m[1]) open = null;
    } else if (m) {
      open = m[1];
      set.add(i);
    }
  });
  return set;
}

const rawList = (v) => v.replace(/^\s*\[|\]\s*$/g, "").split(",").map((s) => s.trim()).filter(Boolean);

// ── spec.md ─────────────────────────────────────────────────────────────────────────────────────

export function migrateSpec(text, feature, { dual = false } = {}) {
  if (text.charCodeAt(0) === 0xfeff) return skip("file starts with a byte-order mark");
  const eol = eolOf(text);
  if (!eol) return skip("mixed line endings (CRLF and LF)");
  if (isV2Spec(text)) return { status: "unchanged", reason: "already v2", text };
  const lines = text.split(/\r?\n/);
  let fm = splitFrontmatter(lines);
  if (fm?.error) return skip(`frontmatter: ${fm.error}`);
  const bodyStart = fm ? fm.end : 0; // 0-based index of the first body line
  if (fm && /^stories\s*:/m.test(fm.raw)) return skip("frontmatter has a `stories` key that is not a list; refusing to overwrite");

  const fenced = fencedLines(lines);
  const stories = [];
  const remove = new Set();
  let cur = null;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    const h = HEADING.exec(line);
    if (h) {
      if (fenced.has(i)) return skip(`story heading inside a code fence (line ${i + 1})`);
      let title = h[2].trim();
      const p = /\(priority:\s*(P\d)\)/i.exec(title);
      cur = { id: h[1], priority: p ? p[1].toUpperCase() : "", status: null, dep: null, blk: null, bulletPri: null, lines: [] };
      stories.push(cur);
      continue;
    }
    if (!cur) continue;
    const hit = [RE_STATUS, RE_DEP, RE_BLK, RE_PRI].some((r) => r.test(line));
    if (!hit) continue;
    if (fenced.has(i)) return skip(`story metadata inside a code fence (line ${i + 1})`);
    if (!BULLET.test(line)) return skip(`story metadata inside prose, not a bullet (line ${i + 1}): moving it would change the sentence`);
    const kind = BULLET.exec(line)[1].toLowerCase();
    const slot = { status: "status", "depends-on": "dep", "blocked-by": "blk", priority: "bulletPri" }[kind];
    // a line that carries several keys, or a key the v1 reader would not have read, is not a clean move
    const keys = [RE_STATUS, RE_DEP, RE_BLK, RE_PRI].filter((r) => r.test(line)).length;
    if (keys !== 1) return skip(`line ${i + 1} carries more than one metadata key`);
    if (cur[slot] !== null) return skip(`${cur.id} has two ${kind} bullets (line ${i + 1}); the v1 reader keeps the last, which a move would hide`);
    if (kind === "status") cur.status = RE_STATUS.exec(line)[1].toLowerCase();
    else if (kind === "depends-on") cur.dep = rawList(RE_DEP.exec(line)[1]);
    else if (kind === "blocked-by") cur.blk = rawList(RE_BLK.exec(line)[1]);
    else {
      const v = RE_PRI.exec(line)[1].toUpperCase();
      if (cur.priority && cur.priority !== v) return skip(`${cur.id}: heading priority ${cur.priority} conflicts with bullet ${v} (line ${i + 1})`);
      cur.bulletPri = v;
    }
    remove.add(i);
  }
  if (stories.length === 0) return { status: "unchanged", reason: "no stories", text };

  const y = ["stories:"];
  for (const s of stories) {
    y.push(`  - id: ${plain(s.id)}`);
    const pri = s.priority || s.bulletPri;
    if (pri) y.push(`    priority: ${pri}`);
    if (s.status) y.push(`    status: ${s.status}`);
    if (s.dep?.length) y.push(`    depends-on: [${s.dep.map(plain).join(", ")}]`);
    if (s.blk?.length) y.push(`    blocked-by: [${s.blk.map(plain).join(", ")}]`);
  }
  const head = fm ? lines.slice(0, fm.end - 1) : ["---", `feature: ${feature}`];
  const out = [...head, ...y, "---"];
  if (!fm) out.push("");
  let afterRun = false;
  for (let i = bodyStart; i < lines.length; i++) {
    if (!dual && remove.has(i)) {
      afterRun = true;
      continue;
    }
    // a removed run that sat between two blank lines would leave two in a row
    if (afterRun && lines[i].trim() === "" && out[out.length - 1].trim() === "") {
      afterRun = false;
      continue;
    }
    afterRun = false;
    out.push(lines[i]);
  }
  const next = out.join(eol);
  return verifySpec(feature, text, next, { addedFrontmatter: !fm });
}

function verifySpec(feature, before, after, extra) {
  const a = readV1(feature, before, null);
  const r = readFeature(feature, after, null);
  const strip = (m) => ({ ...m, tasks: [], phases: [], meta: extra.addedFrontmatter ? {} : m.meta });
  const d = diffModels(strip(a), strip(r.model));
  if (d.length || r.errors.length) return skip(`read-back check failed: ${d.map((x) => `${x.path} ${x.a}≠${x.b}`).concat(r.errors.map((e) => e.message)).join("; ")}`);
  return { status: after === before ? "unchanged" : "converted", text: after, ...extra };
}

// ── tasks.md ────────────────────────────────────────────────────────────────────────────────────

export function migrateTasks(text, feature, { layout = "phase", dual = false } = {}) {
  if (text.charCodeAt(0) === 0xfeff) return skip("file starts with a byte-order mark");
  const eol = eolOf(text);
  if (!eol) return skip("mixed line endings (CRLF and LF)");
  if (hasV2TaskData(text)) return { status: "unchanged", reason: "already v2", text };
  const lines = text.split(/\r?\n/);
  const fenced = fencedLines(lines);
  const phasesV1 = markers.parsePhases(text);

  // pass 1: structure, safety checks
  const phases = []; // {heading, start, end, tasks:[], verifyLine}
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const isHeading = /^##\s+/.test(l);
    const tm = TASK.exec(l);
    const isVerify = VERIFY.test(l);
    if (fenced.has(i)) {
      if (isHeading || tm || isVerify) return skip(`task, phase or Verify markup inside a code fence (line ${i + 1})`);
      continue;
    }
    if (isHeading) {
      cur = { start: i, end: lines.length, tasks: [], verify: [] };
      phases.push(cur);
      if (phases.length > 1) phases[phases.length - 2].end = i;
      continue;
    }
    if (!cur) continue;
    if (tm) {
      const rest = tm[3];
      const pm = markers.parseMarkers(rest);
      const own = dashboard.parseDeclaredPaths(pm.body);
      const extract = own.paths.length > 0 || own.pathIssue === "glob";
      const t = { i, id: tm[2], extract };
      if (extract) {
        const g = /\(([^()]*)\)\s*$/.exec(pm.body);
        t.items = g[1].split(",").map((x) => x.replace(/`/g, "").trim()).filter(Boolean);
        const prefix = l.slice(0, l.length - rest.length);
        const tail = pm.body === rest ? "" : rest.slice(pm.body.length).trimStart();
        t.stripped = prefix + pm.body.slice(0, g.index).trimEnd() + (tail ? ` ${tail}` : "");
      }
      cur.tasks.push(t);
    } else if (isVerify) cur.verify.push(i);
  }
  for (const [k, p] of phases.entries()) {
    if (p.verify.length > 1) return skip(`phase ${k + 1} has ${p.verify.length} Verify lines; migrating would have to pick one`);
    const ids = p.tasks.map((t) => t.id);
    if (new Set(ids).size !== ids.length) return skip(`phase ${k + 1} repeats a task id; ownership keyed by id would be ambiguous`);
  }

  // pass 2: emit
  const replace = new Map(); // line index -> replacement lines (array) ; null = delete
  const insertAfter = new Map(); // line index -> lines to add after it
  phases.forEach((p, k) => {
    const pv = phasesV1[k];
    const verifyLines = [];
    if (p.verify.length === 1 && pv?.check !== undefined) {
      verifyLines.push("verify:", `  check: ${q(pv.check)}`);
      if (pv.result) verifyLines.push(`  result: ${pv.result}`);
      if (pv.result === "failed") verifyLines.push(`  why: ${q(pv.why ?? "")}`);
    }
    const owned = p.tasks.filter((t) => t.extract);
    if (layout === "phase") {
      const body = [];
      if (owned.length) body.push("files:", ...owned.map((t) => `  ${t.id}: [${t.items.map(q).join(", ")}]`));
      body.push(...verifyLines);
      if (!body.length) return;
      const block = ["```yaml", ...body, "```"];
      if (p.verify.length === 1) {
        if (dual) insertAfter.set(p.verify[0], block);
        else replace.set(p.verify[0], block);
      } else {
        let last = p.end - 1;
        while (last > p.start && lines[last].trim() === "") last--;
        insertAfter.set(last, ["", ...block]);
      }
      if (!dual) for (const t of owned) replace.set(t.i, [t.stripped]);
    } else {
      for (const t of owned) {
        const indent = (/^\s*/.exec(lines[t.i])[0]) + "  ";
        replace.set(t.i, [dual ? lines[t.i] : t.stripped, `${indent}\`\`\`yaml`, `${indent}files: [${t.items.map(q).join(", ")}]`, `${indent}\`\`\``]);
      }
      if (verifyLines.length) {
        const block = ["```yaml", ...verifyLines, "```"];
        if (dual) insertAfter.set(p.verify[0], block);
        else replace.set(p.verify[0], block);
      }
    }
  });
  if (replace.size === 0 && insertAfter.size === 0) return { status: "unchanged", reason: "nothing to convert", text };
  const out = [];
  lines.forEach((l, i) => {
    if (replace.has(i)) out.push(...replace.get(i));
    else out.push(l);
    if (insertAfter.has(i)) out.push(...insertAfter.get(i));
  });
  const next = out.join(eol);
  const a = readV1(feature, null, text);
  const r = readFeature(feature, null, next);
  const d = diffModels({ ...a, stories: [] }, { ...r.model, stories: [] });
  if (d.length || r.errors.length) {
    return skip(`read-back check failed: ${d.map((x) => `${x.path} ${x.a}≠${x.b}`).concat(r.errors.map((e) => `${e.file}:${e.line} ${e.message}`)).join("; ")}`);
  }
  return { status: "converted", text: next };
}

// ── tree ────────────────────────────────────────────────────────────────────────────────────────

function lineDelta(a, b) {
  const count = (arr) => arr.reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map());
  const ma = count(a.split(/\r?\n/)), mb = count(b.split(/\r?\n/));
  let add = 0, del = 0;
  for (const [l, n] of mb) add += Math.max(0, n - (ma.get(l) ?? 0));
  for (const [l, n] of ma) del += Math.max(0, n - (mb.get(l) ?? 0));
  return { add, del };
}

/** Migrate every feature under `root` (a specs directory). Returns one record per file. */
export function migrateTree(root, { dryRun = false, layout = "phase", dual = false } = {}) {
  const records = [];
  for (const f of listFeatures(root)) {
    const dir = join(root, f);
    for (const [file, fn] of [["spec.md", migrateSpec], ["tasks.md", migrateTasks]]) {
      const text = readText(dir, file);
      if (text == null) continue;
      const r = file === "spec.md" ? fn(text, f, { dual }) : fn(text, f, { layout, dual });
      const rec = { feature: f, file, status: r.status, reason: r.reason };
      if (r.status === "converted") {
        Object.assign(rec, lineDelta(text, r.text));
        if (r.addedFrontmatter) rec.note = "added minimal frontmatter";
        if (!dryRun) writeFileSync(join(dir, file), r.text);
      }
      records.push(rec);
    }
  }
  return records;
}

export function summarize(records) {
  const by = (s) => records.filter((r) => r.status === s);
  const lines = [];
  for (const r of by("converted")) lines.push(`  converted  ${r.feature}/${r.file}  +${r.add} -${r.del}${r.note ? `  (${r.note})` : ""}`);
  for (const r of by("skipped")) lines.push(`  SKIPPED    ${r.feature}/${r.file}  untouched: ${r.reason}`);
  lines.push(`  ${by("converted").length} converted, ${by("unchanged").length} unchanged, ${by("skipped").length} skipped (left untouched)`);
  return lines.join("\n");
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) {
    console.error("usage: node migrate.mjs <specsDir> [--dry-run] [--layout=phase|task] [--dual-write]");
    process.exit(2);
  }
  const layout = (args.find((a) => a.startsWith("--layout=")) ?? "--layout=phase").split("=")[1];
  const opts = { dryRun: args.includes("--dry-run"), layout, dual: args.includes("--dual-write") };
  console.log(`${opts.dryRun ? "DRY RUN (nothing is written)" : "migrating"}: ${dir} layout=${layout}${opts.dual ? " dual-write" : ""}`);
  console.log(summarize(migrateTree(dir, opts)));
}
