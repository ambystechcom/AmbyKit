// Reading 1.x files in 2.x (030:FR-012, FR-013, FR-019). Until 2.1 a 1.x spec or task file is read exactly as before, and
// the CLI prints ONE concise line per run saying how many files use the old format and how to migrate. From 2.1 the
// dispatcher refuses to read them and says to migrate with the 2.0 tool. The refusal is built and tested now (with an
// injected version) so 2.1 is a version bump, not new code.
import { FormatTally } from "./model.js";

/** Environment switch: `AMBYKIT_LEGACY_WARNING=0` silences the warning. */
export const LEGACY_ENV = "AMBYKIT_LEGACY_WARNING";

/** Stable issue kind the dispatcher returns for a 1.x file it refuses to read. */
export const LEGACY_REFUSED_KIND = "legacy-format-refused";

/** The first version that no longer reads 1.x files (roadmap: 2.1, once no migration issue is open). */
export const REFUSE_FROM = "2.1.0";

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

const parts = (v: string): number[] => v.split(/[-+]/)[0]!.split(".").map((n) => Number.parseInt(n, 10) || 0);

/** True from `REFUSE_FROM` on: 1.x files are refused instead of read (FR-013). `version` is injected in tests. */
export function refuseLegacy(version: string): boolean {
  const v = parts(version);
  const gate = parts(REFUSE_FROM);
  for (let i = 0; i < 3; i++) {
    const a = v[i] ?? 0;
    const b = gate[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
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
