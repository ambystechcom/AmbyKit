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
