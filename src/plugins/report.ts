import { describeCollision } from "./registry.js";
import type { PluginSession } from "./session.js";

export interface PluginReport {
  /** One line per loaded plugin, then a note for each plugin that loaded through 1.x compatibility (FR-008; 033:FR-009). */
  info: string[];
  /** One line per plugin that did not load, and per rejected target (FR-004, FR-005). */
  errors: string[];
}

/** What `sync` and `check` say about the listed plugins. Pure. Empty when none are listed. */
export function reportPlugins(session: PluginSession | undefined): PluginReport {
  const report: PluginReport = { info: [], errors: [] };
  if (!session) return report;
  for (const p of session.loaded) {
    report.info.push(`Plugin ${p.name}@${p.version}`);
    for (const note of p.notes ?? []) report.info.push(`  note: ${note}`);
  }
  for (const f of session.failures) report.errors.push(`Plugin ${f.name} was not loaded: ${f.reason}`);
  for (const c of session.collisions) report.errors.push(describeCollision(c));
  return report;
}
