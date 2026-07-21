import { packageVersion } from "../../core/paths.js";
import { isOutdated } from "../../core/version.js";
import { cacheIsStale, latestFromCache, refreshLatest } from "../io/version-check.js";
import { boxGlyphs, paint, symbols } from "./theme.js";
import type { Capabilities } from "./types.js";

/**
 * VersionWarningCallout (ui.md, feature 010): a yellow bordered box naming the installed and latest
 * versions, shown between the banner and the command output. Returns "" when suppressed — not
 * outdated, dev placeholder, or latest unknown. The caller additionally gates on `caps.isTTY` and
 * `--json`. Pure — styling flows only through `theme.ts` (Principle 2).
 */
export function versionWarning(
  caps: Capabilities,
  installed: string,
  latest: string | null,
): string {
  if (!isOutdated(installed, latest)) return "";

  const box = boxGlyphs(caps);
  const bang = symbols(caps).warn; // "!" / "!"
  const arrow = caps.unicode ? "→" : "->";
  const dash = caps.unicode ? "—" : "-";
  const gutter = "  ";

  const rawLines = [
    `${bang} Update available ${dash} AmbyKit ${installed} ${arrow} ${latest}`,
    `  Run \`ambykit update\` to upgrade.`,
  ];

  // Fit content, capped at the terminal width minus the gutter and box padding.
  const maxInner = Math.max(10, caps.columns - gutter.length - 4);
  const lines = rawLines.map((l) => (l.length > maxInner ? l.slice(0, maxInner) : l));
  const inner = Math.min(maxInner, Math.max(...lines.map((l) => l.length)));

  const pad = (s: string): string => s + " ".repeat(inner - s.length);
  const top = box.tl + box.h.repeat(inner + 2) + box.tr;
  const bottom = box.bl + box.h.repeat(inner + 2) + box.br;
  const mid = (s: string): string => `${box.v} ${pad(s)} ${box.v}`;

  return [top, mid(lines[0]!), mid(lines[1]!), bottom]
    .map((l) => gutter + paint(caps, "warn", l))
    .join("\n");
}

/**
 * The outdated-version callout for `caps`, reading the cached latest version and doing one bounded,
 * best-effort refresh when the cache is stale (FR-005/005a). Returns "" when up to date or unknown.
 * Shared by `BaseCommand.run()` and the no-arg/help path so both show the warning consistently.
 * Callers gate on `caps.isTTY` / `--json` before calling.
 */
export async function outdatedWarning(caps: Capabilities): Promise<string> {
  let latest = latestFromCache();
  if (cacheIsStale()) latest = (await refreshLatest()) ?? latest;
  return versionWarning(caps, packageVersion(), latest);
}
