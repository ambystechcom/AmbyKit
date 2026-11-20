import type { FleetPlan, PlanError, WaitsFor } from "./types.js";

/**
 * The fleet plan as text and JSON (feature 031, FR-001, FR-005, FR-006). One source for the preview, so what is
 * printed is what runs. Each serialization names the shared files that caused it; ownership that could not be
 * read is flagged per task as `unknown ownership: T###`.
 */

function why(w: WaitsFor): string {
  if (w.why === "shared-files") return w.files && w.files.length > 0 ? `shared files: ${w.files.join(", ")}` : "unknown ownership";
  return w.why;
}

export function planLines(plan: FleetPlan): string[] {
  const lines: string[] = [];
  lines.push(`Fleet plan — ${plan.features.length} feature${plan.features.length === 1 ? "" : "s"} (experimental)`);
  const tokens = plan.budgets.maxTokens !== undefined ? `, ${plan.budgets.maxTokens} tokens` : "";
  lines.push(`Caps for the whole fleet: ${plan.caps.total} assistants at once, ${plan.caps.perType} of one type. Budgets: ${plan.budgets.wallClockMinutes} minutes, ${plan.budgets.maxTasks} task events${tokens}.`);
  lines.push("Order:");
  plan.features.forEach((f, i) => {
    const lanes = plan.laneCounts[f.feature] ?? 0;
    const prep = plan.prepare.find((p) => p.feature === f.feature);
    const laneText = prep ? `${prep.lanes} lanes to prepare` : `${lanes} lane${lanes === 1 ? "" : "s"}`;
    const waits = f.waitsFor.length === 0 ? "starts first" : `waits for ${f.waitsFor.map((w) => `${w.feature} (${why(w)})`).join("; ")}`;
    lines.push(`  ${i + 1}. ${f.feature} — ${laneText} — ${waits}`);
    if (f.ownership.unknown.length > 0) lines.push(`     unknown ownership: ${f.ownership.unknown.join(", ")} (treated as owning everything; serialized against the others)`);
  });
  if (plan.skipped.length > 0) {
    lines.push("Skipped:");
    for (const s of plan.skipped) lines.push(`  ${s.feature} — ${s.reason}`);
  }
  return lines;
}

export function planJson(plan: FleetPlan): unknown {
  return {
    experimental: true,
    caps: plan.caps,
    budgets: plan.budgets,
    features: plan.features.map((f) => ({
      feature: f.feature,
      lanes: plan.laneCounts[f.feature] ?? 0,
      prepare: plan.prepare.find((p) => p.feature === f.feature)?.lanes ?? 0,
      waitsFor: f.waitsFor,
      ownership: f.ownership,
    })),
    skipped: plan.skipped,
  };
}

export function errorLines(errors: PlanError[]): string[] {
  return errors.map((e) => e.message);
}
