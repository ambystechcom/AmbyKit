// `migrate` (030:FR-005, FR-007, FR-009, FR-010, FR-011, FR-014, FR-024): convert 1.x spec.md and tasks.md files of the
// current checkout to v2, safely. For each file: skip it if it is already v2 or not provably safe; convert it; read the
// result back and skip it if the meaning differs from the 1.x reading; then, unless `--dry-run`, compare the file's content
// with what was read (skip if someone edited it meanwhile) and write it once, complete or not at all: to a temp file in the
// same directory, then rename over the original. A rerun skips converted files, so migrate is idempotent and resumable.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { planConfigUpgrade, type ConfigPlan } from "../config-schema.js";
import { featureRefOf } from "../dashboard.js";
import { detectSpecFormat, detectTasksFormat } from "../spec-format/detect.js";
import { convertSpec } from "./convert-spec.js";
import { convertTasks } from "./convert-tasks.js";
import { hashText, scanSpec, scanTasks, specReadBack, tasksReadBack } from "./safety.js";
import { lineDelta, summarize, type MigrateRecord } from "./summary.js";

export interface MigrateOptions {
  /** Write nothing; report what would change (FR-007). */
  dryRun?: boolean;
  /** Keep the 1.x lines beside the v2 data (FR-023). */
  dualWrite?: boolean;
  /** One feature, by number or directory name. */
  feature?: string;
  /** Test seams: replace the filesystem calls that can fail, and run code between the read and the write. */
  ops?: {
    rename?: (from: string, to: string) => void;
    write?: (file: string, text: string) => void;
  };
  hooks?: { beforeWrite?: (file: string) => void };
}

export interface MigrateResult {
  records: MigrateRecord[];
  config: { plan: ConfigPlan; written: boolean };
  /** Project-relative files with uncommitted changes that migrate converted (FR-011): a warning, not a refusal. */
  dirty: string[];
  counts: { converted: number; unchanged: number; skipped: number };
  /** The text migrate prints. */
  summary: string;
}

const TMP = ".migrate-tmp";

function featuresOf(root: string, only?: string): string[] {
  const specs = join(root, "specs");
  if (!existsSync(specs)) return [];
  return readdirSync(specs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && (existsSync(join(specs, e.name, "spec.md")) || existsSync(join(specs, e.name, "tasks.md"))))
    .map((e) => e.name)
    .filter((name) => {
      if (!only) return true;
      return name === only || featureRefOf(name) === only || (/^\d+$/.test(only) && Number(featureRefOf(name)) === Number(only));
    })
    .sort();
}

/** Files under `paths` with uncommitted changes, via `git status`; empty when this is not a git checkout. */
function dirtyFiles(root: string, paths: string[]): string[] {
  if (paths.length === 0) return [];
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--", ...paths], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out
      .split(/\r?\n/)
      .filter((l) => l.length > 3)
      .map((l) => l.slice(3).replace(/^"|"$/g, "").replace(/\\/g, "/"));
  } catch {
    return [];
  }
}

