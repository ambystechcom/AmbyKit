import { readSpec, readTasks } from "../spec-format/dispatch.js";
import type { FeatureHistory, RevisionModel } from "./types.js";

/**
 * What the metrics learn from one historical revision, read through spec 030's per-file reader (026:D-9, 032:FR-019),
 * so a 1.x revision and a 2.x revision of the same file give the same answer. History is always readable: the reader
 * keeps reading 1.x whatever `LEGACY_READING` says, because an old revision is data, not a file this run would write
 * (035 decision D-2: history from before the migration is kept).
 */
const HISTORY_READING = "on" as const;

/** A task line that closes a requirement is a gap task appended by `/amby.converge` (`(closes FR-###)`). */
const GAP = /\(closes\s+(?:FR|SC)-\d+/i;
const REQUIREMENT = /^\s*[-*]\s+(?:\*\*)?FR-\d+/gm;

export type RevisionKind = "spec" | "tasks";

/** A revision with what was read from it. */
export interface Modelled {
  commit: string;
  time: number; // unix seconds
  model: RevisionModel;
}

/** A feature's history with every readable revision modelled, and the count of those skipped (FR-019). */
export interface ModelledHistory {
  feature: string;
  spec: Modelled[];
  plan: { commit: string; time: number }[];
  tasks: Modelled[];
  skipped: number;
}

export type Reader = (kind: RevisionKind, text: string, feature: string) => RevisionModel;

/** Read every revision of a feature through `read`; an unreadable one is skipped and counted, never fatal. */
export function modelHistory(h: FeatureHistory, read: Reader = readRevisionModel): ModelledHistory {
  let skipped = 0;
  const go = (kind: RevisionKind, revs: FeatureHistory["spec"]): Modelled[] =>
    revs.flatMap((r) => {
      const model = read(kind, r.text, h.feature);
      if (model.unreadable) {
        skipped++;
        return [];
      }
      return [{ commit: r.commit, time: r.time, model }];
    });
  return { feature: h.feature, spec: go("spec", h.spec), plan: h.plan, tasks: go("tasks", h.tasks), skipped };
}

export function readRevisionModel(kind: RevisionKind, text: string, feature = "feature"): RevisionModel {
  try {
    if (kind === "spec") {
      const spec = readSpec(feature, text, { legacyReading: HISTORY_READING });
      if (spec.issues.some((i) => i.severity === "error")) return { unreadable: true };
      return { status: spec.meta.status, requirements: (text.match(REQUIREMENT) ?? []).length };
    }
    const read = readTasks(text, { legacyReading: HISTORY_READING });
    if (read.issues.some((i) => i.severity === "error")) return { unreadable: true };
    const gap = read.tasks.filter((t) => GAP.test(t.description));
    return {
      tasks: { total: read.tasks.length, done: read.tasks.filter((t) => t.done).length },
      gap: { total: gap.length, done: gap.filter((t) => t.done).length },
    };
  } catch {
    return { unreadable: true };
  }
}
