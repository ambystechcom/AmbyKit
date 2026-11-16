/** Report types for `ambykit trace` (feature 024). Pure data; see specs/024-trace/contracts/trace-json.md. */

export interface Requirement {
  /** `FR-###`. */
  id: string;
  text: string;
}

/** A test title found in source: where it is, what it says, whether it is skipped/todo. */
export interface TestEntry {
  file: string;
  line: number;
  title: string;
  skipped: boolean;
}

/** One feature as the matrix sees it. */
export interface TraceFeature {
  dir: string;
  ref: string;
  requirements: Requirement[];
  /** Deliberately uncovered requirements: id → reason (from tests.md, else spec.md). */
  deliberate: Map<string, string>;
}

export type RequirementStatus = "covered" | "uncovered" | "deliberate";

export interface RequirementRow {
  id: string;
  qid: string;
  text: string;
  status: RequirementStatus;
  reason?: string;
  tests: TestEntry[];
}

export interface CoverageCounts {
  covered: number;
  total: number;
  uncovered: number;
  deliberate: number;
}

export interface DesignCaseRow {
  id: string;
  fr: string[];
  kind: "auto" | "manual";
  state: "matched" | "missing" | "manual";
}

export interface FeatureTrace {
  feature: string;
  ref: string;
  hasRequirements: boolean;
  requirements: RequirementRow[];
  coverage: CoverageCounts;
  design?: { cases: DesignCaseRow[] };
}

export interface OrphanTest extends TestEntry {
  cites: string[];
}
export interface UncitedTest extends TestEntry {
  reason: "no-id" | "unqualified";
}
export interface AmbiguousTest extends TestEntry {
  id: string;
  features: string[];
}
export interface SkippedTest extends TestEntry {
  cites: string[];
}

export interface TraceReport {
  version: 1;
  features: FeatureTrace[];
  orphans: OrphanTest[];
  uncited: UncitedTest[];
  ambiguous: AmbiguousTest[];
  skipped: SkippedTest[];
}

/** Designed cases for a feature (spec 021), already reduced to what the matrix needs. */
export interface DesignInput {
  cases: { id: string; fr: string[]; kind: "auto" | "manual" }[];
}
