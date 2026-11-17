import { PLUGIN_API_EXPERIMENTAL, PLUGIN_API_VERSION } from "./api.js";
import { describeCollision } from "./registry.js";
import type { PluginSession } from "./session.js";

export interface PluginReport {
  /** One line per loaded plugin, then the experimental note (FR-008, FR-011). */
  info: string[];
  /** One line per plugin that did not load, and per rejected target (FR-004, FR-005). */
  errors: string[];
}

/** What `sync` and `check` say about the listed plugins. Pure. Empty when none are listed. */
export function reportPlugins(session: PluginSession | undefined): PluginReport {
  const report: PluginReport = { info: [], errors: [] };
  if (!session) return report;
  for (const p of session.loaded) report.info.push(`Plugin ${p.name}@${p.version}`);
  if (session.loaded.length > 0 && PLUGIN_API_EXPERIMENTAL) {
    report.info.push(
      `The plugin API (${PLUGIN_API_VERSION}) is experimental in 1.6 and may change; plugins run with your permissions (docs/plugin-trust.md).`,
    );
  }
  for (const f of session.failures) report.errors.push(`Plugin ${f.name} was not loaded: ${f.reason}`);
  for (const c of session.collisions) report.errors.push(describeCollision(c));
  return report;
}
