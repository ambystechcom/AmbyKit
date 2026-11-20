import type { FleetsEntry, FleetsView } from "./fleet-view.js";

/**
 * The fleets overview as text (feature 031, FR-014, US-4, US-6): one block per fleet, then one row per feature in
 * planned order with its state, run and lanes. A paused feature shows why and which features it holds; a waiting one
 * shows what it waits for. Pure text from `fleetsView`; no styling, so it is the same in a pipe and a terminal.
 */

function laneText(l: FleetsEntry["features"][number]["lanes"][number]): string {
  const state = l.stalled ? `STALLED${l.idleMinutes !== undefined ? ` ${l.idleMinutes}m` : ""}` : l.state;
  return `${l.lane} ${state} (${l.assistant})`;
}

export function fleetsLines(view: FleetsView, only?: string): string[] {
  const lines: string[] = [];
  for (const fleet of view.fleets) {
    if (only && fleet.fleet !== only) continue;
    const tokens = fleet.budgets.maxTokens !== undefined ? `, ${fleet.budgets.maxTokens} tokens` : "";
    lines.push(`${fleet.fleet}  ${fleet.status}  ${fleet.features.length} feature${fleet.features.length === 1 ? "" : "s"}  caps ${fleet.caps.total} total / ${fleet.caps.perType} per type  budgets ${fleet.budgets.wallClockMinutes} min, ${fleet.budgets.maxTasks} task events${tokens}`);
    for (const f of fleet.features) {
      const run = f.run ? `  run ${f.run.run}` : "";
      lines.push(`  ${f.feature}  ${f.state}${run}`);
      if (f.state === "paused") {
        lines.push(`    paused: ${f.cause ?? "waiting for a person"}`);
        const holds = (f.affected ?? []).filter((x) => x !== f.feature);
        if (holds.length > 0) lines.push(`    holds: ${holds.join(", ")}`);
      }
      if (f.state === "waiting") {
        const why = f.heldBy ? `held while ${f.heldBy} is paused` : f.waitsFor.map((w) => `${w.feature} (${w.why}${w.files && w.files.length > 0 ? `: ${w.files.join(", ")}` : ""})`).join("; ");
        if (why) lines.push(`    ${f.heldBy ? "" : "waits for "}${why}`);
      }
      if (f.unknownOwnership.length > 0) lines.push(`    unknown ownership: ${f.unknownOwnership.join(", ")}`);
      for (const l of f.lanes) lines.push(`    ${laneText(l)}`);
    }
  }
  if (lines.length === 0) lines.push(only ? `Fleet '${only}' not found.` : "No fleets. Start one with: ambykit run <feature> <feature>...");
  return lines;
}
