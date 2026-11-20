/**
 * One place that says whether `ambykit run` is experimental or stable (feature 033, FR-006). Every label, banner and `experimental`
 * JSON flag reads this constant; nothing else spells "(experimental)". It becomes `"stable"` only after one fleet has built two
 * dependent features of this repository with a verified runner and the record exists (`specs/033-stable-run-and-plugin-api/dogfood.md`).
 * A test refuses `"stable"` without that record, so the label cannot over-promise (Principle 6).
 */
export type RunStability = "experimental" | "stable";

/** Experimental until the dogfood is recorded (033 T071) and the owner flips it (T072). */
export const RUN_STABILITY = "experimental" as RunStability;

export function isExperimental(stability: RunStability = RUN_STABILITY): boolean {
  return stability === "experimental";
}

/** `(experimental)` while experimental, an empty string once stable, so `${label}` can be dropped into a sentence. */
export function stabilityLabel(stability: RunStability = RUN_STABILITY): string {
  return isExperimental(stability) ? "(experimental)" : "";
}

/** `text` with the label appended (`Run plan (experimental)`), or just `text` when stable. */
export function withStability(text: string, stability: RunStability = RUN_STABILITY): string {
  const label = stabilityLabel(stability);
  return label === "" ? text : `${text} ${label}`;
}

/**
 * Feature 033 (FR-006): what `dogfood.md` must record before `RUN_STABILITY` may be `"stable"`. The dogfood is one fleet that built two
 * dependent features of this repository with a verified runner (031 T094). Each line is `- **Label:** value`; the result must be `passed`.
 * Returns what is missing, so a test can say exactly what to record.
 */
export const DOGFOOD_FIELDS = ["Fleet run id", "Runner", "Versions", "Features", "Result"] as const;

export function dogfoodProblems(text: string | undefined): string[] {
  if (text === undefined) return ["specs/033-stable-run-and-plugin-api/dogfood.md does not exist"];
  const problems: string[] = [];
  for (const field of DOGFOOD_FIELDS) {
    const m = new RegExp("^\\s*[-*]\\s*\\*\\*" + field + ":\\*\\*[ \\t]*(.*)$", "mi").exec(text);
    if (!m || m[1]!.trim() === "") problems.push(`dogfood.md records no '${field}'`);
    else if (field === "Result" && !/^passed\b/i.test(m[1]!.trim())) problems.push(`dogfood.md records the result '${m[1]!.trim()}', not 'passed'`);
  }
  return problems;
}

/** Why `stability` may not be `"stable"` yet: empty while experimental, or when the dogfood is recorded and passed. */
export function stabilityProblems(stability: RunStability, dogfoodText: string | undefined): string[] {
  return stability === "stable" ? dogfoodProblems(dogfoodText) : [];
}
