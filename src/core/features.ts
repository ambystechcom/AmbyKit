import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { findClarifications } from "./clarifications.js";
import { applyTasks, featureRefOf, parseStories, parseTasks, type TaskLine } from "./dashboard.js";
import type { FeatureSnapshot, ParseIssue } from "./overview-types.js";

export interface ReadFeaturesResult {
  features: FeatureSnapshot[];
  issues: ParseIssue[];
}

/**
 * Read every `specs/NNN-slug/` that has a `spec.md` into a `FeatureSnapshot` (feature 014). The only
 * filesystem edge of the overview; everything downstream is pure. A file that cannot be read or
 * parsed becomes a `ParseIssue` and is skipped, so the rest still renders (FR-014). Features are
 * ordered by number, then directory name (I-3).
 */
export function readFeatures(projectRoot: string, opts: { only?: string } = {}): ReadFeaturesResult {
  const specsRoot = join(projectRoot, "specs");
  const issues: ParseIssue[] = [];
  if (!existsSync(specsRoot)) return { features: [], issues };

  const dirs = readdirSync(specsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && (!opts.only || e.name === opts.only) && existsSync(join(specsRoot, e.name, "spec.md")))
    .map((e) => e.name)
    .sort(compareFeatureDirs);

  const features: FeatureSnapshot[] = [];
  for (const dir of dirs) {
    const rel = (file: string): string => `specs/${dir}/${file}`;
    const read = (file: string): string | null => {
      try {
        return readFileSync(join(specsRoot, dir, file), "utf8");
      } catch (err) {
        issues.push({ file: rel(file), reason: reasonOf(err) });
        return null;
      }
    };

    const spec = read("spec.md");
    if (spec === null) continue;
    const stories = parseStories(spec, dir);

    let tasks: TaskLine[] | null = null;
    if (existsSync(join(specsRoot, dir, "tasks.md"))) {
      const body = read("tasks.md");
      if (body !== null) tasks = parseTasks(body);
    }
    applyTasks(stories, tasks ?? []);

    const hasUi = existsSync(join(specsRoot, dir, "ui.md"));
    let uiSignedOff = false;
    if (hasUi) {
      const ui = read("ui.md");
      if (ui !== null) {
        try {
          uiSignedOff = matter(ui).data["signed_off"] === true;
        } catch (err) {
          issues.push({ file: rel("ui.md"), reason: reasonOf(err) });
        }
      }
    }

    const ref = featureRefOf(dir);
    features.push({
      dir,
      ref,
      displayRef: ref,
      stories,
      tasks,
      artifacts: {
        spec: true,
        ui: hasUi,
        uiSignedOff,
        plan: existsSync(join(specsRoot, dir, "plan.md")),
        tasks: tasks !== null,
      },
      clarifications: findClarifications(spec),
    });
  }

  assignDisplayRefs(features);
  return { features, issues };
}

/** Feature numbers can collide (two `008-*`); fall back to the directory name so refs stay unique (I-5). */
export function assignDisplayRefs(features: FeatureSnapshot[]): void {
  const seen = new Map<string, number>();
  for (const f of features) seen.set(f.ref, (seen.get(f.ref) ?? 0) + 1);
  for (const f of features) f.displayRef = (seen.get(f.ref) ?? 0) > 1 ? f.dir : f.ref;
}

/** Order by leading number (numerically), then by full directory name. */
export function compareFeatureDirs(a: string, b: string): number {
  const na = Number(/^(\d+)/.exec(a)?.[1] ?? Number.POSITIVE_INFINITY);
  const nb = Number(/^(\d+)/.exec(b)?.[1] ?? Number.POSITIVE_INFINITY);
  if (na !== nb) return na < nb ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function reasonOf(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e.code === "EISDIR") return "is a directory, not a file";
  return (e.message ?? String(err)).split("\n")[0] ?? "unreadable";
}
