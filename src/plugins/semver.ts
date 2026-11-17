/**
 * A small, pure semver range check for the plugin API (feature 027, plan open decision 1). It supports
 * exact versions, `^`, `~`, `>=`, `>`, `<=`, `<`, `=`, space-joined AND and `||` OR. Anything else is
 * reported as unsupported, with a reason, so a plugin is refused with a message rather than guessed at.
 */

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

export type RangeResult = { supported: true; satisfied: boolean } | { supported: false; reason: string };

const EXACT = /^(\d+)\.(\d+)\.(\d+)$/;
const PARTIAL = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

/** Parse `x.y.z` exactly (no prerelease, no build metadata, no `v` prefix). */
export function parseVersion(text: string): Version | null {
  const m = EXACT.exec(text.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** True for a pin of the form `x.y.z`; ranges, tags and prerelease versions are not pins. */
export function isExactVersion(text: string): boolean {
  return parseVersion(text) !== null;
}

function compare(a: Version, b: Version): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

interface Bound {
  op: ">=" | ">" | "<=" | "<";
  v: Version;
}

/** Fill a partial version (`1`, `1.2`) with zeros, remembering how many parts were given. */
function parsePartial(text: string): { v: Version; parts: number } | null {
  const m = PARTIAL.exec(text);
  if (!m) return null;
  const parts = m[3] !== undefined ? 3 : m[2] !== undefined ? 2 : 1;
  return { v: { major: Number(m[1]), minor: Number(m[2] ?? 0), patch: Number(m[3] ?? 0) }, parts };
}

/** One comparator (`^1.2`, `>=1.0.0`, `1.2.3`) as lower/upper bounds, or a reason it is unsupported. */
function comparator(token: string): Bound[] | string {
  const m = /^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(token);
  if (!m) return `cannot read '${token}'`;
  const op = m[1] ?? "";
  const p = parsePartial(m[2]!);
  if (!p) return `unsupported version '${m[2]}' in '${token}'`;
  const { v, parts } = p;
  if (op === "") {
    if (parts !== 3) return `'${token}' is not an exact version (write x.y.z or use ^ or ~)`;
    return [
      { op: ">=", v },
      { op: "<=", v },
    ];
  }
  if (op === "=") {
    if (parts !== 3) return `'${token}' is not an exact version`;
    return [
      { op: ">=", v },
      { op: "<=", v },
    ];
  }
  if (op === ">=" || op === ">" || op === "<=" || op === "<") return [{ op, v }];
  if (op === "^") {
    const upper: Version =
      v.major > 0 || parts === 1
        ? { major: v.major + 1, minor: 0, patch: 0 }
        : v.minor > 0 || parts === 2
          ? { major: 0, minor: v.minor + 1, patch: 0 }
          : { major: 0, minor: 0, patch: v.patch + 1 };
    return [
      { op: ">=", v },
      { op: "<", v: upper },
    ];
  }
  // "~": patch-level changes only, or minor-level when just the major is given.
  const upper: Version = parts === 1 ? { major: v.major + 1, minor: 0, patch: 0 } : { major: v.major, minor: v.minor + 1, patch: 0 };
  return [
    { op: ">=", v },
    { op: "<", v: upper },
  ];
}

function holds(version: Version, b: Bound): boolean {
  const c = compare(version, b.v);
  return b.op === ">=" ? c >= 0 : b.op === ">" ? c > 0 : b.op === "<=" ? c <= 0 : c < 0;
}

/** Does `version` (exact `x.y.z`) satisfy `range`? An unsupported range or version says why. */
export function satisfies(version: string, range: string): RangeResult {
  const v = parseVersion(version);
  if (!v) return { supported: false, reason: `'${version}' is not an exact version (x.y.z)` };
  const text = range.trim();
  if (text === "") return { supported: false, reason: "the range is empty" };
  let satisfied = false;
  for (const alternative of text.split("||")) {
    const tokens = alternative.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { supported: false, reason: `'${range}' has an empty alternative` };
    let all = true;
    for (const token of tokens) {
      const bounds = comparator(token);
      if (typeof bounds === "string") return { supported: false, reason: bounds };
      if (!bounds.every((b) => holds(v, b))) all = false;
    }
    if (all) satisfied = true;
  }
  return { supported: true, satisfied };
}
