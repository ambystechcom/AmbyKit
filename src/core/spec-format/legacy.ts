// Reading 1.x files in 2.x (030:FR-012, FR-013, FR-019; 035:FR-002). While `LEGACY_READING` is "on" a 1.x spec or task file
// is read exactly as before, and the CLI prints ONE concise line per run saying how many files use the old format and how to
// migrate. When it is "off" the dispatcher refuses to read them. The switch is explicit, not a version gate, so a version bump
// alone can never end 1.x reading: it goes "off" only with the accepted go decision of feature 035 (a test enforces that).
import { FormatTally } from "./model.js";

/** Environment switch: `AMBYKIT_LEGACY_WARNING=0` silences the warning. */
export const LEGACY_ENV = "AMBYKIT_LEGACY_WARNING";

/** Stable issue kind the dispatcher returns for a 1.x file it refuses to read. */
export const LEGACY_REFUSED_KIND = "legacy-format-refused";

export type LegacyReading = "on" | "off";

/**
 * Whether 1.x files are still read (035:FR-002, decision D-8). "on" until 035's go decision is accepted (T012) and T080 flips it;
 * `legacyOffProblems` lists what the decision record must hold before "off" is allowed.
 */
export const LEGACY_READING = "on" as LegacyReading;

let active: FormatTally | null = null;

/** Start collecting the formats of every file read through the dispatcher; returns the tally. */
export function beginTally(): FormatTally {
  active = new FormatTally();
  return active;
}

/** The tally readers record into when the caller passes none, or null outside a command run. */
export function activeTally(): FormatTally | null {
  return active;
}

export function endTally(): void {
  active = null;
}

/** Config and environment decide whether the warning is shown: `legacyWarning: false` or `AMBYKIT_LEGACY_WARNING=0` silences it. */
export function legacyEnabled(config: { legacyWarning?: boolean } | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (config?.legacyWarning === false) return false;
  const v = env[LEGACY_ENV];
  return !(v === "0" || v?.toLowerCase() === "false");
}

/** The one line printed per run (C-5). */
export function legacyWarningLine(count: number): string {
  return `${count} file${count === 1 ? "" : "s"} use${count === 1 ? "s" : ""} the 1.x spec format (read as before). Run \`ambykit migrate\` to upgrade; support ends in 2.1.`;
}

/** True when 1.x files are refused instead of read (030:FR-013, 035:FR-002). The setting is injected in tests. */
export function refuseLegacy(reading: LegacyReading = LEGACY_READING): boolean {
  return reading === "off";
}

/** The title of feature 035's go-decision record in `.amby/decisions/` (035:FR-001). */
export const LEGACY_DECISION_TITLE = "End 1.x reading in 2.1";

/**
 * The conditions the go decision records, one line each: `- **<condition>:** met, <YYYY-MM-DD>, <evidence>` (035:FR-001, D-1, D-6).
 * T010 drafts the record with these lines and T011 extends the test; the line shape here is the minimum both rely on.
 */
export const LEGACY_DECISION_CONDITIONS = ["Gate wording", "Adoption window", "No open migrate data-loss defect", "Documented path"] as const;

/**
 * What stops `LEGACY_READING` from being "off": the go-decision record (its text, or undefined when none exists) must be
 * `status: accepted` and record every condition as met, with a date and evidence. Empty while reading stays "on".
 */
export function legacyOffProblems(reading: LegacyReading, decision: string | undefined): string[] {
  if (reading === "on") return [];
  if (decision === undefined) return [`no decision record titled '${LEGACY_DECISION_TITLE}' in .amby/decisions/`];
  const problems: string[] = [];
  const status = /^status:[ \t]*(\S+)/m.exec(decision)?.[1];
  if (status !== "accepted") problems.push(`the decision record is '${status ?? "without a status"}', not 'accepted'`);
  for (const c of LEGACY_DECISION_CONDITIONS) {
    const m = new RegExp("^\\s*[-*]\\s*\\*\\*" + c + ":\\*\\*[ \\t]*(.*)$", "mi").exec(decision);
    const v = m?.[1]?.trim() ?? "";
    if (v === "") problems.push(`the decision records no '${c}'`);
    else if (!/^met\b/i.test(v)) problems.push(`'${c}' is '${v}', not met`);
    else if (!/\d{4}-\d{2}-\d{2}/.test(v)) problems.push(`'${c}' has no date`);
    else if (v.replace(/^met\b/i, "").replace(/\d{4}-\d{2}-\d{2}/, "").replace(/[,;:\s]/g, "") === "") problems.push(`'${c}' has no evidence`);
  }
  return problems;
}

/** Feature directories that have a file on the 1.x format in the tally, in the order first seen. */
export function legacyFeatures(tally: FormatTally | null): string[] {
  const dirs: string[] = [];
  for (const file of tally?.v1 ?? []) {
    const dir = /^specs\/([^/]+)\//.exec(file)?.[1];
    if (dir && !dirs.includes(dir)) dirs.push(dir);
  }
  return dirs.sort();
}

/** The refusal message, naming the file (FR-013). */
export function legacyRefusedMessage(file: string): string {
  return `${file} uses the 1.x spec format, which this version no longer reads; migrate it with AmbyKit 2.0 (\`npx @ambystech/ambykit@2.0 migrate\`).`;
}