function writeOnce(file: string, text: string, opts: MigrateOptions): void {
  const tmp = file + TMP;
  const write = opts.ops?.write ?? ((f: string, t: string) => writeFileSync(f, t, "utf8"));
  const rename = opts.ops?.rename ?? ((a: string, b: string) => renameSync(a, b));
  try {
    write(tmp, text);
    rename(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

/** Migrate the project at `root`. Never touches another checkout or worktree, and never a file that is not provably safe. */
export function migrateProject(root: string, opts: MigrateOptions = {}): MigrateResult {
  const records: MigrateRecord[] = [];
  const toWrite: { file: string; abs: string; before: string; hash: string; after: string; rec: MigrateRecord }[] = [];

  for (const feature of featuresOf(root, opts.feature)) {
    for (const file of ["spec.md", "tasks.md"] as const) {
      const abs = join(root, "specs", feature, file);
      if (!existsSync(abs)) continue;
      const before = readFileSync(abs, "utf8");
      const rec: MigrateRecord = { feature, file, status: "unchanged" };
      records.push(rec);

      const detected = file === "spec.md" ? detectSpecFormat(before) : detectTasksFormat(before);
      if (detected.format === 2) {
        rec.reason = "already v2";
        continue;
      }
      const unsafe = file === "spec.md" ? scanSpec(before) : scanTasks(before);
      if (unsafe) {
        rec.status = "skipped";
        rec.reason = unsafe.reason;
        rec.fix = unsafe.fix;
        continue;
      }
      const notes: string[] = [];
      let after: string;
      if (file === "spec.md") {
        const c = convertSpec(before, feature, { dualWrite: opts.dualWrite === true });
        if (c.status === "unchanged") {
          rec.reason = c.reason ?? "nothing to convert";
          continue;
        }
        after = c.text;
        if (c.addedFrontmatter) notes.push("added minimal frontmatter");
        if (c.strippedHeadings.length > 0) notes.push(`stripped ${c.strippedHeadings.length} (priority: Pn) annotation${c.strippedHeadings.length === 1 ? "" : "s"} from headings`);
      } else {
        const c = convertTasks(before, { dualWrite: opts.dualWrite === true });
        if (c.status === "unchanged") {
          rec.reason = c.reason ?? "nothing to convert";
          continue;
        }
        after = c.text;
        if (c.addedFrontmatter) notes.push("added minimal frontmatter");
        if (c.filesMoved > 0) notes.push(`${c.filesMoved} ownership group${c.filesMoved === 1 ? "" : "s"} moved`);
        if (c.verifyMoved > 0) notes.push(`${c.verifyMoved} Verify line${c.verifyMoved === 1 ? "" : "s"} moved`);
      }
      if (opts.dualWrite) notes.push("transitional: 1.x lines kept beside the v2 data");

      const diffs = file === "spec.md" ? specReadBack(feature, before, after) : tasksReadBack(before, after);
      if (diffs.length > 0) {
        rec.status = "skipped";
        rec.reason = `read-back check failed: ${diffs.join("; ")}`;
        rec.fix = "report this file; it was left untouched";
        continue;
      }
      const { add, del } = lineDelta(before, after);
      rec.status = "converted";
      rec.add = add;
      rec.del = del;
      rec.notes = notes;
      rec.before = before;
      rec.after = after;
      toWrite.push({ file: `specs/${feature}/${file}`, abs, before, hash: hashText(before), after, rec });
    }
  }

  const dirty = opts.dryRun ? [] : dirtyFiles(root, toWrite.map((w) => w.file));

  if (!opts.dryRun) {
    for (const w of toWrite) {
      try {
        opts.hooks?.beforeWrite?.(w.abs);
        const now = readFileSync(w.abs, "utf8");
        if (hashText(now) !== w.hash) {
          w.rec.status = "skipped";
          w.rec.reason = "the file was edited while migrate was running";
          w.rec.fix = "run migrate again";
          delete w.rec.add;
          delete w.rec.del;
          delete w.rec.notes;
          continue;
        }
        writeOnce(w.abs, w.after, opts);
      } catch (e) {
        w.rec.status = "skipped";
        w.rec.reason = `could not write the file (${(e as Error).message.split("\n")[0]}); it was left untouched`;
        w.rec.fix = "check permissions and run migrate again";
        delete w.rec.add;
        delete w.rec.del;
        delete w.rec.notes;
      }
    }
  }

  // FR-014: the config gets its schema version only when migrate runs, with every setting preserved.
  const configFile = join(root, ".amby", "config.json");
  const configText = existsSync(configFile) ? readFileSync(configFile, "utf8") : null;
  const plan = planConfigUpgrade(configText, ".amby/config.json");
  let written = false;
  if (plan.action === "write" && !opts.dryRun) {
    try {
      writeOnce(configFile, plan.text, opts);
      written = true;
    } catch {
      written = false;
    }
  }

  const counts = {
    converted: records.filter((r) => r.status === "converted").length,
    unchanged: records.filter((r) => r.status === "unchanged").length,
    skipped: records.filter((r) => r.status === "skipped").length,
  };
  return { records, config: { plan, written }, dirty, counts, summary: summarize(records, { dryRun: opts.dryRun === true }) };
}
