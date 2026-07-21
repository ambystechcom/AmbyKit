import { readFileSync } from "node:fs";
import { join } from "node:path";
import { packageRoot } from "./paths.js";

/**
 * Version helpers for the outdated-warning + `update` feature (010). Comparison and classification are
 * pure; `installedVersion` reads the package's own `package.json` (same edge as `paths.ts`).
 */

/** The running CLI version, read from `packageRoot()/package.json`; "0.0.0" if unreadable. */
export function installedVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf8")) as {
      version?: unknown;
    };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** "0.0.0" and other unpublished placeholders → true (never warn/downgrade, FR-013). */
export function isDevPlaceholder(version: string): boolean {
  return version === "0.0.0" || version.trim() === "";
}

/** Parse the numeric `x.y.z` core, ignoring any pre-release/build suffix. */
function core(version: string): [number, number, number] {
  const nums = (version.split("-")[0] ?? "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
}

/** Numeric `x.y.z` compare (pre-release/build ignored): -1, 0, or 1. */
export function compareVersions(a: string, b: string): number {
  const ca = core(a);
  const cb = core(b);
  for (let i = 0; i < 3; i++) {
    const d = (ca[i] ?? 0) - (cb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** True when `installed` is a real release strictly behind a known `latest` (see data-model). */
export function isOutdated(installed: string, latest: string | null): boolean {
  if (latest === null) return false;
  if (isDevPlaceholder(installed)) return false;
  return compareVersions(installed, latest) < 0;
}
