// The one model every reader returns (030, 026:D-1). It is the model the shipped 1.x parsers already produce, so nothing
// downstream (dashboard, analyze, lanes, graph, trace, MCP) changes shape: the v2 readers fill the same types.
export type { StoryProgress, TaskLine } from "../dashboard.js";
export type { PhaseVerify, VerifyResult } from "../markers.js";

import type { PhaseVerify } from "../markers.js";
import type { StoryProgress, TaskLine } from "../dashboard.js";

/** Spec format of one file: 1 = the 1.x bullets and trailing groups, 2 = frontmatter and yaml blocks. */
export type Format = 1 | 2;

/** A located problem in structured data. Errors never guess; warnings flag drift and legacy leftovers. */
export interface FormatIssue {
  /** Project-relative when known (`specs/030-x/tasks.md`), else the bare file name. */
  file: string;
  /** 1-based line in that file (1 when unknown). */
  line: number;
  severity: "error" | "warning";
  /** Stable machine kind, e.g. `bad-yaml`, `unknown-status`, `legacy-format-refused`. */
  kind: string;
  message: string;
}

export interface SpecMeta {
  feature?: string;
  title?: string;
  status?: string;
}

export interface SpecRead {
  format: Format;
  stories: StoryProgress[];
  meta: SpecMeta;
  /** Feature-level `depends-on` (v2 frontmatter), as written; empty for 1.x. */
  dependsOn: string[];
  issues: FormatIssue[];
}

export interface TasksRead {
  format: Format;
  tasks: TaskLine[];
  phases: PhaseVerify[];
  issues: FormatIssue[];
}

/** Counts files per format so the CLI edge can print one legacy warning per run (030:FR-012). */
export class FormatTally {
  readonly v1 = new Set<string>();
  readonly v2 = new Set<string>();
  record(file: string, format: Format): void {
    (format === 1 ? this.v1 : this.v2).add(file);
  }
}

export interface ReadCtx {
  /** Project-relative file name, used in issues and the tally. */
  file?: string;
  tally?: FormatTally;
}
